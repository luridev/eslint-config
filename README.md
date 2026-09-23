# @protoapps/eslint-config

Opinionated ESLint flat config for TypeScript and Vue projects with type-aware linting, Stylistic, import rules, and
Vue accessibility checks and automatic package.json linting.

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

Every `package.json` is included automatically by `createProtoConfig()`. No additional plugin installation or config is
needed. Run `eslint .`, or add `package.json` to an existing ESLint invocation that uses explicit source-file globs.

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
