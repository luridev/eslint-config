import { join } from 'node:path';
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig } from 'eslint/config';
import { createTypeScriptImportResolver, defaultExtensions } from 'eslint-import-resolver-typescript';
import packageJson from 'eslint-package-json';
import importX, { createNodeResolver } from 'eslint-plugin-import-x';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';
import type { Linter } from 'eslint';

const typescriptFiles = ['**/*.ts'];

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
  codeFiles: Array<string>;
  typedFiles: Array<string>;
  additionalResolverExtensions: Array<string>;
  stylisticIgnores: Array<string>;
  additionalStylisticFiles: Array<string>;
  languageConfigs: Array<Linter.Config>;
};

const defineProtoConfig = ({
  tsconfigRootDir,
  codeFiles,
  typedFiles,
  additionalResolverExtensions,
  stylisticIgnores,
  additionalStylisticFiles,
  languageConfigs,
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
          extensions: [...defaultExtensions, ...additionalResolverExtensions],
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

  ...languageConfigs,

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
    name: 'proto/linebreaks',

    files: ['**/*.{js,ts}', ...additionalStylisticFiles],
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

    files: [...typescriptFiles, ...additionalStylisticFiles],
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
);

export type ProtoConfigOptions = {
  tsconfigRootDir: string;

  additionalCodeFiles?: Array<string>;
  additionalTypedFiles?: Array<string>;
  additionalResolverExtensions?: Array<string>;
  stylisticIgnores?: Array<string>;
  /** Additional files for both the formatting baseline and LF policy. */
  additionalStylisticFiles?: Array<string>;
  /** Language presets/parser settings, after JS/TS presets and before explicit policy rules. */
  languageConfigs?: Array<Linter.Config>;
};

export const createProtoConfig = ({
  tsconfigRootDir,
  additionalCodeFiles = [],
  additionalTypedFiles = [],
  additionalResolverExtensions = [],
  stylisticIgnores = [],
  additionalStylisticFiles = [],
  languageConfigs = [],
}: ProtoConfigOptions, ...overrides: Array<Linter.Config>): Array<Linter.Config> => {
  const codeFiles = ['**/*.{js,ts}', ...additionalCodeFiles];
  const typedFiles = [...typescriptFiles, ...additionalTypedFiles];

  return defineConfig(defineProtoConfig({
    tsconfigRootDir,
    codeFiles,
    typedFiles,
    additionalResolverExtensions,
    stylisticIgnores,
    additionalStylisticFiles,
    languageConfigs,
  }), ...overrides);
};
