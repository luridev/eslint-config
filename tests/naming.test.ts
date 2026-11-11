import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ESLint } from 'eslint';
import { afterAll, beforeAll, describe, it } from 'vitest';
import { createProtoConfig } from '@protoapps/eslint-config';

const filenames = [
  ['useButton.ts', true],
  ['useDrButton.ts', true],
  ['browserPolicy.ts', true],
  ['DrButton.js', true],
  ['UIContent.ts', true],
  ['URLParser.ts', true],
  ['HTTPClient.ts', true],
  ['FAQPage.ts', true],
  ['MyHTTPClient.ts', true],
  ['useUIContent.ts', true],
  ['parseURL.ts', true],
  ['myFAQPage.ts', true],
  ['DrButton.test.ts', true],
  ['browserPolicy.vitest.ts', true],
  ['validation.test.d.ts', true],
  ['DrButton.generated.test.ts', true],
  ['DrButton.UI.HTTPClient.ts', true],
  ['validation.test-d.ts', false],
  ['index.ts', true],
  ['eslint.config.ts', true],
  ['moduleName.mjs', true],
  ['ModuleName.cjs', true],
  ['DrButton.vue', true],
  ['UIContent.vue', true],
  ['URLParser.vue', true],
  ['HTTPClient.vue', true],
  ['FAQPage.vue', true],
  ['MyHTTPClient.vue', true],
  ['DrButton.story.vue', true],
  ['DrButton.generated.test.vue', true],
  ['UIContent.URLParser.story.vue', true],
  ['drButton.vue', false],
  ['drButton.story.vue', false],
  ['use-button.ts', false],
  ['dr-button.js', false],
  ['dr_button.ts', false],
  ['Кнопка.ts', false],
  ['Dr-button.vue', false],
  ['Dr_button.vue', false],
  ['Кнопка.vue', false],
  ['DrButton.bad-name.ts', false],
  ['DrButton.bad_name.ts', false],
  ['DrButton.проверка.ts', false],
  ['DrButton.bad-name.test.ts', false],
  ['DrButton.bad_name.test.ts', false],
  ['DrButton.проверка.test.ts', false],
  ['DrButton.bad-name.story.vue', false],
  ['DrButton.bad-name.vue', false],
  ['DrButton.bad_name.vue', false],
  ['DrButton.проверка.vue', false],
  ['.hidden-name.ts', true],
  ['.hidden_name.vue', true],
  ['src/.custom-config/.hidden-name.ts', true],
  ['.github/scripts/bad-name.ts', false],
  ['.vscode/scripts/bad_name.js', false],
  ['.custom-config/bad-name.ts', false],
  ['src/.custom-config/.nested-config/DrButton.bad-name.ts', false],
  ['.custom-config/drButton.vue', false],
  ['DrButton.some-extension.ts', false],
] as const;

const folders = [
  ['components/drButton/entry.ts', true],
  ['components/DrButton/entry.ts', true],
  ['UI/URLParser/HTTPClient/FAQPage/MyHTTPClient/entry.ts', true],
  ['components/UIContent/Example.vue', true],
  ['src/[productId]/index.ts', false],
  ['src/my-component/index.ts', false],
  ['src/myComponent/index.ts', true],
  ['.github/scripts/entry.ts', true],
  ['.vscode/scripts/entry.ts', true],
  ['.gitlab/entry.ts', true],
  ['.custom-config/entry.ts', true],
  ['src/.custom-config/.nested-config/entry.ts', true],
  ['components/bad-name/entry.ts', false],
  ['components/bad_name/entry.ts', false],
  ['components/Кнопки/entry.ts', false],
  ['components/vue-only/Example.vue', false],
  ['components/vue-only/UIContent.generated.story.vue', false],
  ['.github/bad-name/entry.ts', false],
  ['.github/bad-folder/file.ts', false],
  ['.custom-config/bad-folder/entry.ts', false],
  ['bad-folder/.custom-config/entry.ts', false],
  ['src/my.component/entry.ts', false],
  ['src/_private/entry.ts', false],
  ['src/$private/entry.ts', false],
  ['src/+private/entry.ts', false],
  ['src/(private)/entry.ts', false],
  ['src/@private/entry.ts', false],
] as const;

