import assert from 'node:assert/strict';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { beforeAll, describe, it } from 'vitest';
import { createProtoConfig } from '@protoapps/eslint-config';
import type { ConfigOverrides, TestConfigOptions, TestESLint } from '#tests/types.js';

const consumerRoot = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/consumer');

const createEslint = async (
  options: TestConfigOptions = {}, ...overrides: ConfigOverrides
): Promise<TestESLint> => new ESLint({
  cwd: consumerRoot,
  overrideConfigFile: true,
  overrideConfig: await createProtoConfig({ tsconfigRootDir: consumerRoot, ...options }, ...overrides),
});

describe('Flat config', () => {
  let baseline: TestESLint;

  beforeAll(async () => {
    baseline = await createEslint();
  });

  it('assembles distinct JavaScript, typed TypeScript, and package JSON configurations', async () => {
    const javascript = await baseline.calculateConfigForFile('src/entry.js');
    const typescript = await baseline.calculateConfigForFile('src/entry.ts');
    const manifest = await baseline.calculateConfigForFile('package.json');
    assert.ok(javascript !== undefined && typescript !== undefined && manifest !== undefined);

    assert.ok(javascript.languageOptions.parser !== undefined && 'parse' in javascript.languageOptions.parser);
    assert.equal(typeof javascript.languageOptions.parser.parse, 'function');
    assert.equal(javascript.languageOptions.parserOptions.projectService, undefined);
    assert.equal(typescript.languageOptions.parser?.meta?.name, 'typescript-eslint/parser');
    assert.equal(typescript.languageOptions.parserOptions.projectService, true);
    assert.equal(typescript.languageOptions.parserOptions.tsconfigRootDir, consumerRoot);

    for (const plugin of ['import-x', 'regexp', 'unused-imports', '@stylistic', 'check-file']) {
      assert.ok(javascript.plugins?.[plugin] !== undefined, plugin);
      assert.ok(typescript.plugins?.[plugin] !== undefined, plugin);
    }

    assert.ok(typescript.plugins?.['@typescript-eslint'] !== undefined);
    assert.equal(javascript.rules['@typescript-eslint/no-floating-promises'], undefined);
    assert.equal(typescript.rules['@typescript-eslint/no-floating-promises']?.[0], 2);
    assert.deepEqual(typescript.rules['@stylistic/linebreak-style'], [2, 'unix']);
    assert.deepEqual(typescript.rules['import-x/no-extraneous-dependencies'], [2, { includeTypes: true }]);
    assert.ok(manifest.plugins?.['package-json'] !== undefined);
    assert.ok(Object.hasOwn(manifest.plugins, 'json'));
    assert.equal(manifest.rules['package-json/sort-scripts']?.[0], 2);
    assert.equal(manifest.rules['@typescript-eslint/no-floating-promises'], undefined);
    assert.equal(await baseline.isPathIgnored('package-lock.json'), true);
    assert.equal(await baseline.isPathIgnored('Example.astro'), true);
  });

  it('passes the consumer tsconfig and opt-in extensions to the import resolver', async () => {
    const extended = await createEslint({ additionalResolverExtensions: ['.fixture'] });
    const importer = join(consumerRoot, 'src/entry.ts');

    for (const [eslint, customExtension] of [[baseline, false], [extended, true]] as const) {
      const config = await eslint.calculateConfigForFile(importer);

      const resolver = config?.settings['import-x/resolver-next']
        ?.find((candidate) => candidate.name === 'eslint-import-resolver-typescript');

      assert.ok(resolver !== undefined);
      const standard = resolver.resolve('@fixture/standard', importer);
      assert.equal(standard.found, true);
      assert.equal(normalize(standard.path ?? ''), normalize(join(consumerRoot, 'src/standard.ts')));
      const custom = resolver.resolve('@fixture/custom', importer);
      assert.equal(custom.found, customExtension);

      if (customExtension) {
        assert.equal(normalize(custom.path ?? ''), normalize(join(consumerRoot, 'src/custom.fixture')));
      }
    }
  });

  it('extends only the requested scopes and keeps stylistic ignores local to formatting', async () => {
    const extended = await createEslint({
      additionalCodeFiles: ['**/*.code'],
      additionalTypedFiles: ['**/*.typed'],
      additionalStylisticFiles: ['**/*.styled'],
      stylisticIgnores: ['**/generated.ts'],
    });

    const code = await extended.calculateConfigForFile('src/sample.code');
    const typed = await extended.calculateConfigForFile('src/sample.typed');
    const styled = await extended.calculateConfigForFile('src/sample.styled');
    const generated = await extended.calculateConfigForFile('src/generated.ts');
    const regular = await baseline.calculateConfigForFile('src/generated.ts');
    assert.ok(code !== undefined && typed !== undefined && styled !== undefined);
    assert.ok(generated !== undefined && regular !== undefined);

    assert.equal((await baseline.calculateConfigForFile('src/sample.code'))?.rules.eqeqeq, undefined);
    assert.equal((await baseline.calculateConfigForFile('src/sample.typed'))?.rules['@typescript-eslint/no-floating-promises'], undefined);
    assert.equal((await baseline.calculateConfigForFile('src/sample.styled'))?.rules['@stylistic/semi'], undefined);
    assert.equal(code.rules.eqeqeq?.[0], 2);
    assert.equal(typed.rules['@typescript-eslint/no-floating-promises']?.[0], 2);
    assert.equal(styled.rules['@stylistic/semi']?.[0], 2);
    assert.deepEqual(styled.rules['@stylistic/linebreak-style'], [2, 'unix']);
    assert.equal(regular.rules['@stylistic/semi']?.[0], 2);
    assert.equal(generated.rules['@stylistic/semi'], undefined);
    assert.equal(generated.rules['@stylistic/linebreak-style'], undefined);
    assert.equal(generated.rules['@typescript-eslint/no-floating-promises']?.[0], 2);
  });

  it('composes language configs before policies and final overrides without widening their scope', async () => {
    const eslint = await createEslint({
      additionalCodeFiles: ['**/*.code'],
      additionalStylisticFiles: ['**/*.code'],
      languageConfigs: [[{
        files: ['**/*.code'],
        extends: [{ rules: { eqeqeq: 'off', 'no-alert': 'warn' } }],
      }]],
    }, { files: ['**/sample.code'], extends: [[{ rules: { 'no-alert': 'error' } }]] });

    const selected = await eslint.calculateConfigForFile('src/sample.code');
    const other = await eslint.calculateConfigForFile('src/other.code');
    const typescript = await eslint.calculateConfigForFile('src/entry.ts');
    assert.ok(selected !== undefined && other !== undefined && typescript !== undefined);

    assert.equal(selected.rules.eqeqeq?.[0], 2);
    assert.equal(selected.rules['no-alert']?.[0], 2);
    assert.equal(other.rules['no-alert']?.[0], 1);
    assert.equal(typescript.rules['no-alert'], undefined);
    assert.equal(selected.rules['@stylistic/semi']?.[0], 2);
  });

  it('passes through native global ignores and scoped rule overrides', async () => {
    const eslint = await createEslint({},
      { ignores: ['**/generated/**'] },
      { files: ['**/entry.ts'], rules: { '@typescript-eslint/no-restricted-imports': 'off' } });

    const entry = await eslint.calculateConfigForFile('src/entry.ts');
    const other = await eslint.calculateConfigForFile('src/standard.ts');
    assert.ok(entry !== undefined && other !== undefined);

    assert.equal(entry.rules['@typescript-eslint/no-restricted-imports']?.[0], 0);
    assert.equal(other.rules['@typescript-eslint/no-restricted-imports']?.[0], 2);
    assert.equal(await eslint.isPathIgnored(join(consumerRoot, 'generated/output.ts')), true);
  });
});
