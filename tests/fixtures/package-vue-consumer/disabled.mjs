import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const vuePeers = new Set(['eslint-plugin-vue', 'vue-eslint-parser', 'eslint-plugin-vuejs-accessibility']);
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    assert.ok(!vuePeers.has(specifier), `Disabled Vue must not resolve ${specifier}.`);

    return nextResolve(specifier, context);
  },
});

try {
  const { createProtoConfig } = await import('@protoapps/eslint-config');
  const consumer = fileURLToPath(new URL('.', import.meta.url));

  for (const options of [{ tsconfigRootDir: consumer }, { tsconfigRootDir: consumer, vue: false }]) {
    const config = await createProtoConfig(options);
    assert.ok(Array.isArray(config));
  }
} finally {
  hooks.deregister();
}
