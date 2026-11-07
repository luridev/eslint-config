import { defineConfig } from 'eslint/config';
import vuePlugin from 'eslint-plugin-vue';
import vueAccessibility from 'eslint-plugin-vuejs-accessibility';
import tseslint from 'typescript-eslint';
import vueParser from 'vue-eslint-parser';
import { createProtoConfig as createBaseConfig } from '../base.js';
import type { Linter } from 'eslint';
import type { ProtoConfigOptions as BaseProtoConfigOptions } from '../base.js';

const vueFiles = ['**/*.vue'];

const vueStylisticRules: Linter.RulesRecord = {
  'vue/block-tag-newline': ['error', { singleline: 'always', multiline: 'always', maxEmptyLines: 0 }],
  'vue/html-indent': [
    'error',
    2,
    {
      attribute: 1,
      baseIndent: 1,
      closeBracket: 0,
      switchCase: 1,
      alignAttributesVertically: false,
    },
  ],
  'vue/html-quotes': ['error', 'double', { avoidEscape: true }],
  'vue/first-attribute-linebreak': ['error', { singleline: 'beside', multiline: 'below' }],
  'vue/html-self-closing': [
    'error',
    {
      html: {
        normal: 'never',
        void: 'always',
        component: 'always',
      },
      svg: 'always',
      math: 'always',
    },
  ],
  'vue/multiline-html-element-content-newline': 'off',
  'vue/singleline-html-element-content-newline': 'off',
  'vue/array-bracket-spacing': ['error', 'never'],
  'vue/arrow-spacing': ['error', { before: true, after: true }],
  'vue/block-spacing': ['error', 'always'],
  'vue/brace-style': ['error', '1tbs', { allowSingleLine: true }],
  'vue/comma-dangle': ['error', 'always-multiline'],
  'vue/comma-spacing': ['error', { before: false, after: true }],
  'vue/comma-style': ['error', 'last'],
  'vue/dot-location': ['error', 'property'],
  'vue/func-call-spacing': ['error', 'never'],
  'vue/key-spacing': ['error', { beforeColon: false, afterColon: true }],
  'vue/keyword-spacing': ['error', { before: true, after: true }],
  'vue/object-curly-spacing': ['error', 'always'],
  'vue/quote-props': ['error', 'as-needed'],
  'vue/space-in-parens': ['error', 'never'],
  'vue/space-infix-ops': 'error',
  'vue/space-unary-ops': ['error', { words: true, nonwords: false }],
  'vue/template-curly-spacing': ['error', 'never'],
};

const vueRules: Linter.RulesRecord = {
  'vue/attributes-order': ['error', { order: ['DEFINITION', 'LIST_RENDERING', 'CONDITIONALS', 'RENDER_MODIFIERS', 'GLOBAL', ['UNIQUE', 'SLOT'], 'TWO_WAY_BINDING', 'OTHER_DIRECTIVES', 'OTHER_ATTR', 'EVENTS', 'CONTENT'], alphabetical: false }],
  'vue/block-lang': ['error', { script: { lang: 'ts' } }],
  'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],
  'vue/component-api-style': ['error', ['script-setup']],
  'vue/component-name-in-template-casing': 'error',
  'vue/custom-event-name-casing': 'error',
  'vue/define-emits-declaration': ['error', 'type-literal'],
  'vue/define-macros-order': ['error', { order: ['defineOptions', 'defineProps', 'defineEmits', 'defineModel', 'defineSlots'], defineExposeLast: true }],
  'vue/no-empty-component-block': 'error',
  'vue/no-import-compiler-macros': 'error',
  'vue/no-multiple-objects-in-class': 'error',
  'vue/no-ref-object-reactivity-loss': 'error',
  'vue/no-root-v-if': 'error',
  'vue/no-setup-props-reactivity-loss': 'error',
  'vue/no-static-inline-styles': 'error',
  'vue/no-template-target-blank': 'error',
  'vue/no-undef-components': 'error',
  'vue/no-undef-properties': 'error',
  'vue/no-unused-emit-declarations': 'error',
  'vue/no-unused-refs': 'error',
  'vue/no-use-v-else-with-v-for': 'error',
  'vue/padding-line-between-blocks': ['error', 'always'],
  'vue/padding-line-between-tags': 'error',
  'vue/prefer-define-options': 'error',
  'vue/prefer-separate-static-class': 'error',
  'vue/prefer-true-attribute-shorthand': 'error',
  'vue/prefer-use-template-ref': 'error',
  'vue/require-default-prop': 'off',
  'vue/require-emit-validator': 'error',
  'vue/require-macro-variable-name': 'error',
  'vue/require-typed-ref': 'error',
  'vue/slot-name-casing': 'error',
  'vue/v-for-delimiter-style': 'error',
  'vue/v-on-handler-style': 'error',
};

export type VueConfigOptions = {
  version: string;
};

export const createVueConfig = (
  {
    vue,
    additionalCodeFiles = [],
    additionalTypedFiles = [],
    additionalResolverExtensions = [],
    additionalStylisticFiles = [],
    languageConfigs = [],
    stylisticIgnores = [],
    ...options
  }: BaseProtoConfigOptions & { vue: VueConfigOptions },
  ...overrides: Parameters<typeof defineConfig>
): ReturnType<typeof defineConfig> => {
  const { tsconfigRootDir } = options;

  const vueLanguageConfigs = defineConfig(
    {
      name: 'proto/vue',

      files: vueFiles,

      extends: [vuePlugin.configs['flat/recommended-error'], vueAccessibility.configs['flat/recommended']],

      languageOptions: {
        parser: vueParser,
        parserOptions: {
          parser: tseslint.parser,
          projectService: true,
          tsconfigRootDir,
          extraFileExtensions: ['.vue'],
        },
      },
    },
  );

  return defineConfig(
    createBaseConfig({
      ...options,
      additionalCodeFiles: [...vueFiles, ...additionalCodeFiles],
      additionalTypedFiles: [...vueFiles, ...additionalTypedFiles],
      additionalResolverExtensions: ['.vue', ...additionalResolverExtensions],
      additionalStylisticFiles: [...vueFiles, ...additionalStylisticFiles],
      languageConfigs: [...vueLanguageConfigs, ...languageConfigs],
      stylisticIgnores,
    }),
    {
      name: 'proto/vue-rules',

      files: vueFiles,

      rules: {
        ...vueRules,
        'vue/no-unsupported-features': ['error', { version: vue.version }],
        'vuejs-accessibility/label-has-for': [
          'error',
          {
            required: {
              some: ['nesting', 'id'],
            },
          },
        ],
        'vuejs-accessibility/no-aria-hidden-on-focusable': 'error',
        'vuejs-accessibility/no-role-presentation-on-focusable': 'error',
      },
    },
    {
      name: 'proto/vue-stylistic',

      files: vueFiles,
      ignores: stylisticIgnores,

      rules: vueStylisticRules,
    },
    ...overrides,
  );
};
