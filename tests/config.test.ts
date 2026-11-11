import assert from 'node:assert/strict';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, it } from 'vitest';
import { createProtoConfig } from '@protoapps/eslint-config';
import type { TestConfigOptions, TestESLint } from '#tests/types.js';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const consumerRoot = join(packageRoot, 'tests', 'fixtures', 'consumer');

const createConfig = (options: TestConfigOptions = {}) => createProtoConfig({
  tsconfigRootDir: consumerRoot,
  ...options,
});

const createEslint = async (options: TestConfigOptions = {}): Promise<TestESLint> => new ESLint({
  cwd: consumerRoot,
  overrideConfigFile: true,
  overrideConfig: await createConfig(options),
});

const configFor = async (filename: string, options: TestConfigOptions = {}) => (
  (await createEslint(options)).calculateConfigForFile(join(consumerRoot, 'src', filename))
);

const effectiveConfigFor = async (filename: string, options: TestConfigOptions = {}) => {
  const config = await configFor(filename, options);

  assert.ok(config !== undefined, `Expected an effective config for ${filename}`);

  return config;
};

const typescriptResolverFor = async (options: TestConfigOptions = {}) => {
  const config = await effectiveConfigFor('entry.ts', options);
  const resolvers = config.settings['import-x/resolver-next'];

  assert.ok(Array.isArray(resolvers));

  const resolver = resolvers.find((candidate) => candidate.name === 'eslint-import-resolver-typescript');

  assert.ok(resolver !== undefined);

  return resolver;
};

