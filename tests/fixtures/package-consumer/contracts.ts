import { createProtoConfig, type ProtoConfigOptions } from '@protoapps/eslint-config';

const options: ProtoConfigOptions = {
  tsconfigRootDir: '.',
};

export const config = createProtoConfig(options);
