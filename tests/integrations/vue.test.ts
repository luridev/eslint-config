import assert from 'node:assert/strict';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import vuePlugin from 'eslint-plugin-vue';
import vueAccessibility from 'eslint-plugin-vuejs-accessibility';
import tseslint from 'typescript-eslint';
import { beforeAll, describe, it } from 'vitest';
import vueParser from 'vue-eslint-parser';
import { createProtoConfig } from '@protoapps/eslint-config';
import type { ConfigOverrides, TestConfigOptions, TestESLint } from '#tests/types.js';
import type { ProtoConfigOptions } from '@protoapps/eslint-config';

const consumerRoot = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/vue-consumer');

const createConfig = (options: TestConfigOptions = {}, ...overrides: ConfigOverrides) => createProtoConfig({
  tsconfigRootDir: consumerRoot,
  vue: { version: '3.5.40' },
  ...options,
}, ...overrides);

const createEslint = async (
  options: TestConfigOptions = {}, ...overrides: ConfigOverrides
): Promise<TestESLint> => new ESLint({
  cwd: consumerRoot,
  overrideConfigFile: true,
  overrideConfig: await createConfig(options, ...overrides),
});

describe('Vue integration', () => {
  let baseline: TestESLint;

  beforeAll(async () => {
    baseline = await createEslint();
  });

  it('scopes the Vue parser, processor, browser globals, and version policy to SFC files', async () => {
    const component = await baseline.calculateConfigForFile('src/component.vue');
    const typescript = await baseline.calculateConfigForFile('src/standard.ts');
    assert.ok(component !== undefined && typescript !== undefined);

    assert.equal(component.languageOptions.parser, vueParser);
    assert.equal(component.processor, vuePlugin.processors['.vue']);
    assert.equal(component.languageOptions.parserOptions.parser, tseslint.parser);
    assert.equal(component.languageOptions.parserOptions.projectService, true);
    assert.equal(component.languageOptions.parserOptions.tsconfigRootDir, consumerRoot);
    assert.deepEqual(component.languageOptions.parserOptions.extraFileExtensions, ['.vue']);
    assert.equal(component.plugins?.vue, vuePlugin);
    assert.equal(component.plugins['vuejs-accessibility'], vueAccessibility);
    assert.equal(component.languageOptions.globals?.window, false);
    assert.equal(typescript.languageOptions.parser, tseslint.parser);
    assert.equal(typescript.languageOptions.globals?.window, undefined);
    assert.equal(typescript.processor, undefined);
    assert.equal(typescript.plugins?.vue, undefined);
    assert.deepEqual(component.rules['vue/no-unused-properties'], [2, { groups: ['props'] }]);
    assert.equal(typescript.rules['vue/no-unused-properties'], undefined);
    assert.deepEqual(component.rules['vue/no-unsupported-features'], [2, { version: '3.5.40' }]);

    const older = await createEslint({ vue: { version: '3.3.0' } });
    const olderComponent = await older.calculateConfigForFile('src/component.vue');
    assert.deepEqual(olderComponent?.rules['vue/no-unsupported-features'], [2, { version: '3.3.0' }]);
  });

  it('limits stylisticIgnores to local formatting without disabling typed or template checks', async () => {
    const eslint = await createEslint({ stylisticIgnores: ['**/component.vue'] });
    const regular = await baseline.calculateConfigForFile('src/component.vue');
    const ignored = await eslint.calculateConfigForFile('src/component.vue');
    assert.ok(regular !== undefined && ignored !== undefined);

    for (const rule of ['@stylistic/linebreak-style', 'vue/block-tag-newline']) {
      assert.equal(regular.rules[rule]?.[0], 2, rule);
      assert.equal(ignored.rules[rule], undefined, rule);
    }

    for (const rule of ['vue/html-self-closing', 'vuejs-accessibility/alt-text', '@typescript-eslint/no-floating-promises']) {
      assert.equal(ignored.rules[rule]?.[0], 2, rule);
    }
  });

  it('preserves consumer scopes and resolver extensions while adding Vue support', async () => {
    const eslint = await createEslint({
      additionalCodeFiles: ['**/*.code'],
      additionalTypedFiles: ['**/*.typed'],
      additionalStylisticFiles: ['**/*.styled'],
      additionalResolverExtensions: ['.custom'],
    });

    const code = await eslint.calculateConfigForFile('src/example.code');
    const typed = await eslint.calculateConfigForFile('src/example.typed');
    const styled = await eslint.calculateConfigForFile('src/example.styled');
    const component = await eslint.calculateConfigForFile('src/component.vue');
    assert.ok(code !== undefined && typed !== undefined && styled !== undefined && component !== undefined);

    assert.equal(code.rules.eqeqeq?.[0], 2);
    assert.equal(typed.rules['@typescript-eslint/no-floating-promises']?.[0], 2);
    assert.equal(styled.rules['@stylistic/semi']?.[0], 2);
    assert.equal(component.rules['@typescript-eslint/no-floating-promises']?.[0], 2);
    assert.equal(component.rules['@stylistic/semi']?.[0], 2);

    const resolver = component.settings['import-x/resolver-next']
      ?.find((candidate) => candidate.name === 'eslint-import-resolver-typescript');

    assert.ok(resolver !== undefined);

    for (const [specifier, filename] of [['@fixture/component', 'component.vue'], ['@fixture/custom', 'custom.custom']]) {
      const result = resolver.resolve(specifier, join(consumerRoot, 'src/component.vue'));
      assert.equal(result.found, true);
      assert.equal(normalize(result.path ?? ''), normalize(join(consumerRoot, 'src', filename)));
    }
  });

  it('composes language configs before Vue policies and final scoped overrides', async () => {
    const eslint = await createEslint({
      languageConfigs: [[{
        files: ['**/*.vue'],
        extends: [{ rules: { 'vue/html-self-closing': 'off', 'no-alert': 'warn', eqeqeq: 'off' } }],
        languageOptions: { globals: { consumerGlobal: 'readonly' }, parserOptions: { ecmaFeatures: { jsx: false } } },
      }]],
    }, {
      files: ['**/component.vue'],
      extends: [[{ files: ['**/*.vue'], rules: { 'no-alert': 'error' } }]],
    });

    const component = await eslint.calculateConfigForFile('src/component.vue');
    const other = await eslint.calculateConfigForFile('src/other.vue');
    const typescript = await eslint.calculateConfigForFile('src/standard.ts');
    assert.ok(component !== undefined && other !== undefined && typescript !== undefined);

    assert.equal(component.rules.eqeqeq?.[0], 2);
    assert.equal(component.languageOptions.globals?.consumerGlobal, 'readonly');
    assert.equal(component.languageOptions.parserOptions.ecmaFeatures?.jsx, false);
    assert.equal(component.rules['vue/html-self-closing']?.[0], 2);
    assert.equal(component.rules['no-alert']?.[0], 2);
    assert.equal(other.rules['no-alert']?.[0], 1);
    assert.equal(typescript.rules['no-alert'], undefined);
  });

  it('requires an explicit non-empty Vue version', async () => {
    for (const vue of [true, null, {}, { version: '' }, { version: ' ' }, { version: 3 }]) {
      await assert.rejects(() => createConfig({ vue: vue as unknown as ProtoConfigOptions['vue'] }), /vue.*version/is);
    }
  });
});
