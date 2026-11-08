import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    assert.notEqual(specifier, '@vitest/eslint-plugin', 'Disabled Vitest must not resolve the plugin.');

    return nextResolve(specifier, context);
  },
});

try {
  const { createProtoConfig } = await import('@protoapps/eslint-config');
  for (const vitest of [undefined, false]) {
    assert.ok(Array.isArray(await createProtoConfig({
      tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)), vitest,
    })));
  }
} finally {
  hooks.deregister();
}