describe('Flat config', () => {
  it.each(['entry.js', 'entry.ts'])('new policies apply to %s without enabling extra RegExp rules', async (filename) => {
    const config = await effectiveConfigFor(filename);

    for (const rule of [
      'no-promise-executor-return', 'no-self-compare', 'no-template-curly-in-string', 'no-eval',
      'regexp/no-dupe-disjunctions', 'regexp/no-missing-g-flag', 'regexp/no-useless-dollar-replacements',
    ]) {
      assert.equal(config.rules[rule]?.[0], 2, rule);
    }

    assert.deepEqual(config.rules['regexp/no-super-linear-backtracking'], [2, { report: 'certain' }]);
    assert.deepEqual(config.rules['import-x/no-extraneous-dependencies'], [2, { includeTypes: true }]);
    assert.equal(config.rules['regexp/prefer-d'], undefined);

    if (filename.endsWith('.ts')) {
      assert.deepEqual(config.rules['@typescript-eslint/require-array-sort-compare'], [2, { ignoreStringArrays: true }]);
    } else {
      assert.equal(config.rules['@typescript-eslint/require-array-sort-compare'], undefined);
    }
  });

  it.each([
    {
      rule: 'no-promise-executor-return',
      invalid: 'export const promise = new Promise(() => 1);',
      valid: 'export const promise = new Promise((resolve) => { resolve(1); });',
    },
    {
      rule: 'no-self-compare',
      invalid: 'export const equal = (value) => value === value;',
      valid: 'export const equal = (left, right) => left === right;',
    },
    {
      rule: 'no-template-curly-in-string',
      invalid: `export const greeting = (name) => 'Hello, \${name}';`,
      valid: `export const greeting = (name) => \`Hello, \${name}\`;`,
    },
    {
      rule: 'no-eval',
      invalid: 'export const parse = (source) => eval(source);',
      valid: 'export const parse = (source) => JSON.parse(source);',
    },
    {
      rule: 'regexp/no-dupe-disjunctions',
      invalid: 'export const pattern = /a|a/;',
      valid: 'export const pattern = /a|b/;',
    },
    {
      rule: 'regexp/no-missing-g-flag',
      invalid: 'export const replaced = "aaa".replaceAll(/a/, "b");',
      valid: 'export const replaced = "aaa".replaceAll(/a/g, "b");',
    },
    {
      rule: 'regexp/no-useless-dollar-replacements',
      invalid: 'export const replaced = "aaa".replace(/a/, "$1");',
      valid: 'export const replaced = "aaa".replace(/(a)/, "$1");',
    },
    {
      rule: 'regexp/no-super-linear-backtracking',
      invalid: 'export const match = (value) => /^(a+)+$/.test(value);',
      valid: 'export const match = (value) => /^a+$/.test(value);',
    },
  ])('$rule reports invalid code and accepts valid code', async ({ rule, invalid, valid }) => {
    const eslint = await createEslint();
    const [invalidResult] = await eslint.lintText(`${invalid}\n`, { filePath: 'src/entry.js' });
    const [validResult] = await eslint.lintText(`${valid}\n`, { filePath: 'src/entry.js' });

    assert.equal(invalidResult.fatalErrorCount, 0, JSON.stringify(invalidResult.messages));
    assert.equal(validResult.fatalErrorCount, 0, JSON.stringify(validResult.messages));
    assert.equal(invalidResult.messages.filter(({ ruleId }) => ruleId === rule).length, 1);
    assert.equal(validResult.messages.filter(({ ruleId }) => ruleId === rule).length, 0);
  });

  it('RegExp analysis supports constructors and leaves unknown patterns and potential backtracking alone', async () => {
    const eslint = await createEslint();

    const [invalid] = await eslint.lintText('export const pattern = new RegExp("a|a");\n', {
      filePath: 'src/entry.js',
    });

    const [valid] = await eslint.lintText([
      'export const dynamic = (source, flags) => new RegExp(source, flags);',
      'export const potential = /a+a+/;',
    ].join('\n'), { filePath: 'src/entry.js' });

    assert.equal(invalid.fatalErrorCount, 0, JSON.stringify(invalid.messages));
    assert.ok(invalid.messages.some(({ ruleId }) => ruleId === 'regexp/no-dupe-disjunctions'));
    assert.equal(valid.fatalErrorCount, 0, JSON.stringify(valid.messages));
    assert.deepEqual(valid.messages.filter(({ ruleId }) => ruleId?.startsWith('regexp/') === true), []);
  });

  it.each([
    ['[10, 2].sort()', 1],
    ['[10, 2].toSorted()', 1],
    ['[{ value: 1 }].sort()', 1],
    ['[10, 2].sort((left, right) => left - right)', 0],
    ['["b", "a"].sort()', 0],
    ['["b", "a"].toSorted()', 0],
  ])('typed sorting checks %s', async (expression, expectedCount) => {
    const [result] = await (await createEslint()).lintText(`export const sorted = ${expression};\n`, {
      filePath: 'src/entry.ts',
    });

    assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
    assert.equal(result.messages.filter(({ ruleId }) => ruleId === '@typescript-eslint/require-array-sort-compare').length, expectedCount);
  });

  it('JavaScript linting applies common rules', async () => {
    const [result] = await (await createEslint()).lintText('export const equal = (left, right) => left == right;\ndebugger;\n', {
      filePath: join(consumerRoot, 'src/entry.js'),
    });

    assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
    const rules = result.messages.map(({ ruleId }) => ruleId);
    assert.ok(rules.includes('eqeqeq'));
    assert.ok(rules.includes('no-debugger'));
  });

  it('package.json linting reports unsorted scripts', async () => {
    const [result] = await (await createEslint()).lintText(JSON.stringify({
      name: 'fixture',
      version: '1.0.0',
      scripts: { test: 'node --test', build: 'tsc' },
    }), { filePath: join(consumerRoot, 'package.json') });

    assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
    assert.ok(result.messages.some(({ ruleId }) => ruleId === 'package-json/sort-scripts'));
  });

  it('effective TypeScript config includes typed, Stylistic, import, and LF policies', async () => {
    const config = await effectiveConfigFor('entry.ts');
    const relativeImportRule = config.rules['@typescript-eslint/no-restricted-imports'];

    assert.equal(config.languageOptions.parserOptions.projectService, true);
    assert.equal(config.languageOptions.parserOptions.tsconfigRootDir, consumerRoot);
    assert.equal(config.rules['@typescript-eslint/no-unnecessary-condition']?.[0], 2);
    assert.equal(config.rules['@typescript-eslint/dot-notation']?.[0], 2);
    assert.equal(config.rules['@stylistic/semi']?.[0], 2);
    assert.deepEqual(config.rules['@stylistic/linebreak-style'], [2, 'unix']);
    assert.equal(relativeImportRule?.[0], 2);
    assert.deepEqual(relativeImportRule[1]?.patterns[0].group, ['./**', '../**']);

    assert.equal(
      relativeImportRule[1].patterns[0].message,
      'Use the configured alias instead of a relative import.',
    );
  });

  it('consumer tsconfig root and paths drive TypeScript import resolution', async () => {
    const resolver = await typescriptResolverFor();
    const importer = join(consumerRoot, 'src', 'entry.ts');
    const result = resolver.resolve('@fixture/standard', importer);

    assert.equal(result.found, true);
    assert.ok(typeof result.path === 'string');
    assert.equal(normalize(result.path), normalize(join(consumerRoot, 'src', 'standard.ts')));
  });

  it('generic file and Stylistic options affect effective config behavior', async () => {
    const codeWithoutOption = await configFor('sample.code');

    const codeWithOption = await effectiveConfigFor('sample.code', {
      additionalCodeFiles: ['**/*.code'],
    });

    const typedWithoutOption = await configFor('sample.typed');

    const typedWithOption = await effectiveConfigFor('sample.typed', {
      additionalTypedFiles: ['**/*.typed'],
    });

    const styledConfig = await effectiveConfigFor('generated.ts');

    const ignoredStylisticConfig = await effectiveConfigFor('generated.ts', {
      stylisticIgnores: ['**/generated.ts'],
    });

    assert.equal(codeWithoutOption?.rules.eqeqeq, undefined);
    assert.equal(codeWithOption.rules.eqeqeq?.[0], 2);
    assert.equal(typedWithoutOption?.rules['@typescript-eslint/no-unnecessary-condition'], undefined);
    assert.equal(typedWithOption.rules['@typescript-eslint/no-unnecessary-condition']?.[0], 2);
    assert.deepEqual(styledConfig.rules['@stylistic/linebreak-style'], [2, 'unix']);
    assert.equal(styledConfig.rules['@stylistic/semi']?.[0], 2);
    assert.equal(ignoredStylisticConfig.rules['@stylistic/linebreak-style'], undefined);
    assert.equal(ignoredStylisticConfig.rules['@stylistic/semi'], undefined);
    assert.equal(ignoredStylisticConfig.rules['@typescript-eslint/no-unnecessary-condition']?.[0], 2);
  });

  it('additional resolver extensions are generic and opt-in', async () => {
    const importer = join(consumerRoot, 'src', 'entry.ts');
    const withoutExtension = (await typescriptResolverFor()).resolve('@fixture/custom', importer);

    const withExtension = (await typescriptResolverFor({
      additionalResolverExtensions: ['.fixture'],
    })).resolve('@fixture/custom', importer);

    assert.equal(withoutExtension.found, false);
    assert.equal(withExtension.found, true);
    assert.ok(typeof withExtension.path === 'string');
    assert.equal(normalize(withExtension.path), normalize(join(consumerRoot, 'src', 'custom.fixture')));
  });

  it('language and formatting extensions compose before policy rules and final overrides', async () => {
    const eslint: TestESLint = new ESLint({
      cwd: consumerRoot,
      overrideConfigFile: true,
      overrideConfig: await createProtoConfig({
        tsconfigRootDir: consumerRoot,
        additionalCodeFiles: ['**/*.code'],
        additionalStylisticFiles: ['**/*.code'],
        languageConfigs: [[{
          files: ['**/*.code'],
          extends: [{ rules: { eqeqeq: 'off', 'no-alert': 'error' } }],
        }]],
      }, { files: ['**/*.code'], rules: { 'no-console': 'off' } }),
    });

    const config = await eslint.calculateConfigForFile(join(consumerRoot, 'src/sample.code'));
    assert.ok(config !== undefined);
    assert.equal(config.rules.eqeqeq?.[0], 2);
    assert.equal(config.rules['no-alert']?.[0], 2);
    assert.equal(config.rules['no-console']?.[0], 0);
    assert.equal(config.rules['@stylistic/semi']?.[0], 2);
    assert.deepEqual(config.rules['@stylistic/linebreak-style'], [2, 'unix']);
  });

  it('native overrides support ignores and disabling individual typed rules', async () => {
    const eslint: TestESLint = new ESLint({
      cwd: consumerRoot,
      overrideConfigFile: true,
      overrideConfig: await createProtoConfig({ tsconfigRootDir: consumerRoot },
        { ignores: ['**/generated/**'] },
        { files: ['**/*.ts'], rules: { '@typescript-eslint/no-restricted-imports': 'off' } }),
    });

    const config = await eslint.calculateConfigForFile(join(consumerRoot, 'src/entry.ts'));
    assert.ok(config !== undefined);
    assert.equal(config.rules['@typescript-eslint/no-restricted-imports']?.[0], 0);
    assert.equal(await eslint.isPathIgnored(join(consumerRoot, 'generated/output.ts')), true);
  });

  it('native extends and config arrays preserve scope and final override priority', async () => {
    const eslint: TestESLint = new ESLint({
      cwd: consumerRoot,
      overrideConfigFile: true,
      overrideConfig: await createProtoConfig({ tsconfigRootDir: consumerRoot },
        {
          files: ['**/entry.ts'],
          extends: [[{ files: ['**/*.ts'], rules: { 'no-alert': 'error', eqeqeq: 'off' } }]],
        },
        [[{ files: ['**/entry.ts'], rules: { eqeqeq: 'warn' } }]]),
    });

    const entry = await eslint.calculateConfigForFile(join(consumerRoot, 'src/entry.ts'));
    assert.ok(entry !== undefined);
    const other = await eslint.calculateConfigForFile(join(consumerRoot, 'src/standard.ts'));
    assert.ok(other !== undefined);

    assert.equal(entry.rules['no-alert']?.[0], 2);
    assert.equal(entry.rules.eqeqeq?.[0], 1);
    assert.equal(other.rules['no-alert'], undefined);
    assert.equal(other.rules.eqeqeq?.[0], 2);
  });
});