describe('File and directory naming', () => {
  let root: string;
  let eslint: ESLint;

  beforeAll(async () => {
    root = mkdtempSync(join(tmpdir(), 'protoapps-eslint-naming-'));

    writeFileSync(join(root, 'tsconfig.json'), JSON.stringify({
      compilerOptions: { target: 'ESNext', module: 'ESNext', strict: true },
      include: [...filenames, ...folders].map(([filename]) => filename),
    }));

    for (const [filename] of [...filenames, ...folders]) {
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

  it('does not add unsupported files or tool manifests to the lint scope', async () => {
    assert.equal(await eslint.isPathIgnored('package-lock.json'), true);
    assert.equal(await eslint.isPathIgnored('Example.astro'), true);
  });

  it.each(filenames)('validates filename %s (valid: %s)', async (filename, valid) => {
    const [result] = await eslint.lintFiles([join(root, filename)]);

    assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
    const messages = result.messages.filter(({ ruleId }) => ruleId === 'check-file/filename-naming-convention');
    assert.equal(messages.length, valid ? 0 : 1, JSON.stringify(result.messages));

    for (const message of messages) {
      assert.equal(message.severity, 2);
    }
  });

  it.each(folders)('validates directories in %s (valid: %s)', async (filename, valid) => {
    const [result] = await eslint.lintFiles([join(root, filename)]);

    assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
    const messages = result.messages.filter(({ ruleId }) => ruleId === 'check-file/folder-naming-convention');
    assert.equal(messages.length, valid ? 0 : 1, JSON.stringify(result.messages));

    for (const message of messages) {
      assert.equal(message.severity, 2);
    }
  });

  it('allows scoped filename disabling without disabling directory or base rules', async () => {
    const overridden = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: await createProtoConfig({ tsconfigRootDir: root }, {
        files: ['**/*.legacy.js'],
        rules: { 'check-file/filename-naming-convention': 'off' },
      }),
    });

    for (const [filePath, filenameErrors] of [
      ['bad-folder/bad-name.legacy.js', 0],
      ['bad-folder/bad-name.js', 1],
    ] as const) {
      const [result] = await overridden.lintText('debugger;\n', { filePath });

      assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
      assert.equal(result.messages.filter(({ ruleId }) => ruleId === 'check-file/filename-naming-convention').length, filenameErrors);
      assert.equal(result.messages.filter(({ ruleId }) => ruleId === 'check-file/folder-naming-convention').length, 1);
      assert.equal(result.messages.filter(({ ruleId }) => ruleId === 'no-debugger').length, 1);
    }
  });

  it('keeps content and parent directory checks active for dot-prefixed filenames', async () => {
    const dotFiles = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: await createProtoConfig({
        tsconfigRootDir: root,
        // Consumers can lint additional file types without changing the naming policy.
        additionalCodeFiles: ['**/.env'],
      }),
    });

    for (const [filename, folderErrors] of [
      ['.env', 0],
      ['.js', 0],
      ['.hidden-name.js', 0],
      ['src/.custom-config/.nested-config/.hidden-name.js', 0],
      ['bad-folder/.env', 1],
      ['.custom-config/bad-folder/.hidden-name.js', 1],
    ] as const) {
      const [result] = await dotFiles.lintText('debugger;\n', { filePath: join(root, filename) });

      assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
      assert.equal(result.messages.filter(({ ruleId }) => ruleId === 'check-file/filename-naming-convention').length, 0);
      assert.equal(result.messages.filter(({ ruleId }) => ruleId === 'check-file/folder-naming-convention').length, folderErrors);
      assert.equal(result.messages.filter(({ ruleId }) => ruleId === 'no-debugger').length, 1, JSON.stringify(result.messages));
    }
  });

  it('allows scoped filename options to replace the default policy while preserving directory checks', async () => {
    const overridden = new ESLint({
      cwd: root,
      overrideConfigFile: true,
      overrideConfig: await createProtoConfig({ tsconfigRootDir: root }, {
        files: ['externalFiles/**/*.js'],
        rules: {
          'check-file/filename-naming-convention': ['error', {
            '**/*.js': 'KEBAB_CASE',
          }, { ignoreMiddleExtensions: false }],
        },
      }),
    });

    for (const [filePath, filenameErrors] of [
      ['externalFiles/bad-folder/kebab-name.js', 0],
      ['externalFiles/bad-folder/PascalName.js', 1],
      ['src/bad-folder/kebab-name.js', 1],
    ] as const) {
      const [result] = await overridden.lintText('debugger;\n', { filePath });

      assert.equal(result.fatalErrorCount, 0, JSON.stringify(result.messages));
      assert.equal(result.messages.filter(({ ruleId }) => ruleId === 'check-file/filename-naming-convention').length, filenameErrors);
      assert.equal(result.messages.filter(({ ruleId }) => ruleId === 'check-file/folder-naming-convention').length, 1);
      assert.equal(result.messages.filter(({ ruleId }) => ruleId === 'no-debugger').length, 1);
    }
  });
});
