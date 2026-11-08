import assert from 'node:assert/strict';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const pluginUrl = pathToFileURL(require.resolve('eslint-plugin-vue')).href;
const message = 'An installed Vue plugin failed to load its own dependency.';
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
  await assert.rejects(() => createProtoConfig({
    tsconfigRootDir: fileURLToPath(new URL('.', import.meta.url)),
    vue: { version: '3.5.40' },
  }), { message, code: 'MODULE_NOT_FOUND' });
} finally {
  hooks.deregister();
}
