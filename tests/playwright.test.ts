import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import playwrightPlugin from 'eslint-plugin-playwright';
import { describe, it } from 'vitest';
import { createProtoConfig } from '@protoapps/eslint-config';
import type { Linter } from 'eslint';
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

const lint = async (
  source: string, filename = 'src/example.pwtest.js',
) => {
  const eslint = await createEslint({ playwright: { files: ['**/*.pwtest.{js,ts}'] } });
  const [result] = await eslint.lintText(source, { filePath: join(consumerRoot, filename) });
  assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));

  return result.messages;
};

const hasRule = (messages: Array<Linter.LintMessage>, rule: string) => messages.some(({ ruleId }) => ruleId === rule);

describe('Playwright integration', () => {
  it('recognizes assertion helpers and rejects tests without assertions', async () => {
    for (const [body, hasAssertion] of [
      ['expect(1).toBe(1);', true],
      ['expectSomething();', true],
      ['initializeApp();', false],
    ] as const) {
      const messages = await lint(`test.describe('assertions', () => {
  test('runs a scenario', () => { ${body} });
});`);

      const errors = messages.filter(({ ruleId }) => ruleId === 'playwright/expect-expect');
      assert.deepEqual(errors.map(({ severity }) => severity), hasAssertion ? [] : [2], body);
    }
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
    const eslint = await createEslint();

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

    const [ignored] = await eslint.lintText('test.only("focused", () => {}); debugger;', {
      filePath: join(consumerRoot, 'src/example.vitest.js'),
    });

    assert.equal(ignored.fatalErrorCount, 0);
    assert.ok(!ignored.messages.some(({ ruleId }) => ruleId?.startsWith('playwright/') === true));
    assert.ok(hasRule(ignored.messages, 'no-debugger'));
  });

  it('reports focused Playwright tests', async () => {
    const messages = await lint('test.only("focused", () => {});');
    assert.ok(hasRule(messages, 'playwright/no-focused-test'));
  });

  it('reports an unawaited Playwright assertion', async () => {
    const messages = await lint('test("scenario", async ({ page }) => { expect(page.getByRole("button")).toBeVisible(); });');
    assert.ok(hasRule(messages, 'playwright/missing-playwright-await'));
  });

  it('keeps type-aware checks active and allows empty fixture parameters', async () => {
    const messages = await lint(
      'const fixtures = { ready: async ({}, use: (value: boolean) => void) => { await 1; use(true); } };',
      'src/sample.pwtest.ts',
    );

    assert.ok(hasRule(messages, '@typescript-eslint/await-thenable'));
    assert.ok(!hasRule(messages, 'no-empty-pattern'));
  });
});
