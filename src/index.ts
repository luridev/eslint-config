import { createRequire } from 'node:module';
import { defineConfig } from 'eslint/config';
import { createProtoConfig as createBaseConfig } from './base.js';
import type { ProtoConfigOptions as BaseProtoConfigOptions } from './base.js';
import type { VitestConfigOptions } from './integrations/vitest.js';
import type * as VitestIntegration from './integrations/vitest.js';
import type { VueConfigOptions } from './integrations/vue.js';
import type * as VueIntegration from './integrations/vue.js';

const require = createRequire(import.meta.url);
const vuePeerDependencies = ['eslint-plugin-vue', 'vue-eslint-parser', 'eslint-plugin-vuejs-accessibility'];

const isVueConfigOptions = (value: unknown): value is VueConfigOptions => (
  typeof value === 'object'
  && value !== null
  && 'version' in value
  && typeof value.version === 'string'
  && value.version.trim().length > 0
);

const isVitestConfigOptions = (value: unknown): value is VitestConfigOptions => (
  typeof value === 'object'
  && value !== null
  && 'files' in value
  && Array.isArray(value.files)
  && value.files.length > 0
  && value.files.every((pattern: unknown) => typeof pattern === 'string' && pattern.trim().length > 0)
  && (!('ignores' in value) || value.ignores === undefined || (Array.isArray(value.ignores)
    && value.ignores.every((pattern: unknown) => typeof pattern === 'string' && pattern.trim().length > 0)))
);

const createConfigWithVue = ({ vue, ...options }: BaseProtoConfigOptions & { vue?: false | VueConfigOptions }) => {
  if (vue === undefined || vue === false) {
    return createBaseConfig(options);
  }

  if (!isVueConfigOptions(vue)) {
    throw new TypeError('@protoapps/eslint-config: vue must be false or an object with a non-empty version string.');
  }

  const missing = vuePeerDependencies.filter((name) => {
    try {
      require.resolve(name);

      return false;
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'MODULE_NOT_FOUND') {
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

  // Load the private ESM graph lazily, preserving the plugins' ESM identities.
  // Errors inside installed plugins must retain their original diagnostics.
  const { createVueConfig } = require('./integrations/vue.js') as typeof VueIntegration;

  return createVueConfig({ ...options, vue });
};

export type { VueConfigOptions } from './integrations/vue.js';
export type { VitestConfigOptions } from './integrations/vitest.js';

export type ProtoConfigOptions = BaseProtoConfigOptions & {
  vue?: false | VueConfigOptions;
  vitest?: boolean | VitestConfigOptions;
};

export const createProtoConfig = (
  { vitest, ...options }: ProtoConfigOptions,
  ...overrides: Parameters<typeof defineConfig>
): ReturnType<typeof defineConfig> => {
  if (vitest === undefined || vitest === false) {
    return defineConfig(createConfigWithVue(options), ...overrides);
  }

  const vitestOptions = vitest === true ? { files: ['**/*.vitest.ts'] } : vitest;

  if (!isVitestConfigOptions(vitestOptions)) {
    throw new TypeError(
      '@protoapps/eslint-config: vitest must be false, true, or an object with a non-empty files array of patterns and optional ignores array.',
    );
  }

  try {
    require.resolve('@vitest/eslint-plugin');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'MODULE_NOT_FOUND') {
      throw new Error(
        '@protoapps/eslint-config: Vitest requires the missing optional peer dependency @vitest/eslint-plugin. '
        + 'Install it with: npm install --save-dev @vitest/eslint-plugin',
        { cause: error },
      );
    }

    throw error;
  }

  // Keep the ESM plugin identity and propagate errors from installed dependencies.
  const { createVitestConfig } = require('./integrations/vitest.js') as typeof VitestIntegration;

  return defineConfig(createConfigWithVue(options), createVitestConfig(vitestOptions), ...overrides);
};
