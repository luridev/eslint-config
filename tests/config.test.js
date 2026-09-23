import assert from 'node:assert/strict';
import { dirname, join, normalize } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import ts from 'typescript';
import { createProtoConfig } from '@protoapps/eslint-config';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const consumerRoot = join(packageRoot, 'tests', 'fixtures', 'consumer');

const createConfig = (options = {}) => createProtoConfig({
  tsconfigRootDir: consumerRoot,
  vueVersion: '3.5.40',
  ...options,
});

const createEslint = (options = {}) => new ESLint({
  cwd: consumerRoot,
  overrideConfigFile: true,
  overrideConfig: createConfig(options),
});

const configFor = (filename, options = {}) => (
  createEslint(options).calculateConfigForFile(join(consumerRoot, 'src', filename))
);

const effectiveConfigFor = async (filename, options = {}) => {
  const config = await configFor(filename, options);

  assert.ok(config, `Expected an effective config for ${filename}`);

  return config;
};

const typescriptResolverFor = async (options = {}) => {
  const config = await effectiveConfigFor('entry.ts', options);
  const resolvers = config.settings?.['import-x/resolver-next'];

  assert.ok(Array.isArray(resolvers));

  const resolver = resolvers.find((candidate) => candidate.name === 'eslint-import-resolver-typescript');

  assert.ok(resolver);

  return resolver;
};

test('runtime and TypeScript consumers can import the public API', async () => {
  const packageModule = await import('@protoapps/eslint-config');

  assert.equal(packageModule.createProtoConfig, createProtoConfig);
  assert.deepEqual(Object.keys(packageModule), ['createProtoConfig']);

  const consumerFile = join(consumerRoot, 'src', 'public-api.ts');
  const program = ts.createProgram({
    rootNames: [consumerFile],
    options: {
      module: ts.ModuleKind.NodeNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      noEmit: true,
      skipLibCheck: true,
      strict: true,
      target: ts.ScriptTarget.ES2023,
      types: [],
    },
  });
  const diagnostics = ts.getPreEmitDiagnostics(program).map((diagnostic) => (
    ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
  ));

  assert.deepEqual(diagnostics, []);
});

test('factory produces a valid flat config', async () => {
  const configs = createConfig();

  assert.ok(Array.isArray(configs));
  assert.ok(configs.every((config) => typeof config === 'object' && config !== null));
  assert.ok(await effectiveConfigFor('entry.ts'));
});

test('factory includes the effective package.json config', async () => {
  const config = await createEslint().calculateConfigForFile(join(consumerRoot, 'package.json'));

  assert.ok(config);
  assert.equal(config.language, config.plugins.json.languages.json);
  assert.ok(config.plugins['package-json']);
  assert.equal(config.rules['package-json/sort-scripts'][0], 2);
});

test('effective TypeScript config includes typed, Stylistic, import, and LF policies', async () => {
  const config = await effectiveConfigFor('entry.ts');
  const relativeImportRule = config.rules['@typescript-eslint/no-restricted-imports'];

  assert.equal(config.languageOptions.parserOptions.projectService, true);
  assert.equal(config.languageOptions.parserOptions.tsconfigRootDir, consumerRoot);
  assert.equal(config.rules['@typescript-eslint/no-unnecessary-condition'][0], 2);
  assert.equal(config.rules['@typescript-eslint/dot-notation'][0], 2);
  assert.equal(config.rules['@stylistic/semi'][0], 2);
  assert.deepEqual(config.rules['@stylistic/linebreak-style'], [2, 'unix']);
  assert.equal(relativeImportRule[0], 2);
  assert.deepEqual(relativeImportRule[1].patterns[0].group, ['./**', '../**']);
  assert.equal(
    relativeImportRule[1].patterns[0].message,
    'Use the configured alias instead of a relative import.',
  );
});

