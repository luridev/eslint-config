import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import spawn from 'cross-spawn';

const root = realpathSync(fileURLToPath(new URL('../../', import.meta.url)));
const require = createRequire(import.meta.url);

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
  const { filename } = packed[0];
  assert.equal(basename(filename), filename, 'The archive must remain inside the temporary root.');
  const archive = join(temporaryRoot, filename);

  run('npm', ['exec', '--no', '--', 'publint', archive, '--strict']);

  const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  const eslintVersion = JSON.parse(readFileSync(require.resolve('eslint/package.json'), 'utf8')).version;
  const typescriptVersion = JSON.parse(readFileSync(require.resolve('typescript/package.json'), 'utf8')).version;
  const consumer = join(temporaryRoot, 'consumer');
  cpSync(join(root, 'tests/fixtures/package-consumer'), consumer, { recursive: true });
  writeFileSync(join(consumer, 'package.json'), `${JSON.stringify({
    private: true,
    type: 'module',
    allowScripts: { 'unrs-resolver': false },
  }, null, 2)}\n`);

  run('npm', [
    'install', '--no-audit', '--no-fund', '--include=dev',
    archive, `eslint@${eslintVersion}`, `typescript@${typescriptVersion}`,
  ], consumer);

  const installedPackage = realpathSync(join(consumer, 'node_modules', manifest.name));
  assert.ok(installedPackage.startsWith(`${consumer}${sep}`), 'The package must be installed inside the consumer.');

  run(process.execPath, [join(consumer, 'node_modules/typescript/bin/tsc'), '--noEmit'], consumer);
  run(process.execPath, [join(consumer, 'runtime.mjs')], consumer);
  process.stdout.write('Package verified successfully.\n');
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}
