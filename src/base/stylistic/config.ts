import stylistic from '@stylistic/eslint-plugin';
import type { defineConfig } from 'eslint/config';

const stylisticBaseline = stylistic.configs.customize({
  semi: true,
  jsx: false,
  arrowParens: true,
  braceStyle: '1tbs',
  quoteProps: 'as-needed',
});

export const linebreakConfig = {
  plugins: {
    '@stylistic': stylistic,
  },
  rules: {
    '@stylistic/linebreak-style': ['error', 'unix'],
  },
} satisfies Parameters<typeof defineConfig>[number];

export const stylisticConfig = {
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
} satisfies Parameters<typeof defineConfig>[number];
