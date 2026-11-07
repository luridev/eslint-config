import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const pluginUrl = import.meta.resolve('@vitest/eslint-plugin');
const message = 'An installed Vitest plugin failed to load its own dependency.';
const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url === pluginUrl) {
      return {
        format: 'module',
        source: `const error = new Error(${JSON.stringify(message)}); error.code = 'MODULE_NOT_FOUND'; throw error; export default {};`,
        shortCircuit: true,
      };
    }

    return nextLoad(url, context);
  },
});

try {
  const { createProtoConfig } = await import('@protoapps/eslint-config');
  const tsconfigRootDir = fileURLToPath(new URL('.', import.meta.url));
  assert.throws(() => createProtoConfig({ tsconfigRootDir, vitest: true }), { message, code: 'MODULE_NOT_FOUND' });
  assert.ok(Array.isArray(createProtoConfig({ tsconfigRootDir, vitest: false })));
} finally {
  hooks.deregister();
}
