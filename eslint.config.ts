import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import { createProtoConfig } from './src/index.js';

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig(
  globalIgnores(['dist/**', 'tests/fixtures/**']),
  await createProtoConfig({
    tsconfigRootDir,
    vitest: { files: ['tests/*.test.ts'] },
  }),
  {
    name: 'repo/node',
    files: ['**/*.{js,ts}'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    name: 'repo/internal-imports',
    files: ['eslint.config.ts', 'src/index.ts', 'src/integrations/vue.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': 'off',
    },
  },
);
