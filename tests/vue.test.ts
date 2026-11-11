import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import vuePlugin from 'eslint-plugin-vue';
import vueAccessibility from 'eslint-plugin-vuejs-accessibility';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
import vueParser from 'vue-eslint-parser';
import { createProtoConfig } from '@protoapps/eslint-config';
import type { ConfigOverrides, TestConfigOptions, TestESLint } from '#tests/types.js';
import type { ProtoConfigOptions } from '@protoapps/eslint-config';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const consumerRoot = join(packageRoot, 'tests', 'fixtures', 'vue-consumer');
const sfcPath = join(consumerRoot, 'src/component.vue');

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

const lintSfc = async (eslint: TestESLint, text = readFileSync(sfcPath, 'utf8').replace(/\r?\n/g, '\r\n')) => {
  const [result] = await eslint.lintText(text, { filePath: sfcPath });
  assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));

  return new Set(result.messages.map(({ ruleId }) => ruleId));
};

describe('Vue integration', () => {
  it('common RegExp and typed sorting policies also run inside SFC scripts', async () => {
    const rules = await lintSfc(await createEslint(), [
      '<script setup lang="ts">',
      'const numbers = [10, 2].sort();',
      'const pattern = /a|a/;',
      '</script>',
      '<template><div>{{ numbers }} {{ pattern }}</div></template>',
    ].join('\n'));

    assert.ok(rules.has('@typescript-eslint/require-array-sort-compare'));
    assert.ok(rules.has('regexp/no-dupe-disjunctions'));
  });

  it('Vue parser and browser globals stay scoped to SFC files', async () => {
    const eslint = await createEslint();
    const component = await eslint.calculateConfigForFile(sfcPath);
    assert.ok(component !== undefined);
    const typescript = await eslint.calculateConfigForFile(join(consumerRoot, 'src/standard.ts'));
    assert.ok(typescript !== undefined);

    assert.equal(component.languageOptions.parser, vueParser);
    assert.equal(component.languageOptions.parserOptions.parser, tseslint.parser);
    assert.equal(component.languageOptions.parserOptions.projectService, true);
    assert.equal(component.languageOptions.parserOptions.tsconfigRootDir, consumerRoot);
    assert.deepEqual(component.languageOptions.parserOptions.extraFileExtensions, ['.vue']);
    assert.equal(component.plugins?.vue, vuePlugin);
    assert.equal(component.plugins['vuejs-accessibility'], vueAccessibility);
    assert.equal(component.languageOptions.globals?.window, false);
    assert.equal(typescript.languageOptions.parser?.meta?.name, 'typescript-eslint/parser');
    assert.equal(typescript.languageOptions.globals?.window, undefined);
  });

  it('Vue version controls supported template syntax', async () => {
    const text = readFileSync(sfcPath, 'utf8')
      .replaceAll('message', 'alt')
      .replace(':alt="alt"', ':alt');

    const current = await lintSfc(await createEslint(), text);
    const older = await lintSfc(await createEslint({ vue: { version: '3.3.0' } }), text);

    assert.ok(!current.has('vue/no-unsupported-features'));
    assert.ok(older.has('vue/no-unsupported-features'));
  });

  it('stylisticIgnores excludes local SFC formatting while retaining recommended and typed checks', async () => {
    const text = readFileSync(sfcPath, 'utf8')
      .replace(/<template>\r?\n/, '<template>')
      .replace(/\r?\n/g, '\r\n');

    const regular = await lintSfc(await createEslint(), text);
    const ignored = await lintSfc(await createEslint({ stylisticIgnores: ['**/component.vue'] }), text);

    for (const rule of ['@stylistic/linebreak-style', 'vue/block-tag-newline']) {
      assert.ok(regular.has(rule), `Expected ${rule} before stylisticIgnores`);
      assert.ok(!ignored.has(rule), `Unexpected ignored ${rule}`);
    }

    for (const rule of ['vuejs-accessibility/alt-text', '@typescript-eslint/no-unnecessary-condition']) {
      assert.ok(ignored.has(rule), `Expected ${rule} to remain active`);
    }
  });

  it('SFC linting runs typed, Vue, and accessibility checks', async () => {
    const rules = await lintSfc(await createEslint());

    for (const rule of ['@typescript-eslint/no-unnecessary-condition', 'vue/no-static-inline-styles', 'vuejs-accessibility/alt-text']) {
      assert.ok(rules.has(rule), `Expected ${rule}: ${JSON.stringify([...rules])}`);
    }
  });

  it('Vue preserves additional code, typed, formatting, and resolver scopes', async () => {
    const eslint = await createEslint({
      additionalCodeFiles: ['**/*.code'],
      additionalTypedFiles: ['**/*.typed'],
      additionalStylisticFiles: ['**/*.styled'],
      additionalResolverExtensions: ['.custom'],
    });

    const code = await eslint.calculateConfigForFile(join(consumerRoot, 'src/example.code'));
    const typed = await eslint.calculateConfigForFile(join(consumerRoot, 'src/example.typed'));
    const styled = await eslint.calculateConfigForFile(join(consumerRoot, 'src/example.styled'));
    const component = await eslint.calculateConfigForFile(sfcPath);
    assert.ok(code !== undefined && typed !== undefined && styled !== undefined && component !== undefined);

    assert.equal(code.rules.eqeqeq?.[0], 2);
    assert.equal(typed.rules['@typescript-eslint/no-unnecessary-condition']?.[0], 2);
    assert.equal(styled.rules['@stylistic/semi']?.[0], 2);
    assert.deepEqual(styled.rules['@stylistic/linebreak-style'], [2, 'unix']);
    assert.equal(component.rules['@typescript-eslint/no-unnecessary-condition']?.[0], 2);
    assert.equal(component.rules['@stylistic/semi']?.[0], 2);
    assert.equal(component.rules['vue/block-tag-newline']?.[0], 2);

    const resolver = component.settings['import-x/resolver-next']
      ?.find((candidate) => candidate.name === 'eslint-import-resolver-typescript');

    assert.ok(resolver !== undefined);

    for (const [specifier, file] of [['@fixture/component', sfcPath], ['@fixture/custom', join(consumerRoot, 'src/custom.custom')]]) {
      const result = resolver.resolve(specifier, sfcPath);
      assert.equal(result.found, true);
      assert.ok(typeof result.path === 'string');
      assert.equal(normalize(result.path), normalize(file));
    }
  });

  it('Vue processor applies template comment directives without disabling other checks', async () => {
    const text = readFileSync(sfcPath, 'utf8').replace(
      '  <img src="/missing-alt.png" />',
      '  <!-- eslint-disable-next-line vuejs-accessibility/alt-text -->\n  <img src="/missing-alt.png" />',
    );

    const rules = await lintSfc(await createEslint(), text);

    assert.ok(!rules.has('vuejs-accessibility/alt-text'));
    assert.ok(rules.has('vue/html-self-closing'));
    assert.ok(rules.has('@typescript-eslint/no-unnecessary-condition'));
  });

  it('language configs and native extends retain policy order and file scope', async () => {
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

    const component = await eslint.calculateConfigForFile(sfcPath);
    assert.ok(component !== undefined);
    const other = await eslint.calculateConfigForFile(join(consumerRoot, 'src/other.vue'));
    assert.ok(other !== undefined);
    const typescript = await eslint.calculateConfigForFile(join(consumerRoot, 'src/standard.ts'));
    assert.ok(typescript !== undefined);

    assert.equal(component.rules.eqeqeq?.[0], 2);
    assert.equal(component.languageOptions.globals?.consumerGlobal, 'readonly');
    assert.equal(component.languageOptions.parserOptions.ecmaFeatures?.jsx, false);
    assert.equal(component.rules['vue/html-self-closing']?.[0], 2);
    assert.equal(component.rules['no-alert']?.[0], 2);
    assert.equal(other.rules['no-alert']?.[0], 1);
    assert.equal(typescript.rules['no-alert'], undefined);
  });

  it('Vue options require an explicit non-empty version', async () => {
    for (const vue of [true, null, {}, { version: '' }, { version: ' ' }, { version: 3 }]) {
      await assert.rejects(() => createConfig({ vue: vue as unknown as ProtoConfigOptions['vue'] }), /vue.*version/is);
    }
  });
});
