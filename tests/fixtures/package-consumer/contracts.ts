import { createProtoConfig, type ProtoConfigOptions } from '@protoapps/eslint-config';

const options: ProtoConfigOptions = {
  tsconfigRootDir: '.',
  languageConfigs: [[{
    files: ['**/*.ts'],
    extends: [{ rules: { 'no-alert': 'warn' } }],
  }]],
};

export const config = createProtoConfig(options,
  { files: ['**/*.ts'], extends: [[{ rules: { 'no-console': 'off' } }]] },
  [[{ files: ['**/*.ts'], rules: { 'no-alert': 'off' } }]]);
