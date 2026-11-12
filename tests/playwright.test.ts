import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import playwrightPlugin from 'eslint-plugin-playwright';
import { beforeAll, describe, it } from 'vitest';
import { createProtoConfig } from '@protoapps/eslint-config';
import type { TestConfigOptions, TestESLint } from '#tests/types.js';
import type { ProtoConfigOptions } from '@protoapps/eslint-config';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const consumerRoot = join(packageRoot, 'tests/fixtures/playwright-consumer');

const createEslint = async (options: TestConfigOptions = {}): Promise<TestESLint> => new ESLint({
  cwd: consumerRoot,
  overrideConfigFile: true,
  overrideConfig: await createProtoConfig({
    tsconfigRootDir: consumerRoot, playwright: true, ...options,
  }),
});

describe('Playwright integration', () => {
  let baseline: TestESLint;

  beforeAll(async () => {
    baseline = await createEslint();
  });

  it('validates object file patterns and ignores', async () => {
    for (const playwright of [null, 1, 'true', {}, { files: [] }, { files: [''] }, { files: ['  '] }, { files: [1] },
      { files: '**/*.ts' }, { files: ['**/*.ts'], ignores: 'src/**' }, { files: ['**/*.ts'], ignores: [null] },
      { files: ['**/*.ts'], ignores: ['  '] }]) {
      await assert.rejects(() => createProtoConfig({
        tsconfigRootDir: consumerRoot,
        playwright: playwright as unknown as ProtoConfigOptions['playwright'],
      }), /playwright.*files.*ignores/is);
    }
  });

  it('defaults only to pwtest.ts, including tests inside playwright directories', async () => {
    const eslint = baseline;

    for (const filename of ['src/sample.pwtest.ts', 'tests/playwright/example.pwtest.ts']) {
      const config = await eslint.calculateConfigForFile(filename);
      assert.equal(config?.plugins?.playwright, playwrightPlugin, filename);
      assert.equal(config.languageOptions.globals?.window, undefined);
      assert.equal(config.languageOptions.globals?.process, undefined);
    }

    for (const filename of ['src/standard.ts', 'src/example.test.ts', 'src/example.pwtest.js', 'src/sample.vitest.ts',
      'src/example.test-d.ts', 'playwright.config.ts', 'tests/playwright/fixtures.ts', 'tests/playwright/gallery/main.ts']) {
      const config = await eslint.calculateConfigForFile(filename);
      assert.ok(config !== undefined);
      assert.equal(config.plugins?.playwright, undefined, filename);
      assert.equal(config.rules['no-debugger']?.[0], 2, filename);
    }
  });

  it('supports custom scopes and excludes only the requested files and protective patterns', async () => {
    const eslint = await createEslint({ playwright: {
      files: ['src/**/*.test.ts', 'tests/playwright/**', '**/*.js'],
      ignores: ['src/ignored/**', 'tests/playwright/gallery/**'],
    } });

    for (const filename of ['src/example.test.ts', 'tests/playwright/fixtures.ts', 'tests/playwright/helpers.ts']) {
      const config = await eslint.calculateConfigForFile(filename);
      assert.equal(config?.plugins?.playwright, playwrightPlugin, filename);
    }

    for (const filename of ['src/sample.pwtest.ts', 'src/ignored/example.test.ts', 'tests/playwright/gallery/main.ts',
      'tests/playwright/example.vitest.ts', 'tests/playwright/example.test-d.ts', 'src/example.vitest.js', 'src/example.test-d.js']) {
      const config = await eslint.calculateConfigForFile(filename);
      assert.ok(config !== undefined);
      assert.equal(config.plugins?.playwright, undefined, filename);
      assert.equal(config.rules['no-debugger']?.[0], 2, filename);
    }
  });

  it('preserves base typed settings and scopes the fixture parameter override to Playwright', async () => {
    const playwright = await baseline.calculateConfigForFile('src/sample.pwtest.ts');
    const ordinary = await baseline.calculateConfigForFile('src/standard.ts');
    assert.ok(playwright !== undefined && ordinary !== undefined);

    assert.equal(playwright.languageOptions.parser, ordinary.languageOptions.parser);
    assert.equal(playwright.languageOptions.parserOptions.projectService, true);
    assert.equal(playwright.languageOptions.parserOptions.tsconfigRootDir, consumerRoot);
    assert.equal(playwright.rules['@typescript-eslint/no-floating-promises']?.[0], 2);
    assert.equal(playwright.rules['@typescript-eslint/unbound-method']?.[0], 2);
    assert.deepEqual(playwright.rules['no-empty-pattern'], [2, { allowObjectPatternsAsParameters: true }]);
    assert.deepEqual(ordinary.rules['no-empty-pattern'], [2, { allowObjectPatternsAsParameters: false }]);
  });
});
