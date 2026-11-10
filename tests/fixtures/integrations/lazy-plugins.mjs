import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const peers = new Set(['eslint-plugin-vue', 'vue-eslint-parser', 'eslint-plugin-vuejs-accessibility', '@vitest/eslint-plugin', 'eslint-plugin-playwright']);
let playwrightEnabled = false;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (peers.has(specifier)) {
      assert.ok(playwrightEnabled && specifier === 'eslint-plugin-playwright', `Unexpected optional import: ${specifier}`);
    }
    return nextResolve(specifier, context);
  },
});

try {
  const { createProtoConfig } = await import('@protoapps/eslint-config');
  const tsconfigRootDir = fileURLToPath(new URL('../vue-consumer', import.meta.url));
  assert.ok(Array.isArray(await createProtoConfig({ tsconfigRootDir })));
  assert.ok(Array.isArray(await createProtoConfig({ tsconfigRootDir, vue: false, vitest: false, playwright: false })));
  playwrightEnabled = true;
  assert.ok(Array.isArray(await createProtoConfig({ tsconfigRootDir, playwright: true })));
} finally {
  hooks.deregister();
}
