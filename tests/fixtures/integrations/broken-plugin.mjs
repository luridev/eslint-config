import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';

const pluginUrl = import.meta.resolve('@vitest/eslint-plugin');
const hooks = registerHooks({
  load(url, context, nextLoad) {
    if (url === pluginUrl) {
      return {
        format: 'module',
        source: 'throw Object.assign(new Error("fixture dependency failed"), { code: "ERR_MODULE_NOT_FOUND" });',
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

try {
  const { createProtoConfig } = await import('@protoapps/eslint-config');
  const tsconfigRootDir = fileURLToPath(new URL('../vue-consumer', import.meta.url));
  await assert.rejects(() => createProtoConfig({ tsconfigRootDir, vitest: true }), {
    name: 'Error', code: 'ERR_MODULE_NOT_FOUND', message: /fixture dependency failed/,
  });
} finally {
  hooks.deregister();
}
