import vitest from '@vitest/eslint-plugin';
import { defineConfig } from 'eslint/config';
import type { Linter } from 'eslint';

const vitestRules: Linter.RulesRecord = {
  'vitest/consistent-test-it': ['error', { fn: 'it', withinDescribe: 'it' }],
  'vitest/consistent-vitest-vi': ['error', { fn: 'vi' }],
  'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'assert'] }],
  'vitest/hoisted-apis-on-top': 'error',
  'vitest/max-nested-describe': ['error', { max: 3 }],
  'vitest/no-alias-methods': 'error',
  'vitest/no-commented-out-tests': 'error',
  'vitest/no-conditional-expect': 'error',
  'vitest/no-conditional-tests': 'error',
  'vitest/no-disabled-tests': 'error',
  'vitest/no-duplicate-hooks': 'error',
  'vitest/no-focused-tests': 'error',
  'vitest/no-identical-title': 'error',
  'vitest/no-import-node-test': 'error',
  'vitest/no-interpolation-in-snapshots': 'error',
  'vitest/no-large-snapshots': ['error', { maxSize: 50, inlineMaxSize: 20 }],
  'vitest/no-mocks-import': 'error',
  'vitest/no-standalone-expect': 'error',
  'vitest/no-test-prefixes': 'error',
  'vitest/no-unneeded-async-expect-function': 'error',
  'vitest/prefer-called-once': 'error',
  'vitest/prefer-comparison-matcher': 'error',
  'vitest/prefer-each': 'error',
  'vitest/prefer-equality-matcher': 'error',
  'vitest/prefer-expect-assertions': ['error', {
    onlyFunctionsWithExpectInLoop: true,
    onlyFunctionsWithExpectInCallback: true,
    disallowHasAssertions: false,
  }],
  'vitest/prefer-expect-resolves': 'error',
  'vitest/prefer-expect-type-of': 'error',
  'vitest/prefer-hooks-in-order': 'error',
  'vitest/prefer-hooks-on-top': 'error',
  'vitest/prefer-import-in-mock': 'error',
  'vitest/prefer-importing-vitest-globals': 'error',
  'vitest/prefer-snapshot-hint': ['error', 'multi'],
  'vitest/prefer-spy-on': 'error',
  'vitest/prefer-strict-boolean-matchers': 'error',
  'vitest/prefer-strict-equal': 'error',
  'vitest/prefer-to-be-object': 'error',
  'vitest/prefer-to-be': 'error',
  'vitest/prefer-to-contain': 'error',
  'vitest/prefer-to-have-been-called-times': 'error',
  'vitest/prefer-to-have-length': 'error',
  'vitest/prefer-todo': 'error',
  'vitest/prefer-vi-mocked': 'error',
  'vitest/require-hook': 'error',
  'vitest/require-local-test-context-for-concurrent-snapshots': 'error',
  'vitest/require-to-throw-message': 'error',
  'vitest/require-top-level-describe': 'error',
  'vitest/valid-describe-callback': 'error',
  'vitest/valid-expect-in-promise': 'error',
  'vitest/valid-expect': ['error', { alwaysAwait: false, minArgs: 1, maxArgs: 2 }],
  'vitest/valid-title': 'error',
};

export type VitestConfigOptions = {
  files: Array<string>;
  ignores?: Array<string>;
};

export const createVitestConfig = ({ files, ignores = [] }: VitestConfigOptions): ReturnType<typeof defineConfig> => {
  const excludedFiles = ['**/*.pwtest.*', '**/playwright/**', '**/*.test-d.*', ...ignores];

  return defineConfig(
    {
      name: 'proto/vitest',
      files,
      ignores: excludedFiles,
      plugins: { vitest },
      settings: { vitest: { typecheck: false } },
      rules: vitestRules,
    },
    {
      name: 'proto/vitest-typescript',
      files: files.map((pattern) => [pattern, '**/*.ts']),
      ignores: excludedFiles,
      settings: { vitest: { typecheck: true } },
      rules: {
        'vitest/unbound-method': 'error',
        '@typescript-eslint/unbound-method': 'off',
      },
    },
  );
};
