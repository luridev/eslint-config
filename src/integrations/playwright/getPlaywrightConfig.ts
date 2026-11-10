import { defineConfig } from 'eslint/config';
import { defaultPlaywrightFiles, playwrightIgnores, playwrightRules } from './config.js';
import type { PlaywrightConfigOptions } from './types.js';

const isPlaywrightConfigOptions = (value: unknown): value is PlaywrightConfigOptions => (
  typeof value === 'object'
  && value !== null
  && 'files' in value
  && Array.isArray(value.files)
  && value.files.length > 0
  && value.files.every((pattern: unknown) => typeof pattern === 'string' && pattern.trim().length > 0)
  && (!('ignores' in value) || value.ignores === undefined || (Array.isArray(value.ignores)
    && value.ignores.every((pattern: unknown) => typeof pattern === 'string' && pattern.trim().length > 0)))
);

export const getPlaywrightConfig = async (
  option: boolean | PlaywrightConfigOptions | undefined,
): Promise<ReturnType<typeof defineConfig>> => {
  if (option === undefined || option === false) {
    return [];
  }

  const options = option === true ? { files: defaultPlaywrightFiles } : option;

  if (!isPlaywrightConfigOptions(options)) {
    throw new TypeError(
      '@protoapps/eslint-config: playwright must be false, true, or an object with a non-empty files array of patterns and optional ignores array.',
    );
  }

  try {
    import.meta.resolve('eslint-plugin-playwright');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(
        '@protoapps/eslint-config: Playwright requires the missing optional peer dependency eslint-plugin-playwright. '
        + 'Install it with: npm install --save-dev eslint-plugin-playwright',
        { cause: error },
      );
    }

    throw error;
  }

  const { default: playwright } = await import('eslint-plugin-playwright');
  const { files, ignores = [] } = options;

  return defineConfig({
    name: 'proto/playwright',
    files,
    ignores: [...playwrightIgnores, ...ignores],
    plugins: { playwright },
    rules: playwrightRules,
  });
};
