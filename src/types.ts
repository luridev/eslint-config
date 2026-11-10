import type { ProtoConfigOptions as BaseProtoConfigOptions } from './base.js';
import type { PlaywrightConfigOptions } from './integrations/playwright/types.js';
import type { VitestConfigOptions } from './integrations/vitest/types.js';
import type { VueConfigOptions } from './integrations/vue/types.js';

export type ProtoConfigOptions = BaseProtoConfigOptions & {
  vue?: false | VueConfigOptions;
  vitest?: boolean | VitestConfigOptions;
  playwright?: boolean | PlaywrightConfigOptions;
};
