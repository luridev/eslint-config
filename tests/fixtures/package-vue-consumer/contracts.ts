import { createProtoConfig, type ProtoConfigOptions, type VueConfigOptions } from '@protoapps/eslint-config';

const vue: VueConfigOptions = { version: '3.5.40' };

const options: ProtoConfigOptions = {
  tsconfigRootDir: '.',
  vue,
  languageConfigs: [[{
    files: ['**/*.vue'],
    extends: [{ rules: { 'no-alert': 'warn' } }],
  }]],
};

export const config = createProtoConfig(options,
  { files: ['**/*.vue'], extends: [[{ rules: { 'vue/html-self-closing': 'off' } }]] },
  [[{ files: ['**/*.vue'], rules: { 'no-alert': 'off' } }]]);
