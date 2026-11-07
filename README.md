# @protoapps/eslint-config

Opinionated ESLint flat config for JavaScript, TypeScript, and Vue.

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
npm run check:commit
```