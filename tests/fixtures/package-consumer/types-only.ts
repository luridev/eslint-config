import { createProtoConfig, type VueConfigOptions } from '@protoapps/eslint-config';

const vue: VueConfigOptions = { version: '3.5.40' };

export const vueConfig = createProtoConfig({
  tsconfigRootDir: '.',
  vue,
});

// @ts-expect-error Vue requires an explicit compatibility target.
createProtoConfig({ tsconfigRootDir: '.', vue: true });

// @ts-expect-error An enabled Vue integration must specify its version.
createProtoConfig({ tsconfigRootDir: '.', vue: {} });

// @ts-expect-error The public Vue options require a string version.
const invalidVue: VueConfigOptions = { version: 3 };

// @ts-expect-error Public declarations must not implicitly introduce Node globals.
process.version;
