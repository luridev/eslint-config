import packageJson from 'eslint-package-json';
import type { defineConfig } from 'eslint/config';

export const packageJsonConfig = {
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
} satisfies Parameters<typeof defineConfig>[number];
