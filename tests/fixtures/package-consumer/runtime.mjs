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
assert.ok(Array.isArray(await createProtoConfig({ tsconfigRootDir: consumer, vue: false })));
assert.ok(Array.isArray(await createProtoConfig({ tsconfigRootDir: consumer, vitest: false })));

const disabledPlaywright = new ESLint({
  cwd: consumer,
  overrideConfigFile: true,
  overrideConfig: await createProtoConfig({ tsconfigRootDir: consumer, playwright: false }),
});
const [disabledResult] = await disabledPlaywright.lintText('debugger;\n', { filePath: 'example.js' });
assert.equal(disabledResult.fatalErrorCount, 0, JSON.stringify(disabledResult.messages));
assert.ok(disabledResult.messages.some(({ ruleId }) => ruleId === 'no-debugger'));

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

const [sortResult] = await eslint.lintText('export const sorted = [10, 2].sort();\n', {
  filePath: fileURLToPath(new URL('contracts.ts', import.meta.url)),
});
assert.equal(sortResult.fatalErrorCount, 0, JSON.stringify(sortResult.messages));
assert.ok(sortResult.messages.some(({ ruleId }) => ruleId === '@typescript-eslint/require-array-sort-compare'));

const [regexpResult] = await eslint.lintText('export const pattern = /a|a/;\n', { filePath: 'example.js' });
assert.equal(regexpResult.fatalErrorCount, 0, JSON.stringify(regexpResult.messages));
assert.ok(regexpResult.messages.some(({ ruleId }) => ruleId === 'regexp/no-dupe-disjunctions'));

const [dependencyResult] = await eslint.lintText('import "eslint-plugin-import-x";\n', { filePath: 'example.js' });
assert.equal(dependencyResult.fatalErrorCount, 0, JSON.stringify(dependencyResult.messages));
assert.ok(dependencyResult.messages.some(({ ruleId }) => ruleId === 'import-x/no-extraneous-dependencies'));

const [namingResult] = await eslint.lintText('export const value = 1;\n', {
  filePath: 'bad-folder/bad-file.js',
});
assert.equal(namingResult.fatalErrorCount, 0, JSON.stringify(namingResult.messages));
assert.deepEqual(namingResult.messages.filter(({ ruleId }) => ruleId?.startsWith('check-file/')).map(({ ruleId }) => ruleId).sort(), [
  'check-file/filename-naming-convention',
  'check-file/folder-naming-convention',
]);
