import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import playwright from 'eslint-plugin-playwright';
import { createProtoConfig } from '@protoapps/eslint-config';

const consumer = fileURLToPath(new URL('.', import.meta.url));
const config = await createProtoConfig({ tsconfigRootDir: consumer, playwright: true });
assert.ok(Array.isArray(config));

const eslint = new ESLint({ cwd: consumer, overrideConfigFile: true, overrideConfig: config });
const filePath = fileURLToPath(new URL('src/sample.pwtest.ts', import.meta.url));
const effective = await eslint.calculateConfigForFile(filePath);
assert.equal(effective.plugins.playwright, playwright);

const [result] = await eslint.lintText(`declare const test: {
  only(title: string, callback: () => void): void;
};
test.only('focused', () => { /* This source is linted, not executed. */ });
Promise.resolve(1);
`, { filePath });
assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
for (const rule of ['playwright/no-focused-test', '@typescript-eslint/no-floating-promises']) {
  assert.ok(result.messages.some(({ ruleId }) => ruleId === rule), `${rule}: ${JSON.stringify(result.messages)}`);
}

const ordinary = await eslint.calculateConfigForFile('contracts.ts');
assert.equal(ordinary.plugins?.playwright, undefined);
