import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { createProtoConfig } from '@protoapps/eslint-config';

const consumer = fileURLToPath(new URL('.', import.meta.url));
const require = createRequire(import.meta.url);
const packageRequire = createRequire(require.resolve('@protoapps/eslint-config'));
const vuePeers = ['eslint-plugin-vue', 'vue-eslint-parser', 'eslint-plugin-vuejs-accessibility'];

for (const peer of vuePeers) {
  assert.throws(() => packageRequire.resolve(peer), { code: 'MODULE_NOT_FOUND' });
}

assert.throws(() => createProtoConfig({
  tsconfigRootDir: consumer,
  vue: { version: '3.5.40' },
}), (error) => {
  for (const peer of vuePeers) {
    assert.ok(error.message.includes(peer), `The missing-peer error must name ${peer}.`);
  }

  assert.match(error.message, /npm install/);

  return true;
});

const config = createProtoConfig({ tsconfigRootDir: consumer });
assert.ok(Array.isArray(config), 'The factory must return a synchronous config array.');
assert.ok(Array.isArray(createProtoConfig({ tsconfigRootDir: consumer, vue: false })));

const eslint = new ESLint({
  cwd: consumer,
  cache: false,
  overrideConfigFile: true,
  overrideConfig: config,
});

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
