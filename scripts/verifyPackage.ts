import assert from 'node:assert/strict';
import { cpSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRunner, lintPackage, packPackage, withTemporaryDirectory } from '@protoapps/package-verifier';

type PackageManifest = {
  name: string;
  version: string;
};

type PackageLock = {
  packages: Record<string, unknown>;
};

const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
const require = createRequire(import.meta.url);
const vuePeers = ['eslint-plugin-vue', 'vue-eslint-parser', 'eslint-plugin-vuejs-accessibility'];
const vitestPeer = '@vitest/eslint-plugin';
const playwrightPeer = 'eslint-plugin-playwright';
const optionalPeers = [...vuePeers, vitestPeer, playwrightPeer];

const runner = createRunner({ cwd: root, output: 'inherit', timeout: 600_000 });

await withTemporaryDirectory(async (temporaryRoot) => {
  assert.ok(temporaryRoot !== root && !temporaryRoot.startsWith(`${root}${sep}`));
  const { path: archive } = await packPackage({ cwd: root, destination: temporaryRoot, runner });
  await lintPackage(archive);

  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as PackageManifest;
  const eslintVersion = (JSON.parse(readFileSync(require.resolve('eslint/package.json'), 'utf8')) as PackageManifest).version;
  const typescriptVersion = (JSON.parse(readFileSync(require.resolve('typescript/package.json'), 'utf8')) as PackageManifest).version;
  const npmCache = join(temporaryRoot, 'npm-cache');

  const verifyConsumer = (fixture: string, plugins: Array<string> = [], scripts = ['runtime.mjs'], consumerName = fixture) => {
    const consumer = join(temporaryRoot, consumerName);
    cpSync(join(root, 'tests/fixtures', fixture), consumer, { recursive: true });

    for (const [peer, integration] of [[vitestPeer, 'vitest'], [playwrightPeer, 'playwright']]) {
      if (plugins.some((name) => name.startsWith(`${peer}@`))) {
        cpSync(join(root, `tests/fixtures/${integration}-consumer/src`), join(consumer, 'src'), { recursive: true });

        for (const script of scripts.filter((name) => name.startsWith(`${integration}-`))) {
          cpSync(join(root, `tests/fixtures/package-${integration}-consumer`, script), join(consumer, script));
        }
      }
    }

    writeFileSync(join(consumer, 'package.json'), `${JSON.stringify({
      private: true,
      type: 'module',
      allowScripts: { 'unrs-resolver': false },
    }, null, 2)}\n`);

    runner.npm([
      'install', '--no-audit', '--no-fund', '--include=dev', '--cache', npmCache,
      archive, `eslint@${eslintVersion}`, `typescript@${typescriptVersion}`, ...plugins,
    ], { cwd: consumer });

    const installedPackage = realpathSync(join(consumer, 'node_modules', manifest.name));
    assert.ok(installedPackage.startsWith(`${consumer}${sep}`), 'The package must be installed inside the consumer.');

    const lock = JSON.parse(readFileSync(join(consumer, 'package-lock.json'), 'utf8')) as PackageLock;

    assert.ok(!Object.keys(lock.packages).some((path) => path.endsWith('node_modules/@protoapps/package-verifier')),
      'The consumer must not contain @protoapps/package-verifier.');

    for (const peer of optionalPeers) {
      if (!plugins.some((name) => name.startsWith(`${peer}@`))) {
        assert.ok(
          !Object.keys(lock.packages).some((path) => path.endsWith(`node_modules/${peer}`)),
          `The ${consumerName} installation must not contain ${peer}.`,
        );
      }
    }

    runner.node([join(consumer, 'node_modules/typescript/bin/tsc'), '--noEmit'], { cwd: consumer });

    for (const script of scripts) {
      runner.node([join(consumer, script)], { cwd: consumer });
    }
  };

  verifyConsumer('package-consumer');

  const plugins = vuePeers.map((name) => {
    const { version } = JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')) as PackageManifest;

    return `${name}@${version}`;
  });

  verifyConsumer('package-vue-consumer', plugins, ['runtime.mjs', 'broken-plugin.mjs']);
  const vitestVersion = (JSON.parse(readFileSync(require.resolve(`${vitestPeer}/package.json`), 'utf8')) as PackageManifest).version;
  const vitestPlugin = `${vitestPeer}@${vitestVersion}`;
  const vitestScripts = ['vitest-runtime.mjs', 'vitest-broken-plugin.mjs'];
  verifyConsumer('package-vitest-consumer', [vitestPlugin], vitestScripts);
  verifyConsumer('package-vue-consumer', [...plugins, vitestPlugin], ['vitest-runtime.mjs'], 'package-vue-vitest-consumer');
  const playwrightVersion = (JSON.parse(readFileSync(join(root, 'node_modules', playwrightPeer, 'package.json'), 'utf8')) as PackageManifest).version;
  verifyConsumer('package-playwright-consumer', [`${playwrightPeer}@${playwrightVersion}`], ['playwright-runtime.mjs']);
  process.stdout.write('Package verified successfully.\n');
}, { prefix: 'protoapps-eslint-package-' });
