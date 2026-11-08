import type { SpawnSyncReturns } from 'node:child_process';

export type NpmRunResult = SpawnSyncReturns<string | null>;

export type NpmPackResult = {
  filename: string;
  files: Array<{ path: string }>;
};

export type PackageManifest = {
  name: string;
  version: string;
};

export type PackageLock = {
  packages: Record<string, unknown>;
};
