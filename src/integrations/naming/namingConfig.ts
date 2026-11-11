import checkFile from 'eslint-plugin-check-file';
import { namingRules } from './config.js';
import type { Linter } from 'eslint';

export const namingConfig: Linter.Config = {
  name: 'proto/naming',
  plugins: { 'check-file': checkFile },
  rules: namingRules,
};
