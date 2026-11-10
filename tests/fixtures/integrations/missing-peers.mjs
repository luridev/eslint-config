import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const vuePeers = ['eslint-plugin-vue', 'vue-eslint-parser', 'eslint-plugin-vuejs-accessibility'];
const missing = new Set(['eslint-plugin-playwright', ...vuePeers]);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (missing.has(specifier)) throw Object.assign(new Error(`Unavailable: ${specifier}`), { code: 'ERR_MODULE_NOT_FOUND' });
    return nextResolve(specifier, context);
  },
});

try {
  const { createProtoConfig } = await import('@protoapps/eslint-config');
  const tsconfigRootDir = fileURLToPath(new URL('../vue-consumer', import.meta.url));
  await assert.rejects(() => createProtoConfig({ tsconfigRootDir, playwright: true }), /Playwright.*missing optional peer.*eslint-plugin-playwright/);
  await assert.rejects(() => createProtoConfig({ tsconfigRootDir, vue: { version: '3.5.40' } }), (error) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /Vue.*missing optional peer/);
    for (const peer of vuePeers) assert.ok(error.message.includes(peer), `Missing diagnostic for ${peer}`);
    return true;
  });
} finally {
  hooks.deregister();
}
