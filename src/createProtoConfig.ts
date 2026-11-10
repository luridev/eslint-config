import { defineConfig } from 'eslint/config';
import { createProtoConfig as createBaseConfig } from './base.js';
import { getPlaywrightConfig } from './integrations/playwright/getPlaywrightConfig.js';
import { getVitestConfig } from './integrations/vitest/getVitestConfig.js';
import { getVueConfig } from './integrations/vue/getVueConfig.js';
import type { ProtoConfigOptions } from './types.js';

export const createProtoConfig = async (
  { vue, vitest, playwright, ...options }: ProtoConfigOptions,
  ...overrides: Parameters<typeof defineConfig>
): Promise<ReturnType<typeof defineConfig>> => {
  const vueConfig = await getVueConfig(vue, options);
  const vitestConfig = await getVitestConfig(vitest);
  const playwrightConfig = await getPlaywrightConfig(playwright);

  return defineConfig(
    createBaseConfig(vueConfig.baseOptions),
    vueConfig.configs,
    vitestConfig,
    playwrightConfig,
    ...overrides,
  );
};
