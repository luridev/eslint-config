import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import { createProtoConfig } from './src/index.js';

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig(
  globalIgnores(['dist/**', 'tests/fixtures/**']),
  ...createProtoConfig({
    tsconfigRootDir,
    vueVersion: '3.5.40',
  }),
  {
    name: 'repo/node',
    files: ['**/*.{js,ts}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    name: 'repo/eslint-config',
    files: ['eslint.config.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': 'off',
    },
  },
);
