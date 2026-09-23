import { join } from 'node:path';
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig } from 'eslint/config';
import { createTypeScriptImportResolver, defaultExtensions } from 'eslint-import-resolver-typescript';
import packageJson from 'eslint-package-json';
import importX, { createNodeResolver } from 'eslint-plugin-import-x';
import unusedImports from 'eslint-plugin-unused-imports';
import vue from 'eslint-plugin-vue';
import vueAccessibility from 'eslint-plugin-vuejs-accessibility';
import tseslint from 'typescript-eslint';
import type { Linter } from 'eslint';

const typescriptFiles = ['**/*.ts'];
const vueFiles = ['**/*.vue'];
const stylisticFiles = [...typescriptFiles, ...vueFiles];

const stylisticBaseline = stylistic.configs.customize({
  semi: true,
  jsx: false,
  arrowParens: true,
  braceStyle: '1tbs',
  quoteProps: 'as-needed',
});

const coreRules: Linter.RulesRecord = {
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  curly: ['error', 'all'],
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-return-assign': ['error', 'always'],
  'no-debugger': 'error',
  'no-console': 'warn',
  'prefer-const': 'error',
  'object-shorthand': 'error',
  'prefer-template': 'warn',
  'no-param-reassign': 'error',
  'no-plusplus': 'error',
  'no-shadow': 'off',
  'no-restricted-imports': 'off',
  'no-restricted-syntax': [
    'error',
    {
      selector: 'ExportNamedDeclaration[declaration=null][source=null]',
      message: 'Export declarations directly where they are defined.',
    },
  ],
};

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

