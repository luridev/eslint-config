import { createProtoConfig, type PlaywrightConfigOptions, type ProtoConfigOptions } from '@protoapps/eslint-config';

const playwright: PlaywrightConfigOptions = { files: ['src/**/*.pwtest.ts'], ignores: ['src/ignored/**'] };
const options: ProtoConfigOptions = { tsconfigRootDir: '.', playwright };

export const config = await createProtoConfig(options);
