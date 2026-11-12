import tseslint from 'typescript-eslint';
import type { Linter } from 'eslint';
import type { defineConfig } from 'eslint/config';

export const typescriptFiles = ['**/*.ts'];

export const typescriptConfig = {
  extends: [tseslint.configs.strictTypeChecked, tseslint.configs.stylisticTypeChecked],
} satisfies Parameters<typeof defineConfig>[number];

export const typescriptRules: Linter.RulesRecord = {
  '@typescript-eslint/require-array-sort-compare': ['error', { ignoreStringArrays: true }],
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
