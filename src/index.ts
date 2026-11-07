import { createRequire } from 'node:module';
import { createProtoConfig as createBaseConfig } from './base.js';
import type { defineConfig } from 'eslint/config';
import type { ProtoConfigOptions as BaseProtoConfigOptions } from './base.js';
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

export type { VueConfigOptions } from './integrations/vue.js';

export type ProtoConfigOptions = BaseProtoConfigOptions & {
  vue?: false | VueConfigOptions;
};

export const createProtoConfig = (
  { vue, ...options }: ProtoConfigOptions,
  ...overrides: Parameters<typeof defineConfig>
): ReturnType<typeof defineConfig> => {
  if (vue === undefined || vue === false) {
    return createBaseConfig(options, ...overrides);
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

  return createVueConfig({ ...options, vue }, ...overrides);
};
