import { createProtoConfig, type ProtoConfigOptions } from '@protoapps/eslint-config';
import { defineConfig } from 'eslint/config';

const options: ProtoConfigOptions = {
  tsconfigRootDir: '.',
  languageConfigs: [[{
    files: ['**/*.ts'],
    extends: [{ rules: { 'no-alert': 'warn' } }],
  }]],
};

const configPromise: Promise<ReturnType<typeof defineConfig>> = createProtoConfig(options,
  { files: ['**/*.ts'], extends: [[{ rules: { 'no-console': 'off' } }]] },
  [[{ files: ['**/*.ts'], rules: { 'no-alert': 'off' } }]]);

export const config = defineConfig(await configPromise);
export const spreadConfig = [...await configPromise];

export default configPromise;