test('effective Vue config includes Vue, accessibility, version, and Stylistic policies', async () => {
  const currentConfig = await effectiveConfigFor('component.vue');
  const olderConfig = await effectiveConfigFor('component.vue', { vueVersion: '3.4.0' });

  assert.equal(currentConfig.rules['vue/no-duplicate-attributes'][0], 2);
  assert.equal(currentConfig.rules['vuejs-accessibility/alt-text'][0], 2);
  assert.deepEqual(currentConfig.rules['vue/no-unsupported-features'], [2, { version: '3.5.40' }]);
  assert.deepEqual(olderConfig.rules['vue/no-unsupported-features'], [2, { version: '3.4.0' }]);
  assert.equal(currentConfig.rules['vue/block-tag-newline'][0], 2);
});

test('consumer tsconfig root and paths drive TypeScript import resolution', async () => {
  const resolver = await typescriptResolverFor();
  const importer = join(consumerRoot, 'src', 'entry.ts');
  const result = resolver.resolve('@fixture/standard', importer);

  assert.equal(result.found, true);
  assert.equal(normalize(result.path), normalize(join(consumerRoot, 'src', 'standard.ts')));
});

test('generic file and Stylistic options affect effective config behavior', async () => {
  const codeWithoutOption = await configFor('sample.code');
  const codeWithOption = await effectiveConfigFor('sample.code', {
    additionalCodeFiles: ['**/*.code'],
  });
  const typedWithoutOption = await configFor('sample.typed');
  const typedWithOption = await effectiveConfigFor('sample.typed', {
    additionalTypedFiles: ['**/*.typed'],
  });
  const styledConfig = await effectiveConfigFor('generated.ts');
  const ignoredStylisticConfig = await effectiveConfigFor('generated.ts', {
    stylisticIgnores: ['**/generated.ts'],
  });
  const ignoredVueStylisticConfig = await effectiveConfigFor('component.vue', {
    stylisticIgnores: ['**/component.vue'],
  });

  assert.equal(codeWithoutOption?.rules?.eqeqeq, undefined);
  assert.equal(codeWithOption.rules.eqeqeq[0], 2);
  assert.equal(typedWithoutOption?.rules?.['@typescript-eslint/no-unnecessary-condition'], undefined);
  assert.equal(typedWithOption.rules['@typescript-eslint/no-unnecessary-condition'][0], 2);
  assert.deepEqual(styledConfig.rules['@stylistic/linebreak-style'], [2, 'unix']);
  assert.equal(styledConfig.rules['@stylistic/semi'][0], 2);
  assert.equal(ignoredStylisticConfig.rules['@stylistic/linebreak-style'], undefined);
  assert.equal(ignoredStylisticConfig.rules['@stylistic/semi'], undefined);
  assert.equal(ignoredStylisticConfig.rules['@typescript-eslint/no-unnecessary-condition'][0], 2);
  assert.equal(ignoredVueStylisticConfig.rules['@stylistic/linebreak-style'], undefined);
  assert.equal(ignoredVueStylisticConfig.rules['@stylistic/semi'], undefined);
  assert.equal(ignoredVueStylisticConfig.rules['vue/block-tag-newline'], undefined);
  assert.equal(ignoredVueStylisticConfig.rules['vue/no-duplicate-attributes'][0], 2);
  assert.equal(ignoredVueStylisticConfig.rules['vuejs-accessibility/alt-text'][0], 2);
  assert.equal(ignoredVueStylisticConfig.rules['@typescript-eslint/no-unnecessary-condition'][0], 2);
});

test('additional resolver extensions are generic and opt-in', async () => {
  const importer = join(consumerRoot, 'src', 'entry.ts');
  const withoutExtension = (await typescriptResolverFor()).resolve('@fixture/custom', importer);
  const withExtension = (await typescriptResolverFor({
    additionalResolverExtensions: ['.fixture'],
  })).resolve('@fixture/custom', importer);

  assert.equal(withoutExtension.found, false);
  assert.equal(withExtension.found, true);
  assert.equal(normalize(withExtension.path), normalize(join(consumerRoot, 'src', 'custom.fixture')));
});
