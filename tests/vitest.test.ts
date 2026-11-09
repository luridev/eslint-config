import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vitestPlugin from '@vitest/eslint-plugin';
import { ESLint } from 'eslint';
import { describe, it } from 'vitest';
import { createProtoConfig } from '@protoapps/eslint-config';
import type { Linter } from 'eslint';
import type { ConfigOverrides, TestConfigOptions, TestESLint } from '#tests/types.js';
import type { ProtoConfigOptions } from '@protoapps/eslint-config';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const consumerRoot = join(packageRoot, 'tests/fixtures/vitest-consumer');

const createConfig = (options: TestConfigOptions = {}, ...overrides: ConfigOverrides) => createProtoConfig({
  tsconfigRootDir: consumerRoot,
  vitest: true,
  ...options,
}, ...overrides);

const createEslint = async (
  options: TestConfigOptions = {}, ...overrides: ConfigOverrides
): Promise<TestESLint> => new ESLint({
  cwd: consumerRoot,
  overrideConfigFile: true,
  overrideConfig: await createConfig(options, ...overrides),
});

const lint = async (source: string, options: TestConfigOptions = {}, overrides: ConfigOverrides = [], filename = 'src/sample.vitest.ts') => {
  const [result] = await (await createEslint(options, ...overrides)).lintText(source, {
    filePath: join(consumerRoot, filename),
  });

  assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));

  return result.messages;
};

const hasRule = (messages: Array<Linter.LintMessage>, rule: string) => messages.some(({ ruleId }) => ruleId === rule);

