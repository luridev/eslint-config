# @protoapps/eslint-config

ESLint flat config for JavaScript, TypeScript, Node, and npm packages with type-aware rules, import checks,
Stylistic formatting, and package.json linting.

## Installation

```sh
npm install --save-dev @protoapps/eslint-config eslint typescript
```

## Usage

```ts
import { createProtoConfig } from '@protoapps/eslint-config';

export default createProtoConfig({
  tsconfigRootDir: import.meta.dirname,
});
```

Run `eslint .` to lint JavaScript, TypeScript, and package.json files. TypeScript files must belong to the project's
TS config. Relative TypeScript imports require an alias; LF line endings are enforced. Set environment globals as needed.

## Options

| Option | Purpose |
| --- | --- |
| `tsconfigRootDir` | Required project root for TypeScript services and import resolution. |
| `additionalCodeFiles` | Additional globs for common rules. |
| `additionalTypedFiles` | Additional globs for TypeScript rules. |
| `additionalResolverExtensions` | Additional import resolution extensions. |
| `additionalStylisticFiles` | Additional globs for Stylistic and LF rules. |
| `languageConfigs` | Advanced extension point for language and framework config packages. |
| `stylisticIgnores` | Globs excluded from Stylistic and LF rules. |

## Overrides

Pass Flat Config overrides after the options to customize rules:

```ts
export default createProtoConfig(
  {
    tsconfigRootDir: import.meta.dirname,
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': 'off',
    },
  },
);
```

Overrides accept the same format as ESLint's `defineConfig`, including `extends` and config arrays:

```ts
createProtoConfig(
  options,
  {
    files: ['**/*.astro'],
    extends: [astro.configs['flat/recommended']],
  },
);
```

## Development

Run `npm run validate` for lint, typecheck, build, tests, and packed-package checks.
