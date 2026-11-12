import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { createProtoConfig } from '@protoapps/eslint-config';

const consumer = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);
const packageRequire = createRequire(require.resolve('@protoapps/eslint-config'));
const vuePeers = ['eslint-plugin-vue', 'vue-eslint-parser', 'eslint-plugin-vuejs-accessibility'];
const vitestPeer = '@vitest/eslint-plugin';
const playwrightPeer = 'eslint-plugin-playwright';
const optionalPeers = [...vuePeers, vitestPeer, playwrightPeer];

assert.ok(packageRequire.resolve('eslint-plugin-check-file'), 'Naming rules must be installed with the package.');

for (const peer of optionalPeers) {
  assert.throws(() => packageRequire.resolve(peer), { code: 'MODULE_NOT_FOUND' });
}

await assert.rejects(() => createProtoConfig({
  tsconfigRootDir: consumer,
  vue: { version: '3.5.40' },
}), (error) => {
  for (const peer of vuePeers) {
    assert.ok(error.message.includes(peer), `The missing-peer error must name ${peer}.`);
  }

  assert.match(error.message, /npm install/);

  return true;
});

await assert.rejects(() => createProtoConfig({ tsconfigRootDir: consumer, vitest: true }),
  /Vitest.*@vitest\/eslint-plugin.*npm install/);

await assert.rejects(() => createProtoConfig({ tsconfigRootDir: consumer, playwright: true }), (error) => {
  assert.match(error.message, /Playwright.*missing optional peer dependency/);
  assert.ok(error.message.includes(playwrightPeer));
  assert.match(error.message, /npm install --save-dev/);

  return true;
});

const pending = createProtoConfig({ tsconfigRootDir: consumer });
assert.ok(pending instanceof Promise, 'The factory must return a Promise.');
const config = await pending;
assert.ok(Array.isArray(config), 'The factory must resolve to a config array.');
const disabledConfig = await createProtoConfig({
  tsconfigRootDir: consumer, vue: false, vitest: false, playwright: false,
});
assert.ok(Array.isArray(disabledConfig));

const eslint = new ESLint({
  cwd: consumer,
  cache: false,
  overrideConfigFile: true,
  overrideConfig: disabledConfig,
});

const effective = await eslint.calculateConfigForFile('contracts.ts');
assert.ok(effective.plugins['check-file']);

const results = await eslint.lintFiles(['contracts.ts']);
assert.equal(results.length, 1, 'The consumer must lint one TypeScript file.');
const result = results[0];
const formatter = await eslint.loadFormatter('stylish');

assert.equal(
  result.fatalErrorCount + result.errorCount + result.warningCount,
  0,
  formatter.format(results),
);

const [typedResult] = await eslint.lintText('Promise.resolve(1);\n', {
  filePath: fileURLToPath(new URL('contracts.ts', import.meta.url)),
});
assert.equal(typedResult.fatalErrorCount, 0, JSON.stringify(typedResult.messages));
assert.ok(typedResult.messages.some(({ ruleId }) => ruleId === '@typescript-eslint/no-floating-promises'));
