import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { describe, it } from 'vitest';
import { createProtoConfig } from '@protoapps/eslint-config';

const consumerRoot = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/dependencies-consumer');

const lintImports = async (text: string, filePath = 'src/entry.js') => {
  const eslint = new ESLint({
    cwd: consumerRoot,
    overrideConfigFile: true,
    overrideConfig: await createProtoConfig({ tsconfigRootDir: consumerRoot }),
  });

  const [result] = await eslint.lintText(`${text}\n`, { filePath });

  return result;
};

describe('Dependency declarations', () => {
  it.each(['typescript', 'eslint', '@stylistic/eslint-plugin', 'globals', 'jiti', 'node:path'])(
    'accepts declared dependencies and builtins: %s', async (name) => {
      const result = await lintImports(`import '${name}';`);

      assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
      assert.deepEqual(result.messages.filter(({ ruleId }) => ruleId === 'import-x/no-extraneous-dependencies'), []);
    },
  );

  it.each(['src/entry.js', 'tests/example.test.js', 'src/example.stories.js', 'gallery/example.js', 'scripts/build.js', 'eslint.config.js'])(
    'allows devDependencies in %s', async (filePath) => {
      const result = await lintImports('import "eslint";', filePath);

      assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
      assert.deepEqual(result.messages.filter(({ ruleId }) => ruleId === 'import-x/no-extraneous-dependencies'), []);
    },
  );

  it.each([
    ['import "eslint-plugin-import-x";', 'src/entry.js', 1],
    ['import type { ESLint } from "eslint"; export type Linter = ESLint;', 'src/entry.ts', 0],
    ['import type { FlatConfig } from "typescript-eslint"; export type Config = FlatConfig.Config;', 'src/entry.ts', 1],
    ['import { type FlatConfig } from "typescript-eslint"; export type Config = FlatConfig.Config;', 'src/entry.ts', 1],
    ['export type { FlatConfig } from "typescript-eslint";', 'src/entry.ts', 1],
    ['import "eslint";', 'nested/entry.ts', 1],
    ['import type { ESLint } from "eslint"; export type Linter = ESLint;', 'nested/entry.ts', 1],
    ['import "globals";', 'nested/entry.ts', 0],
  ])('checks external declarations and the nearest manifest: %s in %s', async (text, filePath, expectedCount) => {
    const result = await lintImports(text, filePath);

    assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
    assert.equal(result.messages.filter(({ ruleId }) => ruleId === 'import-x/no-extraneous-dependencies').length, expectedCount);
  });
});
