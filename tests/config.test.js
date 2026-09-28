import assert from 'node:assert/strict';
import { dirname, join, normalize } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { createProtoConfig } from '@protoapps/eslint-config';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const consumerRoot = join(packageRoot, 'tests', 'fixtures', 'consumer');

const createConfig = (options = {}) => createProtoConfig({
  tsconfigRootDir: consumerRoot,
  ...options,
});

const createEslint = (options = {}) => new ESLint({
  cwd: consumerRoot,
  overrideConfigFile: true,
  overrideConfig: createConfig(options),
});

const configFor = (filename, options = {}) => (
  createEslint(options).calculateConfigForFile(join(consumerRoot, 'src', filename))
);

const effectiveConfigFor = async (filename, options = {}) => {
  const config = await configFor(filename, options);

  assert.ok(config, `Expected an effective config for ${filename}`);

  return config;
};

const typescriptResolverFor = async (options = {}) => {
  const config = await effectiveConfigFor('entry.ts', options);
  const resolvers = config.settings?.['import-x/resolver-next'];

  assert.ok(Array.isArray(resolvers));

  const resolver = resolvers.find((candidate) => candidate.name === 'eslint-import-resolver-typescript');

  assert.ok(resolver);

  return resolver;
};

test('JavaScript linting applies common rules', async () => {
  const [result] = await createEslint().lintText('export const equal = (left, right) => left == right;\ndebugger;\n', {
    filePath: join(consumerRoot, 'src/entry.js'),
  });
  assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
  const rules = result.messages.map(({ ruleId }) => ruleId);
  assert.ok(rules.includes('eqeqeq'));
  assert.ok(rules.includes('no-debugger'));
});

test('package.json linting reports unsorted scripts', async () => {
  const [result] = await createEslint().lintText(JSON.stringify({
    name: 'fixture',
    version: '1.0.0',
    scripts: { test: 'node --test', build: 'tsc' },
  }), { filePath: join(consumerRoot, 'package.json') });
  assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
  assert.ok(result.messages.some(({ ruleId }) => ruleId === 'package-json/sort-scripts'));
});

test('effective TypeScript config includes typed, Stylistic, import, and LF policies', async () => {
  const config = await effectiveConfigFor('entry.ts');
  const relativeImportRule = config.rules['@typescript-eslint/no-restricted-imports'];

  assert.equal(config.languageOptions.parserOptions.projectService, true);
  assert.equal(config.languageOptions.parserOptions.tsconfigRootDir, consumerRoot);
  assert.equal(config.rules['@typescript-eslint/no-unnecessary-condition'][0], 2);
  assert.equal(config.rules['@typescript-eslint/dot-notation'][0], 2);
  assert.equal(config.rules['@stylistic/semi'][0], 2);
  assert.deepEqual(config.rules['@stylistic/linebreak-style'], [2, 'unix']);
  assert.equal(relativeImportRule[0], 2);
  assert.deepEqual(relativeImportRule[1].patterns[0].group, ['./**', '../**']);
  assert.equal(
    relativeImportRule[1].patterns[0].message,
    'Use the configured alias instead of a relative import.',
  );
});

test('consumer tsconfig root and paths drive TypeScript import resolution', async () => {
  const resolver = await typescriptResolverFor();
  const importer = join(consumerRoot, 'src', 'entry.ts');
  const result = resolver.resolve('@fixture/standard', importer);

  assert.equal(result.found, true);
  assert.equal(normalize(result.path), normalize(join(consumerRoot, 'src', 'standard.ts')));
});

