import type { defineConfig } from 'eslint/config';

export type BaseConfigOptions = {
  tsconfigRootDir: string;

  additionalCodeFiles?: Array<string>;
  additionalTypedFiles?: Array<string>;
  additionalResolverExtensions?: Array<string>;
  stylisticIgnores?: Array<string>;
  additionalStylisticFiles?: Array<string>;
  languageConfigs?: Parameters<typeof defineConfig>;
};

export type BaseConfigContext = {
  tsconfigRootDir: string;
  codeFiles: Array<string>;
  typedFiles: Array<string>;
  additionalResolverExtensions: Array<string>;
  stylisticIgnores: Array<string>;
  additionalStylisticFiles: Array<string>;
  languageConfigs: Parameters<typeof defineConfig>;
};
