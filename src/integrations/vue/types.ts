import type { defineConfig } from 'eslint/config';
import type { BaseConfigOptions } from '../../base/types.js';

export type VueConfigOptions = {
  version: string;
};

export type VueConfigResult = {
  baseOptions: BaseConfigOptions;
  configs: ReturnType<typeof defineConfig>;
};
