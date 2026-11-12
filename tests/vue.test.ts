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

const lintSfcMessages = async (eslint: TestESLint, text: string) => {
  const [result] = await eslint.lintText(text, { filePath: sfcPath });
  assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));

  return result.messages;
};

const lintSfc = async (eslint: TestESLint, text = readFileSync(sfcPath, 'utf8').replace(/\r?\n/g, '\r\n')) => new Set(
  (await lintSfcMessages(eslint, text)).map(({ ruleId }) => ruleId),
);

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
    assert.deepEqual(component.rules['vue/no-unused-properties'], [2, { groups: ['props'] }]);
    assert.equal(typescript.rules['vue/no-unused-properties'], undefined);
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

  it.each([
    {
      name: 'unused inline prop',
      script: 'defineProps<{ unused: string }>();',
      template: '<div>Content</div>',
      unused: ['unused'],
    },
    {
      name: 'prop used in template',
      script: 'const props = defineProps<{ used: string; unused?: string }>();',
      template: '<div>{{ props.used }}</div>',
      unused: ['unused'],
    },
    {
      name: 'prop used in script setup',
      script: 'const props = defineProps<{ used: string; unused?: string }>();\nconst rendered = props.used;',
      template: '<div>{{ rendered }}</div>',
      unused: ['unused'],
    },
    {
      name: 'imported TypeScript props',
      script: 'import type { ExampleProps } from \'@fixture/types\';\nconst props = defineProps<ExampleProps>();',
      template: '<div>{{ props.used }}</div>',
      unused: ['unused'],
    },
    {
      name: 'inline props forwarded to an imported composable',
      script: 'import { useProps } from \'@fixture/useProps\';\nconst props = defineProps<{ label: string; detail: string }>();\nconst rendered = useProps(props);',
      template: '<div>{{ rendered }}</div>',
      unused: [],
    },
    {
      name: 'imported props forwarded to an imported composable',
      script: 'import type { ComposableProps } from \'@fixture/types\';\nimport { useProps } from \'@fixture/useProps\';\nconst props = defineProps<ComposableProps>();\nconst rendered = useProps(props);',
      template: '<div>{{ rendered }}</div>',
      unused: [],
    },
    {
      name: 'withDefaults does not count a default as usage',
      script: 'const props = withDefaults(defineProps<{ used?: string; unused?: string }>(), { used: \'default\', unused: \'default\' });',
      template: '<div>{{ props.used }}</div>',
      unused: ['unused'],
    },
    {
      name: 'destructured prop with a default',
      script: 'const { used = \'default\' } = defineProps<{ used?: string; unused?: string }>();',
      template: '<div>{{ used }}</div>',
      unused: ['unused'],
    },
    {
      name: 'defineModel alongside unused props',
      script: 'defineProps<{ unused?: string }>();\nconst model = defineModel<string>();',
      template: '<input v-model="model" />',
      unused: ['unused'],
    },
    {
      name: 'dynamic script access',
      script: 'const props = defineProps<{ first: string; second: string }>();\nconst key = Math.random() > 0.5 ? \'first\' : \'second\';\nconst rendered = props[key];',
      template: '<div>{{ rendered }}</div>',
      unused: [],
    },
    {
      name: 'dynamic template access',
      script: 'const props = defineProps<{ first: string; second: string }>();\nconst key = Math.random() > 0.5 ? \'first\' : \'second\';',
      template: '<div>{{ props[key] }}</div>',
      unused: [],
    },
    {
      name: 'public annotations do not exempt props',
      script: 'defineProps<{\n/** @public */\nexternal?: string;\nunused?: string;\n}>();',
      template: '<div>Content</div>',
      unused: ['external', 'unused'],
    },
  ])('unused properties: $name', async ({ script, template, unused }) => {
    const text = `<script setup lang="ts">\n${script}\n</script>\n\n<template>\n  ${template}\n</template>\n`;

    const messages = (await lintSfcMessages(await createEslint(), text))
      .filter(({ ruleId }) => ruleId === 'vue/no-unused-properties');

    assert.deepEqual(messages.map(({ message }) => message.split('\'')[1]), unused);

    for (const message of messages) {
      assert.equal(message.severity, 2);
      assert.equal(message.messageId, 'unused');
    }
  });

  it('checks only props by default and honors public methods in consumer overrides', async () => {
    const text = [
      '<script lang="ts">',
      'export default {',
      '  props: {',
      '    /** @public */',
      '    unusedProp: String,',
      '  },',
      '  data() { return { unusedData: 1 }; },',
      '  computed: { unusedComputed() { return 1; } },',
      '  setup() { return { unusedSetup: 1 }; },',
      '  methods: {',
      '    /** @public */',
      '    externalMethod() { return 1; },',
      '    unusedMethod() { return 1; },',
      '  },',
      '};',
      '</script>',
      '<template><div>Content</div></template>',
    ].join('\n');

    const defaults = (await lintSfcMessages(await createEslint(), text))
      .filter(({ ruleId }) => ruleId === 'vue/no-unused-properties');

    const publicMembers = (await lintSfcMessages(await createEslint({}, {
      files: ['**/*.vue'],
      rules: { 'vue/no-unused-properties': ['error', { groups: ['props'], ignorePublicMembers: true }] },
    }), text)).filter(({ ruleId }) => ruleId === 'vue/no-unused-properties');

    const overridden = (await lintSfcMessages(await createEslint({}, {
      files: ['**/*.vue'],
      rules: { 'vue/no-unused-properties': ['warn', { groups: ['props', 'methods'], ignorePublicMembers: true }] },
    }), text)).filter(({ ruleId }) => ruleId === 'vue/no-unused-properties');

    assert.deepEqual(defaults.map(({ message }) => message.split('\'')[1]), ['unusedProp']);
    assert.deepEqual(defaults.map(({ severity }) => severity), [2]);
    assert.deepEqual(publicMembers, defaults);
    assert.deepEqual(overridden.map(({ message }) => message.split('\'')[1]), ['unusedProp', 'unusedMethod']);
    assert.deepEqual(overridden.map(({ severity }) => severity), [1, 1]);
  });

  it.each([
    ['vue/no-mutating-props', '<script setup lang="ts">const props = defineProps<{ label: string }>(); props.label = "changed";</script><template><div>{{ props.label }}</div></template>'],
    ['vue/require-v-for-key', '<script setup lang="ts">const items = [1, 2];</script><template><div v-for="item in items">{{ item }}</div></template>'],
    ['vue/valid-v-model', '<script setup lang="ts">const value = 1;</script><template><div v-model="value"></div></template>'],
    ['vue/no-undef-components', '<template><MissingComponent /></template>'],
    ['vue/no-undef-properties', '<script setup lang="ts">const value = 1;</script><template><div>{{ value }} {{ missing }}</div></template>'],
    ['vue/no-side-effects-in-computed-properties', '<script lang="ts">export default { data() { return { value: 0 }; }, computed: { result() { this.value++; return this.value; } } };</script><template><div>{{ result }}</div></template>'],
    ['vue/no-dupe-keys', '<script lang="ts">export default { props: ["name"], data() { return { name: "duplicate" }; } };</script><template><div>{{ name }}</div></template>'],
    ['vue/no-dupe-keys', '<script setup lang="ts">defineProps<{ title: string }>(); const value = defineModel<string>("title");</script><template><div>{{ value }}</div></template>'],
    ['vue/require-valid-default-prop', '<script setup lang="ts">const model = defineModel<number>({ default: "wrong" });</script><template><div>{{ model }}</div></template>'],
  ])('retains %s diagnostics', async (rule, text) => {
    const rules = await lintSfc(await createEslint(), text);
    assert.ok(rules.has(rule), `Expected ${rule}: ${JSON.stringify([...rules])}`);
  });

  it('recognizes a recursive script setup component named with defineOptions', async () => {
    const rules = await lintSfc(await createEslint(), '<script setup lang="ts">defineOptions({ name: "RecursivePanel" });</script><template><RecursivePanel /></template>');
    assert.ok(!rules.has('vue/no-undef-components'));
  });
});
