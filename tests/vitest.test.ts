import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vitestPlugin from '@vitest/eslint-plugin';
import { ESLint } from 'eslint';
import { beforeAll, describe, it } from 'vitest';
import { createProtoConfig } from '@protoapps/eslint-config';
import type { TestConfigOptions, TestESLint } from '#tests/types.js';
import type { ProtoConfigOptions } from '@protoapps/eslint-config';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const consumerRoot = join(packageRoot, 'tests/fixtures/vitest-consumer');

const createConfig = (options: TestConfigOptions = {}) => createProtoConfig({
  tsconfigRootDir: consumerRoot,
  vitest: true,
  ...options,
});

const createEslint = async (options: TestConfigOptions = {}): Promise<TestESLint> => new ESLint({
  cwd: consumerRoot,
  overrideConfigFile: true,
  overrideConfig: await createConfig(options),
});

describe('Vitest integration', () => {
  let baseline: TestESLint;

  beforeAll(async () => {
    baseline = await createEslint();
  });

  it('Vitest options validate non-empty file patterns and optional ignores', async () => {
    for (const vitest of [null, 1, 'true', {}, { files: [] }, { files: [''] }, { files: [1] },
      { files: '**/*.ts' }, { files: ['**/*.ts'], ignores: 'src/**' }, { files: ['**/*.ts'], ignores: [null] }]) {
      await assert.rejects(() => createConfig({ vitest: vitest as unknown as ProtoConfigOptions['vitest'] }), /vitest.*files.*ignores/is);
    }
  });

  it('default scope excludes application, Node, Playwright, and type-only tests', async () => {
    const eslint = baseline;
    const included = await eslint.calculateConfigForFile('src/sample.vitest.ts');
    assert.equal(included?.plugins?.vitest, vitestPlugin);

    for (const filename of ['src/standard.ts', 'src/node.test.ts', 'src/example.pwtest.ts',
      'playwright/example.vitest.ts', 'src/example.test-d.ts', 'src/example.test.ts']) {
      const config = await eslint.calculateConfigForFile(filename);
      assert.ok(config !== undefined);
      assert.equal(config.plugins?.vitest, undefined, filename);
      assert.equal(config.rules['@typescript-eslint/unbound-method']?.[0], 2, filename);
    }
  });

  it('custom masks and ignores affect only Vitest, retaining protective exclusions', async () => {
    const options = { vitest: { files: ['src/**/*.test.ts', '**/*.js'], ignores: ['src/node-tests/**'] } };
    const eslint = await createEslint(options);
    const included = await eslint.calculateConfigForFile('src/example.test.ts');
    assert.ok(included !== undefined);
    assert.equal(included.plugins?.vitest, vitestPlugin);
    const excluded = await eslint.calculateConfigForFile('src/sample.vitest.ts');
    assert.ok(excluded !== undefined);
    assert.equal(excluded.plugins?.vitest, undefined);

    for (const filename of ['src/node-tests/example.test.ts', 'src/example.pwtest.js',
      'playwright/example.js', 'src/example.test-d.js']) {
      const config = await eslint.calculateConfigForFile(filename);
      assert.ok(config !== undefined);
      assert.equal(config.plugins?.vitest, undefined, filename);
      assert.equal(config.rules['no-debugger']?.[0], 2, filename);
    }
  });

  it('enables type-aware Vitest settings only for the TypeScript intersection', async () => {
    const eslint = await createEslint({ vitest: { files: ['**/*.vitest.ts', '**/*.js', '**/*.custom'] } });
    const typed = await eslint.calculateConfigForFile('src/sample.vitest.ts');
    const ordinary = await eslint.calculateConfigForFile('src/standard.ts');
    assert.ok(typed !== undefined && ordinary !== undefined);

    assert.equal(typed.settings.vitest?.typecheck, true);
    assert.equal(typed.languageOptions.parserOptions.projectService, true);
    assert.equal(typed.rules['vitest/unbound-method']?.[0], 2);
    assert.equal(typed.rules['@typescript-eslint/unbound-method']?.[0], 0);
    assert.equal(typed.rules['@typescript-eslint/no-floating-promises']?.[0], 2);
    assert.equal(ordinary.rules['@typescript-eslint/unbound-method']?.[0], 2);
    assert.equal(ordinary.plugins?.vitest, undefined);

    for (const filename of ['src/example.js', 'src/example.custom']) {
      const config = await eslint.calculateConfigForFile(filename);
      assert.ok(config !== undefined);
      assert.equal(config.plugins?.vitest, vitestPlugin);
      assert.equal(config.settings.vitest?.typecheck, false);
      assert.equal(config.rules['vitest/unbound-method'], undefined);
      assert.equal(config.languageOptions.parserOptions.projectService, undefined);
    }
  });
});
