import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vitest from '@vitest/eslint-plugin';
import { ESLint } from 'eslint';
import { createProtoConfig } from '@protoapps/eslint-config';

const consumer = fileURLToPath(new URL('.', import.meta.url));
const withVue = existsSync(new URL('ExampleComponent.vue', import.meta.url));
const config = await createProtoConfig({
  tsconfigRootDir: consumer,
  vitest: true,
  vue: withVue ? { version: '3.5.40' } : false,
}, [[{
  files: ['**/*.vitest.ts'],
  plugins: { vitest },
  rules: { 'vitest/warn-todo': 'off' },
}]]);
assert.ok(Array.isArray(config));

if (!withVue) {
  const require = createRequire(import.meta.url);
  const packageRequire = createRequire(require.resolve('@protoapps/eslint-config'));
  for (const peer of ['eslint-plugin-vue', 'vue-eslint-parser', 'eslint-plugin-vuejs-accessibility']) {
    assert.throws(() => packageRequire.resolve(peer), { code: 'MODULE_NOT_FOUND' });
  }
}

const eslint = new ESLint({ cwd: consumer, overrideConfigFile: true, overrideConfig: config });
const filePath = fileURLToPath(new URL('src/sample.vitest.ts', import.meta.url));
const effective = await eslint.calculateConfigForFile(filePath);
assert.equal(effective.plugins.vitest, vitest);
assert.equal(effective.rules['@typescript-eslint/unbound-method'][0], 0);
assert.equal(effective.rules['vitest/warn-todo'][0], 0, 'Final nested overrides must win over the preset.');
const [result] = await eslint.lintText(`import { expect, it } from 'vitest';
class Counter {
  value = 0;
  increment() { this.value += 1; }
}
it('uses typed assertions', () => {
  const counter = new Counter();
  expect(counter.increment).toHaveBeenCalledOnce();
  const detached = counter.increment;
  detached();
  Promise.resolve(1);
});
`, { filePath });
assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
for (const rule of ['vitest/unbound-method', '@typescript-eslint/no-floating-promises']) {
  assert.ok(result.messages.some(({ ruleId }) => ruleId === rule), `${rule}: ${JSON.stringify(result.messages)}`);
}
assert.equal(result.messages.some(({ ruleId }) => ruleId === '@typescript-eslint/unbound-method'), false);

if (withVue) {
  const component = new URL('ExampleComponent.vue', import.meta.url);
  const [result] = await eslint.lintText(readFileSync(component, 'utf8'), { filePath: fileURLToPath(component) });
  assert.equal(result.errorCount + result.warningCount, 0, JSON.stringify(result.messages));
  const effective = await eslint.calculateConfigForFile(fileURLToPath(component));
  assert.equal(effective.languageOptions.parser.meta.name, 'vue-eslint-parser');
  assert.equal(effective.plugins.vitest, undefined);
}
