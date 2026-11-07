import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { createProtoConfig } from '@protoapps/eslint-config';

const consumer = fileURLToPath(new URL('.', import.meta.url));
const config = createProtoConfig({ tsconfigRootDir: consumer, vue: { version: '3.5.40' } });
assert.ok(Array.isArray(config), 'Enabling Vue must preserve the synchronous API.');

const eslint = new ESLint({
  cwd: consumer,
  cache: false,
  overrideConfigFile: true,
  overrideConfig: config,
});

const results = await eslint.lintFiles(['contracts.ts', 'ExampleComponent.vue']);
assert.equal(results.length, 2, 'The consumer must lint both TypeScript and Vue.');
const formatter = await eslint.loadFormatter('stylish');
assert.equal(
  results.reduce((count, result) => count + result.errorCount + result.warningCount, 0),
  0,
  formatter.format(results),
);

const component = new URL('ExampleComponent.vue', import.meta.url);
const invalidSfc = readFileSync(component, 'utf8')
  .replace("const message = 'fixture';", "const message = 'fixture';\nPromise.resolve(message);")
  .replace('  <p>', '  <img src="/fixture.png" />\n\n  <p>');
const [vue] = await eslint.lintText(invalidSfc, { filePath: fileURLToPath(component) });
assert.equal(vue.fatalErrorCount, 0, JSON.stringify(vue.messages));

for (const rule of ['@typescript-eslint/no-floating-promises', 'vuejs-accessibility/alt-text']) {
  assert.ok(vue.messages.some(({ ruleId }) => ruleId === rule), `Expected ${rule}: ${JSON.stringify(vue.messages)}`);
}