const typescriptRules: Linter.RulesRecord = {
  '@typescript-eslint/consistent-type-imports': 'error',
  '@typescript-eslint/array-type': ['error', { default: 'generic', readonly: 'generic' }],
  '@typescript-eslint/no-shadow': 'warn',
  '@typescript-eslint/switch-exhaustiveness-check': 'warn',
  '@typescript-eslint/member-ordering': ['error', { classes: ['signature', 'field', 'constructor', 'public-method', 'protected-method', 'private-method'] }],
  '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
  '@typescript-eslint/strict-boolean-expressions': ['error', { allowString: false, allowNumber: false, allowNullableObject: false }],
  '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
  '@typescript-eslint/no-restricted-imports': [
    'error',
    {
      patterns: [
        {
          group: ['./**', '../**'],
          message: 'Use the configured alias instead of a relative import.',
        },
      ],
    },
  ],
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

const importRules: Linter.RulesRecord = {
  'sort-imports': 'off',
  'import-x/no-duplicates': ['error', { 'prefer-inline': false }],
  'import-x/no-absolute-path': 'error',
  'import-x/first': 'error',
  'import-x/newline-after-import': 'error',
  'import-x/no-cycle': 'error',
  'import-x/exports-last': 'error',
  'import-x/order': [
    'error',
    {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type', 'object', 'unknown'],
      pathGroups: [
        {
          pattern: '@/**',
          group: 'internal',
          position: 'after',
        },
        {
          pattern: '~/**',
          group: 'internal',
          position: 'after',
        },
      ],
      pathGroupsExcludedImportTypes: ['builtin'],
      alphabetize: {
        order: 'asc',
        caseInsensitive: true,
      },
      sortTypesGroup: true,
      'newlines-between': 'never',
    },
  ],
};

const unusedRules: Linter.RulesRecord = {
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': 'off',
  'unused-imports/no-unused-imports': 'error',
  'unused-imports/no-unused-vars': ['warn', { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
};

type ProtoConfigContext = {
  tsconfigRootDir: string;
  vueVersion: string;
  codeFiles: Array<string>;
  typedFiles: Array<string>;
  additionalResolverExtensions: Array<string>;
  stylisticIgnores: Array<string>;
};

const defineProtoConfig = ({
  tsconfigRootDir,
  vueVersion,
  codeFiles,
  typedFiles,
  additionalResolverExtensions,
  stylisticIgnores,
}: ProtoConfigContext) => defineConfig(
  {
    name: 'proto/linter-options',

    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
      reportUnusedInlineConfigs: 'warn',
    },
  },

  {
    name: 'proto/package-json',

    files: ['**/package.json'],

    extends: [packageJson.configs.recommended],

    rules: {
      'package-json/require-engines': 'off',
      'package-json/sort-scripts': 'error',
      'package-json/consistent-name-casing': 'error',
      'package-json/description-format': 'error',
      'package-json/no-exact-peer-dependencies': 'error',
      'package-json/no-git-dependencies': 'error',
      'package-json/no-local-dependencies': 'error',
    },
  },

  {
    name: 'proto/javascript',

    files: codeFiles,

    extends: [js.configs.recommended],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },

    plugins: {
      'import-x': importX,
      'unused-imports': unusedImports,
    },

    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          extensions: [...defaultExtensions, '.vue', ...additionalResolverExtensions],
          project: join(tsconfigRootDir, 'tsconfig.json'),
        }),
        createNodeResolver(),
      ],
    },
  },

  {
    name: 'proto/typescript',

    files: typedFiles,

    extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
  },

  {
    name: 'proto/typescript-project-service',

    files: typescriptFiles,

    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
  },

  {
    name: 'proto/vue',

    files: vueFiles,

    extends: [vue.configs['flat/recommended-error'], vueAccessibility.configs['flat/recommended']],

    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        projectService: true,
        tsconfigRootDir,
        extraFileExtensions: ['.vue'],
      },
    },
  },

  {
    name: 'proto/common-rules',

    files: codeFiles,

    rules: {
      ...coreRules,
      ...importRules,
      ...unusedRules,
    },
  },

  {
    name: 'proto/typescript-rules',

    files: typedFiles,

    rules: typescriptRules,
  },

  {
    name: 'proto/vue-rules',

    files: vueFiles,

    rules: {
      ...vueRules,
      'vue/no-unsupported-features': ['error', { version: vueVersion }],
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
    name: 'proto/linebreaks',

    files: ['**/*.{js,ts,vue}'],
    ignores: stylisticIgnores,

    plugins: {
      '@stylistic': stylistic,
    },

    rules: {
      '@stylistic/linebreak-style': ['error', 'unix'],
    },
  },

  {
    name: 'proto/stylistic',

    files: stylisticFiles,
    ignores: stylisticIgnores,

    extends: [stylisticBaseline],

    rules: {
      '@stylistic/indent-binary-ops': 'off',
      '@stylistic/operator-linebreak': 'off',
      '@stylistic/function-call-spacing': ['error', 'never'],
      '@stylistic/switch-colon-spacing': ['error', { before: false, after: true }],
      '@stylistic/no-extra-semi': 'error',
      '@stylistic/semi-style': ['error', 'last'],
      '@stylistic/object-property-newline': ['error', { allowAllPropertiesOnSameLine: true }],
      '@stylistic/function-call-argument-newline': ['error', 'consistent'],
      '@stylistic/max-len': [
        'error',
        {
          code: 120,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
        },
      ],
      '@stylistic/padding-line-between-statements': [
        'error',
        {
          blankLine: 'always',
          prev: '*',
          next: [
            'return',
            'multiline-block-like',
            'multiline-const',
            'multiline-expression',
            'multiline-let',
            'multiline-export',
          ],
        },
        {
          blankLine: 'always',
          prev: [
            'multiline-block-like',
            'multiline-const',
            'multiline-expression',
            'multiline-let',
            'multiline-export',
          ],
          next: '*',
        },
      ],
    },
  },

  {
    name: 'proto/vue-stylistic',

    files: vueFiles,
    ignores: stylisticIgnores,

    rules: vueStylisticRules,
  },
);

export type ProtoConfigOptions = {
  tsconfigRootDir: string;
  vueVersion: string;

  additionalCodeFiles?: Array<string>;
  additionalTypedFiles?: Array<string>;
  additionalResolverExtensions?: Array<string>;
  stylisticIgnores?: Array<string>;
};

export const createProtoConfig = ({
  tsconfigRootDir,
  vueVersion,
  additionalCodeFiles = [],
  additionalTypedFiles = [],
  additionalResolverExtensions = [],
  stylisticIgnores = [],
}: ProtoConfigOptions): Array<Linter.Config> => {
  const codeFiles = ['**/*.{js,ts,vue}', ...additionalCodeFiles];
  const typedFiles = ['**/*.{ts,vue}', ...additionalTypedFiles];

  return defineProtoConfig({
    tsconfigRootDir,
    vueVersion,
    codeFiles,
    typedFiles,
    additionalResolverExtensions,
    stylisticIgnores,
  });
};
