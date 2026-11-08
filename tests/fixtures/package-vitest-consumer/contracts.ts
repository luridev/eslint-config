import { createProtoConfig, type ProtoConfigOptions, type VitestConfigOptions } from '@protoapps/eslint-config';

const vitest: VitestConfigOptions = { files: ['src/**/*.vitest.ts'], ignores: ['src/node-tests/**'] };
const options: ProtoConfigOptions = { tsconfigRootDir: '.', vitest };

export const config = await createProtoConfig(options, [[{
  files: ['**/*.vitest.ts'],
  rules: { 'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'assert', 'expectHelper'] }] },
}]]);