describe('Vitest integration', () => {
  it('Vitest is disabled by default and explicitly false', async () => {
    for (const vitest of [undefined, false]) {
      const config = await (await createEslint({ vitest })).calculateConfigForFile('src/sample.vitest.ts');
      assert.ok(config !== undefined);
      assert.equal(config.plugins?.vitest, undefined);
      assert.ok(!Object.keys(config.rules).some((rule) => rule.startsWith('vitest/')));
      assert.equal(config.rules['@typescript-eslint/unbound-method']?.[0], 2);
    }
  });

  it('active Vitest rules are errors in typed and untyped files', async () => {
    const eslint = await createEslint({ vitest: { files: ['**/*.ts', '**/*.js'] } });

    for (const filename of ['src/sample.vitest.ts', 'src/sample.js']) {
      const config = await eslint.calculateConfigForFile(filename);
      assert.ok(config !== undefined);
      const rules = Object.entries(config.rules).filter(([name, rule]) => name.startsWith('vitest/') && rule?.[0] !== 0);
      assert.ok(rules.length > 0);
      assert.ok(rules.every(([, rule]) => rule?.[0] === 2));
    }
  });

  it('Vitest options validate non-empty file patterns and optional ignores', async () => {
    for (const vitest of [null, 1, 'true', {}, { files: [] }, { files: [''] }, { files: [1] },
      { files: '**/*.ts' }, { files: ['**/*.ts'], ignores: 'src/**' }, { files: ['**/*.ts'], ignores: [null] }]) {
      await assert.rejects(() => createConfig({ vitest: vitest as unknown as ProtoConfigOptions['vitest'] }), /vitest.*files.*ignores/is);
    }
  });

  it('default scope excludes application, Node, Playwright, and type-only tests', async () => {
    const eslint = await createEslint();

    for (const filename of ['src/standard.ts', 'src/node.test.ts', 'src/example.pwtest.ts',
      'playwright/example.vitest.ts', 'src/example.test-d.ts', 'src/example.test.ts']) {
      const config = await eslint.calculateConfigForFile(filename);
      assert.ok(config !== undefined);
      assert.equal(config.plugins?.vitest, undefined, filename);
      assert.equal(config.rules['@typescript-eslint/unbound-method']?.[0], 2, filename);
    }

    const messages = await lint('import { test } from \'node:test\';\ntest(\'node\', () => {});\ndebugger;\n',
      {},
      [],
      'src/standard.ts');

    assert.ok(!messages.some(({ ruleId }) => ruleId?.startsWith('vitest/') === true));
    assert.ok(hasRule(messages, 'no-debugger'));
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

    const source = 'import { it } from \'vitest\';\nit.only(\'focused\', () => {});\ndebugger;\n';
    assert.ok(hasRule(await lint(source, options, [], 'src/example.test.js'), 'vitest/no-focused-tests'));
    const ignored = await lint(source, options, [], 'src/node-tests/example.test.js');
    assert.ok(!ignored.some(({ ruleId }) => ruleId?.startsWith('vitest/') === true));
    assert.ok(hasRule(ignored, 'no-debugger'));
  });

  it('real ESLint reports focused tests, top-level tests, strict equality and called-once', async () => {
    const messages = await lint(`import { expect, it } from 'vitest';
it.only('focused', () => {
  expect({ value: 1 }).toEqual({ value: 1 });
  expect(() => {}).toHaveBeenCalledTimes(1);
});
`);

    for (const rule of ['no-focused-tests', 'require-top-level-describe', 'prefer-strict-equal', 'prefer-called-once']) {
      assert.ok(hasRule(messages, `vitest/${rule}`), JSON.stringify(messages));
    }

    const valid = await lint(`import { describe, expect, it } from 'vitest';
describe('suite', () => {
  it('checks one call', () => {
    expect(() => {}).toHaveBeenCalledOnce();
  });
});
`);

    assert.ok(!valid.some(({ ruleId }) => ruleId?.startsWith('vitest/') === true), JSON.stringify(valid));
  });

  it('mock implementations, test contexts and separate assertions remain allowed', async () => {
    const messages = await lint(`import { beforeEach, describe, expect, it, vi } from 'vitest';
describe('suite', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('retains mock implementations and separate assertions', async (context) => {
    const mock = vi.fn();
    mock.mockImplementation(() => Promise.resolve(1));
    mock.mockImplementation(() => 2);
    expect(mock).toHaveBeenCalledOnce();
    expect(mock).toHaveBeenCalledWith(1);
    await expect.poll(() => 1).toBe(1);
    context.expect(1).toBe(1);
  });
});
`, { vitest: { files: ['**/*.js'] } }, [], 'src/example.js');

    assert.ok(!messages.some(({ ruleId }) => ruleId?.startsWith('vitest/') === true), JSON.stringify(messages));
  });

  it('final overrides recognize project assertion helpers', async () => {
    const source = `import { describe, expect, it } from 'vitest';
function expectSameOrderAsNative() { expect(1).toBe(1); }
describe('suite', () => {
  it('checks a helper', () => { expectSameOrderAsNative(); });
});
`;

    assert.ok(hasRule(await lint(source), 'vitest/expect-expect'));

    const messages = await lint(source, {}, [{
      files: ['**/*.vitest.ts'],
      rules: { 'vitest/expect-expect': ['error', {
        assertFunctionNames: ['expect', 'assert', 'expectSameOrderAsNative'],
      }] },
    }]);

    assert.ok(!hasRule(messages, 'vitest/expect-expect'));
  });

  it('typed Vitest permits mock assertions and still reports unsafe unbound methods', async () => {
    const source = `import { describe, expect, it } from 'vitest';
class Counter {
  value = 0;
  increment() { this.value += 1; }
}
describe('counter', () => {
  it('uses a method', () => {
    const counter = new Counter();
    expect(counter.increment).toHaveBeenCalledOnce();
    const detached = counter.increment;
    detached();
    Promise.resolve(1);
  });
});
`;

    const messages = await lint(source);
    assert.equal(messages.filter(({ ruleId }) => ruleId === 'vitest/unbound-method').length, 1);
    assert.ok(!hasRule(messages, '@typescript-eslint/unbound-method'));
    assert.ok(hasRule(messages, '@typescript-eslint/no-floating-promises'));
    const baseline = await lint(source, { vitest: false });
    assert.equal(baseline.filter(({ ruleId }) => ruleId === '@typescript-eslint/unbound-method').length, 2);
  });

  it('untyped custom files do not enable parser-service-dependent checks', async () => {
    const options = { vitest: { files: ['**/*.js', '**/*.custom'] } };

    for (const filename of ['src/example.js', 'src/example.custom']) {
      const config = await (await createEslint(options)).calculateConfigForFile(filename);
      assert.ok(config !== undefined);
      assert.equal(config.settings.vitest?.typecheck, false);
      assert.equal(config.rules['vitest/unbound-method'], undefined);
      assert.equal(config.languageOptions.parserOptions.projectService, undefined);
      const messages = await lint('import { it } from \'vitest\';\nit.only(\'focused\', () => {});\n', options, [], filename);
      assert.ok(hasRule(messages, 'vitest/no-focused-tests'));
    }
  });

  it('languageConfigs survive and variadic nested overrides win after both integrations', async () => {
    const eslint = await createEslint({
      vue: { version: '3.5.40' },
      languageConfigs: [[{ files: ['**/*.vitest.ts'], languageOptions: { globals: { customGlobal: 'readonly' } } }]],
    }, { files: ['**/*.vitest.ts'], rules: { 'vitest/no-focused-tests': 'off' } }, [[{
      files: ['**/*.vitest.ts'],
      extends: [{ rules: { 'vitest/prefer-strict-equal': 'off' } }],
    }]]);

    const config = await eslint.calculateConfigForFile('src/sample.vitest.ts');
    assert.ok(config !== undefined);
    assert.equal(config.languageOptions.globals?.customGlobal, 'readonly');
    assert.equal(config.rules['vitest/no-focused-tests']?.[0], 0);
    assert.equal(config.rules['vitest/prefer-strict-equal']?.[0], 0);
    assert.equal(config.rules['vitest/require-top-level-describe']?.[0], 2);
    assert.equal(config.languageOptions.parser?.meta?.name, 'typescript-eslint/parser');

    const [result] = await eslint.lintText('import { it } from \'vitest\';\nit.only(\'focused\', () => {});\n', {
      filePath: join(consumerRoot, 'src/sample.vitest.ts'),
    });

    assert.equal(result.fatalErrorCount, 0);
    assert.ok(!hasRule(result.messages, 'vitest/no-focused-tests'));
    assert.ok(hasRule(result.messages, 'vitest/require-top-level-describe'));
  });

  it('all four integration combinations keep Vue and Vitest scopes separate', async () => {
    const vueRoot = join(packageRoot, 'tests/fixtures/vue-consumer');

    for (const vue of [false, { version: '3.5.40' }] as const) {
      for (const vitest of [false, true]) {
        const config = await createConfig({ tsconfigRootDir: vueRoot, vue, vitest });
        const eslint: TestESLint = new ESLint({ cwd: vueRoot, overrideConfigFile: true, overrideConfig: config });
        const ts = await eslint.calculateConfigForFile('src/standard.ts');
        assert.ok(ts !== undefined);
        assert.equal(ts.languageOptions.parser?.meta?.name, 'typescript-eslint/parser');
        assert.equal(ts.plugins?.vitest, undefined);
        const testConfig = await eslint.calculateConfigForFile('src/example.vitest.ts');
        assert.ok(testConfig !== undefined);
        assert.equal(Boolean(testConfig.plugins?.vitest), vitest);

        if (vue !== false) {
          const component = await eslint.calculateConfigForFile('src/component.vue');
          assert.ok(component !== undefined);
          assert.equal(component.languageOptions.parser?.meta?.name, 'vue-eslint-parser');
          assert.equal(component.plugins?.vitest, undefined);

          const [result] = await eslint.lintText(readFileSync(join(vueRoot, 'src/component.vue'), 'utf8'), {
            filePath: join(vueRoot, 'src/component.vue'),
          });

          assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
          assert.ok(hasRule(result.messages, 'vuejs-accessibility/alt-text'));
          assert.ok(hasRule(result.messages, '@typescript-eslint/no-unnecessary-condition'));
          assert.ok(hasRule(result.messages, 'import-x/newline-after-import'));
        }
      }
    }
  });
});
