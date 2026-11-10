import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import { vueAccessibilityRules, vueFiles, vuePeerDependencies, vueRules, vueStylisticRules } from './config.js';
import type { ProtoConfigOptions as BaseProtoConfigOptions } from '../../base.js';
import type { VueConfigOptions, VueConfigResult } from './types.js';

const isVueConfigOptions = (value: unknown): value is VueConfigOptions => (
  typeof value === 'object'
  && value !== null
  && 'version' in value
  && typeof value.version === 'string'
  && value.version.trim().length > 0
);

export const getVueConfig = async (
  vue: false | VueConfigOptions | undefined,
  options: BaseProtoConfigOptions,
): Promise<VueConfigResult> => {
  if (vue === undefined || vue === false) {
    return { baseOptions: options, configs: [] };
  }

  if (!isVueConfigOptions(vue)) {
    throw new TypeError('@protoapps/eslint-config: vue must be false or an object with a non-empty version string.');
  }

  const missing = vuePeerDependencies.filter((name) => {
    try {
      import.meta.resolve(name);

      return false;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ERR_MODULE_NOT_FOUND') {
        return true;
      }

      throw error;
    }
  });

  if (missing.length > 0) {
    throw new Error(
      `@protoapps/eslint-config: Vue requires missing optional peer dependencies: ${missing.join(', ')}. `
      + `Install them with: npm install --save-dev ${missing.join(' ')}`,
    );
  }

  const [{ default: vuePlugin }, { default: vueAccessibility }, { default: vueParser }] = await Promise.all([
    import('eslint-plugin-vue'),
    import('eslint-plugin-vuejs-accessibility'),
    import('vue-eslint-parser'),
  ]);

  const { tsconfigRootDir, stylisticIgnores = [] } = options;

  const vueLanguageConfigs = defineConfig({
    name: 'proto/vue',
    files: vueFiles,
    extends: [vuePlugin.configs['flat/recommended-error'], vueAccessibility.configs['flat/recommended']],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        projectService: true,
        tsconfigRootDir,
        extraFileExtensions: ['.vue'],
      },
    },
  });

  return {
    baseOptions: {
      ...options,
      additionalCodeFiles: [...vueFiles, ...options.additionalCodeFiles ?? []],
      additionalTypedFiles: [...vueFiles, ...options.additionalTypedFiles ?? []],
      additionalResolverExtensions: ['.vue', ...options.additionalResolverExtensions ?? []],
      additionalStylisticFiles: [...vueFiles, ...options.additionalStylisticFiles ?? []],
      languageConfigs: [...vueLanguageConfigs, ...options.languageConfigs ?? []],
    },
    configs: defineConfig(
      {
        name: 'proto/vue-rules',
        files: vueFiles,
        rules: {
          ...vueRules,
          'vue/no-unsupported-features': ['error', { version: vue.version }],
          ...vueAccessibilityRules,
        },
      },
      {
        name: 'proto/vue-stylistic',
        files: vueFiles,
        ignores: stylisticIgnores,
        rules: vueStylisticRules,
      },
    ),
  };
};
