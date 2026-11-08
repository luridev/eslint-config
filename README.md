# @protoapps/eslint-config

Opinionated ESLint flat config for JavaScript, TypeScript, Vue, and Vitest.

## Installation

```sh
npm install -D @protoapps/eslint-config eslint typescript
```

## Usage

```ts
import { createProtoConfig } from '@protoapps/eslint-config';

export default createProtoConfig({
  tsconfigRootDir: import.meta.dirname,
});
```

`createProtoConfig()` is asynchronous and returns a Promise of the config array.
ESLint resolves the default export automatically. Await the factory when composing
configs programmatically or passing the result to the ESLint API:

```ts
import { createProtoConfig } from '@protoapps/eslint-config';
import { defineConfig } from 'eslint/config';

export default defineConfig(
  await createProtoConfig({ tsconfigRootDir: import.meta.dirname }),
  { rules: { 'no-console': 'off' } },
);
```

## Vue

Install the additional ESLint plugins:

```sh
npm install -D eslint-plugin-vue vue-eslint-parser eslint-plugin-vuejs-accessibility
```

Enable Vue support and specify the target Vue version:

```ts
import { createProtoConfig } from '@protoapps/eslint-config';

export default createProtoConfig({
  tsconfigRootDir: import.meta.dirname,
  vue: { version: '3.5.40' },
});
```

## Vitest

Install the additional ESLint plugin:

```sh
npm install -D @vitest/eslint-plugin
```

Enable strict Vitest rules for `**/*.vitest.ts`:

```ts
export default createProtoConfig({
  tsconfigRootDir: import.meta.dirname,
  vitest: true,
});
```

For other naming conventions, use `vitest: { files: ['src/**/*.test.ts'], ignores: ['src/node-tests/**'] }`.

## Customization

Pass additional [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files) entries after the options:

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

Additional options for file patterns, import resolution, formatting exclusions, and language configurations are available through `ProtoConfigOptions`.

## Development

```sh
npm run test:unit
npm run test:package
npm run check:commit
```
