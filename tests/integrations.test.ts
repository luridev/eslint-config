import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { ESLint } from 'eslint';
import { beforeAll, describe, it } from 'vitest';
import { createProtoConfig } from '@protoapps/eslint-config';
import type { ConfigOverrides, TestESLint } from '#tests/types.js';
import type { ProtoConfigOptions } from '@protoapps/eslint-config';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const consumerRoot = join(packageRoot, 'tests/fixtures/vue-consumer');

const runFixture = (name: string) => promisify(execFile)(
  process.execPath,
  [join(packageRoot, 'tests/fixtures/integrations', `${name}.mjs`)],
  { cwd: packageRoot, windowsHide: true, timeout: 30_000 },
);

describe('Integration composition', () => {
  let eslint: TestESLint;

  // Cold optional imports and ESLint initialization belong to setup, not the assertion timeout.
  beforeAll(async () => {
    eslint = new ESLint({
      cwd: consumerRoot,
      overrideConfigFile: true,
      overrideConfig: await createProtoConfig(
        { tsconfigRootDir: consumerRoot, vue: { version: '3.5.40' }, vitest: true, playwright: true },
        { files: ['**/*.pwtest.ts'], rules: { 'playwright/no-focused-test': 'warn' } },
        [[
          { files: ['**/*.vue'], extends: [{ rules: { 'vue/no-static-inline-styles': 'off', 'vuejs-accessibility/alt-text': 'off' } }] },
          { files: ['**/*.vitest.ts'], rules: { 'vitest/no-focused-tests': 'off' } },
          { files: ['**/*.pwtest.ts'], rules: { 'playwright/no-focused-test': 'off' } },
          { files: ['**/*.legacy.js'], rules: { 'check-file/filename-naming-convention': 'off' } },
          {
            files: ['externalFiles/**/*.js'],
            rules: { 'check-file/filename-naming-convention': ['error', { '**/*.js': 'KEBAB_CASE' }] },
          },
          { rules: { 'no-debugger': 'off', '@stylistic/semi': 'off' } },
        ]],
      ),
    });

    await eslint.calculateConfigForFile('src/standard.ts');
  }, 30_000);

  it('keeps all integrations scoped and applies final overrides after every preset', async () => {
    const vue = await eslint.calculateConfigForFile('src/component.vue');
    const vitest = await eslint.calculateConfigForFile('src/example.vitest.ts');
    const playwright = await eslint.calculateConfigForFile('src/example.pwtest.ts');
    const ordinary = await eslint.calculateConfigForFile('src/standard.ts');
    assert.ok(vue !== undefined && vitest !== undefined && playwright !== undefined && ordinary !== undefined);

    assert.ok(vue.plugins?.vue !== undefined);
    assert.ok(Object.hasOwn(vue.plugins, 'vuejs-accessibility'));
    assert.equal(vue.plugins.vitest, undefined);
    assert.equal(vue.plugins.playwright, undefined);
    assert.ok(vitest.plugins?.vitest !== undefined);
    assert.equal(vitest.plugins.vue, undefined);
    assert.equal(vitest.plugins.playwright, undefined);
    assert.ok(playwright.plugins?.playwright !== undefined);
    assert.equal(playwright.plugins.vue, undefined);
    assert.equal(playwright.plugins.vitest, undefined);

    for (const plugin of ['vue', 'vuejs-accessibility', 'vitest', 'playwright']) {
      assert.equal(ordinary.plugins?.[plugin], undefined);
    }

    assert.equal(vue.rules['vue/no-static-inline-styles']?.[0], 0);
    assert.equal(vue.rules['vuejs-accessibility/alt-text']?.[0], 0);
    assert.equal(vitest.rules['vitest/no-focused-tests']?.[0], 0);
    assert.equal(playwright.rules['playwright/no-focused-test']?.[0], 0);

    for (const config of [vue, vitest, playwright, ordinary]) {
      assert.equal(config.rules['no-debugger']?.[0], 0);
      assert.equal(config.rules['@stylistic/semi']?.[0], 0);
    }

    const disabledNaming = await eslint.calculateConfigForFile('src/example.legacy.js');
    const customNaming = await eslint.calculateConfigForFile('externalFiles/example.js');
    assert.ok(disabledNaming !== undefined && customNaming !== undefined);
    assert.equal(disabledNaming.rules['check-file/filename-naming-convention']?.[0], 0);
    assert.deepEqual(customNaming.rules['check-file/filename-naming-convention'], [2, { '**/*.js': 'KEBAB_CASE' }]);
    assert.equal(ordinary.rules['check-file/filename-naming-convention']?.[0], 2);

    for (const config of [disabledNaming, customNaming, ordinary]) {
      assert.equal(config.rules['check-file/folder-naming-convention']?.[0], 2);
    }
  });

  it('keeps factory calls independent without mutating consumer options or overrides', async () => {
    const options: ProtoConfigOptions = {
      tsconfigRootDir: consumerRoot,
      vue: { version: '3.5.40' },
      vitest: { files: ['**/*.spec.ts'], ignores: ['src/ignored/**'] },
      additionalCodeFiles: ['**/*.code'],
      additionalTypedFiles: ['**/*.typed'],
      additionalStylisticFiles: ['**/*.styled'],
      additionalResolverExtensions: ['.custom'],
      stylisticIgnores: ['**/generated.ts'],
      languageConfigs: [{ files: ['**/*.ts'], languageOptions: { globals: { consumerGlobal: 'readonly' } } }],
    };

    const overrides: ConfigOverrides = [{ rules: { 'no-debugger': 'off' } }];
    const originalOptions = structuredClone(options);
    const originalOverrides = structuredClone(overrides);
    const firstConfig = await createProtoConfig(options, ...overrides);
    const otherRoot = join(packageRoot, 'tests/fixtures/consumer');
    const secondConfig = await createProtoConfig({ tsconfigRootDir: otherRoot });
    const repeatedConfig = await createProtoConfig(options, ...overrides);
    assert.deepEqual(options, originalOptions);
    assert.deepEqual(overrides, originalOverrides);

    for (const config of [firstConfig, repeatedConfig]) {
      const instance: TestESLint = new ESLint({ cwd: consumerRoot, overrideConfigFile: true, overrideConfig: config });
      const typed = await instance.calculateConfigForFile('src/example.spec.ts');
      const vue = await instance.calculateConfigForFile('src/component.vue');
      const code = await instance.calculateConfigForFile('src/example.code');
      assert.ok(typed !== undefined && vue !== undefined && code !== undefined);
      assert.equal(typed.languageOptions.parserOptions.tsconfigRootDir, consumerRoot);
      assert.equal(typed.languageOptions.globals?.consumerGlobal, 'readonly');
      assert.ok(typed.plugins?.vitest !== undefined);
      assert.ok(vue.plugins?.vue !== undefined);
      assert.equal(code.rules.eqeqeq?.[0], 2);
      assert.equal(typed.rules['no-debugger']?.[0], 0);
    }

    const second: TestESLint = new ESLint({ cwd: otherRoot, overrideConfigFile: true, overrideConfig: secondConfig });
    const ordinary = await second.calculateConfigForFile('src/example.spec.ts');
    assert.ok(ordinary !== undefined);
    assert.equal(ordinary.languageOptions.parserOptions.tsconfigRootDir, otherRoot);
    assert.equal(ordinary.languageOptions.globals?.consumerGlobal, undefined);
    assert.equal(ordinary.plugins?.vitest, undefined);
    assert.equal(ordinary.rules['no-debugger']?.[0], 2);
    assert.equal(await second.calculateConfigForFile('src/component.vue'), undefined);
    assert.equal(await second.calculateConfigForFile('src/example.code'), undefined);
  });
});

describe('Optional peers', () => {
  it('loads no optional plugins for the base and only the enabled plugin for Playwright', async () => {
    await assert.doesNotReject(() => runFixture('lazy-plugins'));
  }, 30_000);
});
