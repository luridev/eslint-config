import { createProtoConfig, type VitestConfigOptions, type VueConfigOptions } from '@protoapps/eslint-config';
import { defineConfig } from 'eslint/config';

const vue: VueConfigOptions = { version: '3.5.40' };

const pending: Promise<ReturnType<typeof defineConfig>> = createProtoConfig({ tsconfigRootDir: '.' });
defineConfig(await pending);

// @ts-expect-error Programmatic composition requires the resolved config array.
defineConfig(pending);

// @ts-expect-error A Promise cannot be spread before awaiting it.
[...pending];

export const vueConfig = createProtoConfig({
  tsconfigRootDir: '.',
  vue,
});

// @ts-expect-error Vue requires an explicit compatibility target.
createProtoConfig({ tsconfigRootDir: '.', vue: true });

// @ts-expect-error An enabled Vue integration must specify its version.
createProtoConfig({ tsconfigRootDir: '.', vue: {} });

const vitest: VitestConfigOptions = { files: ['src/**/*.test.ts'], ignores: ['src/node-tests/**'] };
createProtoConfig({ tsconfigRootDir: '.', vitest });
createProtoConfig({ tsconfigRootDir: '.', vitest: true, vue });
createProtoConfig({ tsconfigRootDir: '.', vitest: false });

// @ts-expect-error Object options require explicit file patterns.
createProtoConfig({ tsconfigRootDir: '.', vitest: {} });

// @ts-expect-error Public declarations must not implicitly introduce Node globals.
process.version;
