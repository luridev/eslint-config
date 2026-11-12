import type { BaseConfigOptions } from './base/types.js';
import type { PlaywrightConfigOptions } from './integrations/playwright/types.js';
import type { VitestConfigOptions } from './integrations/vitest/types.js';
import type { VueConfigOptions } from './integrations/vue/types.js';

export type ProtoConfigOptions = BaseConfigOptions & {
  vue?: false | VueConfigOptions;
  vitest?: boolean | VitestConfigOptions;
  playwright?: boolean | PlaywrightConfigOptions;
};
