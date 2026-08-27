# @protoapps/eslint-config

Opinionated ESLint flat config for TypeScript and Vue projects with type-aware linting, Stylistic, import rules, and
Vue accessibility checks.

## Requirements

- Node `^20.19.0 || ^22.13.0 || >=24`
- ESLint `^10.0.0`
- TypeScript `~6.0.0`

## Installation

```sh
npm install --save-dev @protoapps/eslint-config eslint typescript
```

## Usage

```ts
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'eslint/config';
import { createProtoConfig } from '@protoapps/eslint-config';

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig(
  ...createProtoConfig({
    tsconfigRootDir,
    vueVersion: '3.5.40',
  }),
);
```

## Options

| Option | Required | Purpose |
| --- | --- | --- |
| `tsconfigRootDir` | yes | Consumer project root for TypeScript services and import resolution. |
| `vueVersion` | yes | Vue version checked by `vue/no-unsupported-features`. |
| `additionalCodeFiles` | no | Additional source globs for JavaScript/common rules. |
| `additionalTypedFiles` | no | Additional globs for TypeScript rules. |
| `additionalResolverExtensions` | no | Additional extensions for import resolution. |
| `stylisticIgnores` | no | Globs excluded from the linebreak and Stylistic scopes. |

Relative TypeScript imports are forbidden, so consumers must configure an alias. LF line endings are enforced.
