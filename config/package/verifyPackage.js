import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import spawn from 'cross-spawn';

const root = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const require = createRequire(import.meta.url);
const vuePeers = ['eslint-plugin-vue', 'vue-eslint-parser', 'eslint-plugin-vuejs-accessibility'];
const vitestPeer = '@vitest/eslint-plugin';

function run(command, args, cwd = root, capture = false) {
  const label = `${command} ${args.join(' ')}`;
  const started = performance.now();
  const env = { ...process.env };
  delete env.NODE_PATH;
  process.stdout.write(`[package] ${label}\n`);

  const result = spawn.sync(command, args, {
    cwd,
    env,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['inherit', capture ? 'pipe' : 'inherit', 'inherit'],
  });

  process.stdout.write(`[package] ${(performance.now() - started).toFixed(0)} ms: ${label}\n`);

  if (result.error != null || result.status !== 0 || result.signal != null) {
    if (result.stdout) {
      process.stderr.write(result.stdout);
    }

    throw new Error(`${label} failed (exit ${result.status}, signal ${result.signal}).`, { cause: result.error });
  }

  return result.stdout;
}

run('npm', ['test']);

const temporaryDirectory = realpathSync(tmpdir());
assert.ok(temporaryDirectory !== root && !temporaryDirectory.startsWith(`${root}${sep}`));
const temporaryRoot = mkdtempSync(join(temporaryDirectory, 'protoapps-eslint-package-'));
process.stdout.write(`[package] Temporary root: ${temporaryRoot}\n`);

try {
  const packed = JSON.parse(run('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', temporaryRoot], root, true));
  assert.equal(packed.length, 1, 'npm pack must produce one archive.');
  const { filename, files } = packed[0];
  assert.equal(basename(filename), filename, 'The archive must remain inside the temporary root.');
  const archive = join(temporaryRoot, filename);
  const packedFiles = new Set(files.map((file) => file.path));

  for (const module of ['index', 'base', 'integrations/vue', 'integrations/vitest']) {
    for (const extension of ['js', 'd.ts']) {
      const filename = `dist/${module}.${extension}`;
      assert.ok(packedFiles.has(filename), `The archive must contain ${filename}.`);
    }
  }

  run('npm', ['exec', '--no', '--', 'publint', archive, '--strict']);

  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const eslintVersion = JSON.parse(readFileSync(require.resolve('eslint/package.json'), 'utf8')).version;
  const typescriptVersion = JSON.parse(readFileSync(require.resolve('typescript/package.json'), 'utf8')).version;
  const npmCache = join(temporaryRoot, 'npm-cache');

  const verifyConsumer = (fixture, plugins = [], scripts = ['runtime.mjs'], name = fixture) => {
    const consumer = join(temporaryRoot, name);
    cpSync(join(root, 'tests/fixtures', fixture), consumer, { recursive: true });
    const withVitest = plugins.some((name) => name.startsWith(`${vitestPeer}@`));

    if (withVitest) {
      cpSync(join(root, 'tests/fixtures/vitest-consumer/src'), join(consumer, 'src'), { recursive: true });
      for (const script of scripts.filter((name) => name.startsWith('vitest-'))) {
        cpSync(join(root, 'tests/fixtures/package-vitest-consumer', script), join(consumer, script));
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

    const lock = JSON.parse(readFileSync(join(consumer, 'package-lock.json'), 'utf8'));

    for (const peer of [...vuePeers, vitestPeer]) {
      if (!plugins.some((name) => name.startsWith(`${peer}@`))) {
        assert.ok(
          !Object.keys(lock.packages).some((path) => path.endsWith(`node_modules/${peer}`)),
          `The ${name} installation must not contain ${peer}.`,
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
    const { version } = JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8'));

    return `${name}@${version}`;
  });
  verifyConsumer('package-vue-consumer', plugins, ['runtime.mjs', 'disabled.mjs', 'broken-plugin.mjs']);
  const vitestVersion = JSON.parse(readFileSync(require.resolve(`${vitestPeer}/package.json`), 'utf8')).version;
  const vitestPlugin = `${vitestPeer}@${vitestVersion}`;
  const vitestScripts = ['vitest-runtime.mjs', 'vitest-disabled.mjs', 'vitest-broken-plugin.mjs'];
  verifyConsumer('package-vitest-consumer', [vitestPlugin], vitestScripts);
  verifyConsumer('package-vue-consumer', [...plugins, vitestPlugin], ['vitest-runtime.mjs'], 'package-vue-vitest-consumer');
  process.stdout.write('Package verified successfully.\n');
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
