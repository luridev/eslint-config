import importX from 'eslint-plugin-import-x';
import unusedImports from 'eslint-plugin-unused-imports';
import type { Linter } from 'eslint';

export const importPlugins: NonNullable<Linter.Config['plugins']> = { 'import-x': importX, 'unused-imports': unusedImports };

export const importRules: Linter.RulesRecord = {
  'import-x/no-extraneous-dependencies': ['error', { includeTypes: true }],
  'sort-imports': [
    'error',
    {
      ignoreDeclarationSort: true,
      ignoreMemberSort: false,
      ignoreCase: true,
    },
  ],
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

export const unusedRules: Linter.RulesRecord = {
  'no-unused-vars': 'off',
  '@typescript-eslint/no-unused-vars': 'off',
  'unused-imports/no-unused-imports': 'error',
  'unused-imports/no-unused-vars': ['warn', { args: 'after-used', argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
};
