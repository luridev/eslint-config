import type { defineConfig } from 'eslint/config';
import type { ProtoConfigOptions as BaseProtoConfigOptions } from '../../base.js';

export type VueConfigOptions = {
  version: string;
};

export type VueConfigResult = {
  baseOptions: BaseProtoConfigOptions;
  configs: ReturnType<typeof defineConfig>;
};
