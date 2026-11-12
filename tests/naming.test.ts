import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ESLint } from 'eslint';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { createProtoConfig } from '@protoapps/eslint-config';

// Representative boundaries of our filename and directory patterns, not a matcher conformance suite.
const paths = [
  ['useButton.ts', 0, 0],
  ['DrButton.js', 0, 0],
  ['use-button.ts', 1, 0],
  ['dr_button.ts', 1, 0],
  ['Кнопка.ts', 1, 0],
  ['components/DrButton/UIContent.vue', 0, 0],
  ['drButton.vue', 1, 0],
  ['DrButton.story.vue', 0, 0],
  ['DrButton.test.ts', 0, 0],
  ['validation.test-d.ts', 1, 0],
  ['components/vue-only/Example.vue', 0, 1],
  ['src/.custom-config/.hidden-name.ts', 0, 0],
  ['.custom-config/bad-name.ts', 1, 0],
  ['.custom-config/bad-folder/entry.ts', 0, 1],
] as const;

describe('File and directory naming', () => {
  let root: string;
  let eslint: ESLint;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'protoapps-eslint-naming-'));

    writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { target: 'ESNext', module: 'ESNext', strict: true },
      include: paths.map(([filename]) => filename),
    }));

    for (const [filename] of paths) {
      const file = join(root, filename);
      mkdirSync(dirname(file), { recursive: true });

      writeFileSync(file, filename.endsWith('.vue')
        ? '<template>\n  <div></div>\n</template>\n'
        : 'const value = 1;\n');
    }

    eslint = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: await createProtoConfig({ tsconfigRootDir: root, vue: { version: '3.5.40' } }),
    });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true, maxRetries: 3 });
  });

  it.each(paths)('applies the naming policy to %s', async (filename, filenameErrors, folderErrors) => {
    const [result] = await eslint.lintFiles([join(root, filename)]);
    assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
    assert.equal(result.messages.filter(({ ruleId }) => ruleId === 'check-file/filename-naming-convention').length, filenameErrors);
    assert.equal(result.messages.filter(({ ruleId }) => ruleId === 'check-file/folder-naming-convention').length, folderErrors);
  });

  it('keeps content and parent directory checks active for dot-prefixed filenames', async () => {
    const [result] = await eslint.lintText('debugger;\n', {
      filePath: join(root, '.custom-config/bad-folder/.hidden-name.js'),
    });

    assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
    assert.equal(result.messages.filter(({ ruleId }) => ruleId === 'check-file/filename-naming-convention').length, 0);
    assert.equal(result.messages.filter(({ ruleId }) => ruleId === 'check-file/folder-naming-convention').length, 1);
    assert.ok(result.messages.some(({ ruleId }) => ruleId === 'no-debugger'));
  });
});
