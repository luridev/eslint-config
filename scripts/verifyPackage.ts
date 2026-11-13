import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import spawn from 'cross-spawn';
import type { SpawnSyncReturns } from 'node:child_process';

type NpmRunResult = SpawnSyncReturns<string | null>;

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

function run(command: string, args: Array<string>, cwd = root, capture = false): string {
  const label = `${command} ${args.join(' ')}`;
  const started = performance.now();
  const env = { ...process.env };
  delete env.NODE_PATH;
  process.stdout.write(`[package] ${label}\n`);

  const result: NpmRunResult = spawn.sync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['inherit', capture ? 'pipe' : 'inherit', 'inherit'],
  });

  process.stdout.write(`[package] ${(performance.now() - started).toFixed(0)} ms: ${label}\n`);

  if (result.error != null || result.status !== 0 || result.signal != null) {
    if (result.stdout != null && result.stdout !== '') {
      process.stderr.write(result.stdout);
    }

    throw new Error(`${label} failed (exit ${String(result.status)}, signal ${String(result.signal)}).`, { cause: result.error });
  }

  return result.stdout ?? '';
}

const temporaryDirectory = realpathSync(tmpdir());
assert.ok(temporaryDirectory !== root && !temporaryDirectory.startsWith(`${root}${sep}`));
const temporaryRoot = mkdtempSync(join(temporaryDirectory, 'protoapps-eslint-package-'));
process.stdout.write(`[package] Temporary root: ${temporaryRoot}\n`);

try {
  const packData: unknown = JSON.parse(run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', temporaryRoot], root, true));
  assert.ok(typeof packData === 'object' && packData !== null, 'npm pack must return an array or object.');
  const packed: Array<unknown> = Array.isArray(packData) ? packData : Object.values(packData);
  assert.equal(packed.length, 1, 'npm pack must produce one archive.');
  const [tarball] = packed;
  assert.ok(typeof tarball === 'object' && tarball !== null, 'npm pack must return package metadata.');
  assert.ok('filename' in tarball && typeof tarball.filename === 'string', 'npm pack must return a filename.');
  const { filename } = tarball;
  assert.equal(basename(filename), filename, 'The archive must remain inside the temporary root.');
  const archive = join(temporaryRoot, filename);

  run('npm', ['exec', '--no', '--', 'publint', archive, '--strict']);

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

    run('npm', [
      'install', '--no-audit', '--no-fund', '--include=dev', '--cache', npmCache,
      archive, `eslint@${eslintVersion}`, `typescript@${typescriptVersion}`, ...plugins,
    ], consumer);

    const installedPackage = realpathSync(join(consumer, 'node_modules', manifest.name));
    assert.ok(installedPackage.startsWith(`${consumer}${sep}`), 'The package must be installed inside the consumer.');

    const lock = JSON.parse(readFileSync(join(consumer, 'package-lock.json'), 'utf8')) as PackageLock;

    for (const peer of optionalPeers) {
      if (!plugins.some((name) => name.startsWith(`${peer}@`))) {
        assert.ok(
          !Object.keys(lock.packages).some((path) => path.endsWith(`node_modules/${peer}`)),
          `The ${consumerName} installation must not contain ${peer}.`,
        );
      }
    }

    run(process.execPath, [join(consumer, 'node_modules/typescript/bin/tsc'), '--noEmit'], consumer);

    for (const script of scripts) {
      run(process.execPath, [join(consumer, script)], consumer);
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
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
