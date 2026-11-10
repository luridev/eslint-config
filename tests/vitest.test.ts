import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vitestPlugin from '@vitest/eslint-plugin';
import { ESLint } from 'eslint';
import { describe, it } from 'vitest';
import { createProtoConfig } from '@protoapps/eslint-config';
import type { Linter } from 'eslint';
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

const hasRule = (messages: Array<Linter.LintMessage>, rule: string) => messages.some(({ ruleId }) => ruleId === rule);

describe('Vitest integration', () => {
  it('recognizes assertion helpers and rejects tests without assertions', async () => {
    const eslint = await createEslint({ vitest: { files: ['**/*.js'] } });

    for (const [body, hasAssertion] of [
      ['expect(1).toBe(1);', true],
      ['expectSomething();', true],
      ['initializeApp();', false],
    ] as const) {
      const [result] = await eslint.lintText(`import { describe, expect, it } from 'vitest';
describe('assertions', () => {
  it('runs a scenario', () => { ${body} });
});
`, { filePath: join(consumerRoot, 'src/example.js') });

      assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
      const errors = result.messages.filter(({ ruleId }) => ruleId === 'vitest/expect-expect');
      assert.deepEqual(errors.map(({ severity }) => severity), hasAssertion ? [] : [2], body);
    }
  });

  it('allows equality and truthiness matchers while rejecting TODO tests', async () => {
    const eslint = await createEslint({ vitest: { files: ['**/*.js'] } });
    const filePath = join(consumerRoot, 'src/example.js');

    const [matchers] = await eslint.lintText(`import { describe, expect, it } from 'vitest';

describe('values', () => {
  it('compares values', () => {
    expect({ value: 1 }).toEqual({ value: 1 });
    expect('value').toBeTruthy();
  });
});
`, { filePath });

    assert.equal(matchers.errorCount + matchers.warningCount, 0, JSON.stringify(matchers.messages));
    const [todo] = await eslint.lintText('import { test } from \'vitest\';\n\ntest.todo(\'unfinished\');\n', { filePath });
    assert.equal(todo.fatalErrorCount, 0, JSON.stringify(todo.messages));
    assert.ok(todo.messages.some(({ ruleId, severity }) => ruleId === 'vitest/warn-todo' && severity === 2));
  });

  it('Vitest options validate non-empty file patterns and optional ignores', async () => {
    for (const vitest of [null, 1, 'true', {}, { files: [] }, { files: [''] }, { files: [1] },
      { files: '**/*.ts' }, { files: ['**/*.ts'], ignores: 'src/**' }, { files: ['**/*.ts'], ignores: [null] }]) {
      await assert.rejects(() => createConfig({ vitest: vitest as unknown as ProtoConfigOptions['vitest'] }), /vitest.*files.*ignores/is);
    }
  });

  it('default scope excludes application, Node, Playwright, and type-only tests', async () => {
    const eslint = await createEslint();
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

  it('typed Vitest replaces the base unbound-method check and retains type-aware linting', async () => {
    const source = `import { it } from 'vitest';
class Counter {
  value = 0;
  increment() { this.value += 1; }
}
it('uses a method', () => {
  const detached = new Counter().increment;
  detached();
  Promise.resolve(1);
});
`;

    const [result] = await (await createEslint()).lintText(source, { filePath: join(consumerRoot, 'src/sample.vitest.ts') });
    assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
    const messages = result.messages;
    assert.ok(hasRule(messages, 'vitest/unbound-method'));
    assert.ok(!hasRule(messages, '@typescript-eslint/unbound-method'));
    assert.ok(hasRule(messages, '@typescript-eslint/no-floating-promises'));
  });

  it('untyped custom files do not enable parser-service-dependent checks', async () => {
    const eslint = await createEslint({ vitest: { files: ['**/*.js', '**/*.custom'] } });

    for (const filename of ['src/example.js', 'src/example.custom']) {
      const config = await eslint.calculateConfigForFile(filename);
      assert.ok(config !== undefined);
      assert.equal(config.settings.vitest?.typecheck, false);
      assert.equal(config.rules['vitest/unbound-method'], undefined);
      assert.equal(config.languageOptions.parserOptions.projectService, undefined);

      const [result] = await eslint.lintText('import { it } from \'vitest\';\nit.only(\'focused\', () => {});\n', {
        filePath: join(consumerRoot, filename),
      });

      assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
      assert.ok(hasRule(result.messages, 'vitest/no-focused-tests'));
    }
  });
});
