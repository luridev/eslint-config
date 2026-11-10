import { defineConfig } from 'eslint/config';
import { defaultVitestFiles, vitestIgnores, vitestRules, vitestTypescriptRules } from './config.js';
import type { VitestConfigOptions } from './types.js';

const isVitestConfigOptions = (value: unknown): value is VitestConfigOptions => (
  typeof value === 'object'
  && value !== null
  && 'files' in value
  && Array.isArray(value.files)
  && value.files.length > 0
  && value.files.every((pattern: unknown) => typeof pattern === 'string' && pattern.trim().length > 0)
  && (!('ignores' in value) || value.ignores === undefined || (Array.isArray(value.ignores)
    && value.ignores.every((pattern: unknown) => typeof pattern === 'string' && pattern.trim().length > 0)))
);

export const getVitestConfig = async (
  option: boolean | VitestConfigOptions | undefined,
): Promise<ReturnType<typeof defineConfig>> => {
  if (option === undefined || option === false) {
    return [];
  }

  const options = option === true ? { files: defaultVitestFiles } : option;

  if (!isVitestConfigOptions(options)) {
    throw new TypeError(
      '@protoapps/eslint-config: vitest must be false, true, or an object with a non-empty files array of patterns and optional ignores array.',
    );
  }

  try {
    import.meta.resolve('@vitest/eslint-plugin');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(
        '@protoapps/eslint-config: Vitest requires the missing optional peer dependency @vitest/eslint-plugin. '
        + 'Install it with: npm install --save-dev @vitest/eslint-plugin',
        { cause: error },
      );
    }

    throw error;
  }

  const { default: vitest } = await import('@vitest/eslint-plugin');
  const { files, ignores = [] } = options;
  const excludedFiles = [...vitestIgnores, ...ignores];

  return defineConfig(
    {
      name: 'proto/vitest',
      files,
      ignores: excludedFiles,
      plugins: { vitest },
      settings: { vitest: { typecheck: false } },
      rules: vitestRules,
    },
    {
      name: 'proto/vitest-typescript',
      files: files.map((pattern) => [pattern, '**/*.ts']),
      ignores: excludedFiles,
      settings: { vitest: { typecheck: true } },
      rules: vitestTypescriptRules,
    },
  );
};
