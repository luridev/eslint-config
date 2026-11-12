import js from '@eslint/js';
import regexp from 'eslint-plugin-regexp';
import type { Linter } from 'eslint';
import type { defineConfig } from 'eslint/config';

const plugins: NonNullable<Linter.Config['plugins']> = { regexp };

export const javascriptConfig = {
  extends: [js.configs.recommended],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins,
} satisfies Parameters<typeof defineConfig>[number];

export const coreRules: Linter.RulesRecord = {
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  curly: ['error', 'all'],
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-return-assign': ['error', 'always'],
  'no-debugger': 'error',
  'no-promise-executor-return': 'error',
  'no-self-compare': 'error',
  'no-template-curly-in-string': 'error',
  'no-eval': 'error',
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

export const regexpRules: Linter.RulesRecord = {
  'regexp/no-dupe-disjunctions': 'error',
  'regexp/no-missing-g-flag': 'error',
  'regexp/no-useless-dollar-replacements': 'error',
  'regexp/no-super-linear-backtracking': ['error', { report: 'certain' }],
};