test('generic file and Stylistic options affect effective config behavior', async () => {
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

  assert.equal(codeWithoutOption?.rules?.eqeqeq, undefined);
  assert.equal(codeWithOption.rules.eqeqeq[0], 2);
  assert.equal(typedWithoutOption?.rules?.['@typescript-eslint/no-unnecessary-condition'], undefined);
  assert.equal(typedWithOption.rules['@typescript-eslint/no-unnecessary-condition'][0], 2);
  assert.deepEqual(styledConfig.rules['@stylistic/linebreak-style'], [2, 'unix']);
  assert.equal(styledConfig.rules['@stylistic/semi'][0], 2);
  assert.equal(ignoredStylisticConfig.rules['@stylistic/linebreak-style'], undefined);
  assert.equal(ignoredStylisticConfig.rules['@stylistic/semi'], undefined);
  assert.equal(ignoredStylisticConfig.rules['@typescript-eslint/no-unnecessary-condition'][0], 2);
});

test('additional resolver extensions are generic and opt-in', async () => {
  const importer = join(consumerRoot, 'src', 'entry.ts');
  const withoutExtension = (await typescriptResolverFor()).resolve('@fixture/custom', importer);
  const withExtension = (await typescriptResolverFor({
    additionalResolverExtensions: ['.fixture'],
  })).resolve('@fixture/custom', importer);

  assert.equal(withoutExtension.found, false);
  assert.equal(withExtension.found, true);
  assert.equal(normalize(withExtension.path), normalize(join(consumerRoot, 'src', 'custom.fixture')));
});

test('language and formatting extensions compose before policy rules and final overrides', async () => {
  const config = await new ESLint({
    cwd: consumerRoot,
    overrideConfigFile: true,
    overrideConfig: createProtoConfig({
      tsconfigRootDir: consumerRoot,
      additionalCodeFiles: ['**/*.code'],
      additionalStylisticFiles: ['**/*.code'],
      languageConfigs: [[{
        files: ['**/*.code'],
        extends: [{ rules: { eqeqeq: 'off', 'no-alert': 'error' } }],
      }]],
    }, { files: ['**/*.code'], rules: { 'no-console': 'off' } }),
  }).calculateConfigForFile(join(consumerRoot, 'src/sample.code'));
  assert.equal(config.rules.eqeqeq[0], 2);
  assert.equal(config.rules['no-alert'][0], 2);
  assert.equal(config.rules['no-console'][0], 0);
  assert.equal(config.rules['@stylistic/semi'][0], 2);
  assert.deepEqual(config.rules['@stylistic/linebreak-style'], [2, 'unix']);
});

test('native overrides support ignores and disabling individual typed rules', async () => {
  const eslint = new ESLint({
    cwd: consumerRoot,
    overrideConfigFile: true,
    overrideConfig: createProtoConfig({ tsconfigRootDir: consumerRoot },
      { ignores: ['**/generated/**'] },
      { files: ['**/*.ts'], rules: { '@typescript-eslint/no-restricted-imports': 'off' } }),
  });
  const config = await eslint.calculateConfigForFile(join(consumerRoot, 'src/entry.ts'));
  assert.equal(config.rules['@typescript-eslint/no-restricted-imports'][0], 0);
  assert.equal(await eslint.isPathIgnored(join(consumerRoot, 'generated/output.ts')), true);
});

test('native extends and config arrays preserve scope and final override priority', async () => {
  const eslint = new ESLint({
    cwd: consumerRoot,
    overrideConfigFile: true,
    overrideConfig: createProtoConfig({ tsconfigRootDir: consumerRoot },
      {
        files: ['**/entry.ts'],
        extends: [[{ files: ['**/*.ts'], rules: { 'no-alert': 'error', eqeqeq: 'off' } }]],
      },
      [[{ files: ['**/entry.ts'], rules: { eqeqeq: 'warn' } }]]),
  });
  const entry = await eslint.calculateConfigForFile(join(consumerRoot, 'src/entry.ts'));
  const other = await eslint.calculateConfigForFile(join(consumerRoot, 'src/standard.ts'));

  assert.equal(entry.rules['no-alert'][0], 2);
  assert.equal(entry.rules.eqeqeq[0], 1);
  assert.equal(other.rules['no-alert'], undefined);
  assert.equal(other.rules.eqeqeq[0], 2);
});
