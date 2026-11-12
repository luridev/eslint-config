import { join } from 'node:path';
import { defineConfig } from 'eslint/config';
import { createTypeScriptImportResolver, defaultExtensions } from 'eslint-import-resolver-typescript';
import { createNodeResolver } from 'eslint-plugin-import-x';
import { importPlugins, importRules, unusedRules } from './imports/config.js';
import { coreRules, javascriptConfig, regexpRules } from './javascript/config.js';
import { packageJsonConfig } from './packageJson/config.js';
import { linebreakConfig, stylisticConfig } from './stylistic/config.js';
import { typescriptConfig, typescriptFiles, typescriptRules } from './typescript/config.js';
import type { BaseConfigContext, BaseConfigOptions } from './types.js';

const defineBaseConfig = ({
  tsconfigRootDir,
  codeFiles,
  typedFiles,
  additionalResolverExtensions,
  stylisticIgnores,
  additionalStylisticFiles,
  languageConfigs,
}: BaseConfigContext) => defineConfig(
  {
    name: 'proto/linter-options',

    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
      reportUnusedInlineConfigs: 'warn',
    },
  },

  packageJsonConfig,

  {
    ...javascriptConfig,
    name: 'proto/javascript',
    files: codeFiles,
    plugins: { 'import-x': importPlugins['import-x'], ...javascriptConfig.plugins, 'unused-imports': importPlugins['unused-imports'] },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          extensions: [...defaultExtensions, ...additionalResolverExtensions],
          project: join(tsconfigRootDir, 'tsconfig.json'),
        }),
        createNodeResolver(),
      ],
    },
  },

  {
    ...typescriptConfig,
    name: 'proto/typescript',
    files: typedFiles,
  },

  {
    name: 'proto/typescript-project-service',

    files: typescriptFiles,

    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
  },

  ...languageConfigs,

  {
    name: 'proto/common-rules',

    files: codeFiles,

    rules: {
      ...coreRules,
      ...importRules,
      ...regexpRules,
      ...unusedRules,
    },
  },

  {
    name: 'proto/typescript-rules',

    files: typedFiles,

    rules: typescriptRules,
  },

  {
    ...linebreakConfig,
    name: 'proto/linebreaks',
    files: ['**/*.{js,ts}', ...additionalStylisticFiles],
    ignores: stylisticIgnores,
  },

  {
    ...stylisticConfig,
    name: 'proto/stylistic',
    files: [...typescriptFiles, ...additionalStylisticFiles],
    ignores: stylisticIgnores,
  },
);

export const createBaseConfig = ({
  tsconfigRootDir,
  additionalCodeFiles = [],
  additionalTypedFiles = [],
  additionalResolverExtensions = [],
  stylisticIgnores = [],
  additionalStylisticFiles = [],
  languageConfigs = [],
}: BaseConfigOptions, ...overrides: Parameters<typeof defineConfig>): ReturnType<typeof defineConfig> => {
  const codeFiles = ['**/*.{js,ts}', ...additionalCodeFiles];
  const typedFiles = [...typescriptFiles, ...additionalTypedFiles];

  return defineConfig(defineBaseConfig({
    tsconfigRootDir,
    codeFiles,
    typedFiles,
    additionalResolverExtensions,
    stylisticIgnores,
    additionalStylisticFiles,
    languageConfigs,
  }), ...overrides);
};
