import type { ESLint, Linter } from 'eslint';
import type { defineConfig } from 'eslint/config';
import type { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import type { FlatConfig } from 'typescript-eslint';
import type { ProtoConfigOptions } from '@protoapps/eslint-config';

export type TestConfigOptions = Partial<ProtoConfigOptions>;

export type ConfigOverrides = Parameters<typeof defineConfig>;

export type RestrictedImportsOptions = {
  patterns: Array<{ group: Array<string>; message: string }>;
};

export type EffectiveConfig = Omit<Linter.Config, 'rules' | 'settings' | 'languageOptions'> & {
  rules: Partial<Record<string, [Linter.Severity, ...Array<unknown>]>> & {
    '@typescript-eslint/no-restricted-imports'?: [Linter.Severity, RestrictedImportsOptions?];
  };
  settings: {
    'import-x/resolver-next'?: Array<ReturnType<typeof createTypeScriptImportResolver>>;
    vitest?: { typecheck?: boolean };
  };
  languageOptions: Pick<Linter.LanguageOptions, 'ecmaVersion' | 'sourceType' | 'globals' | 'parser'> & {
    parserOptions: FlatConfig.ParserOptions;
  };
};

export type TestESLint = Omit<ESLint, 'calculateConfigForFile'> & {
  calculateConfigForFile: (filePath: string) => Promise<EffectiveConfig | undefined>;
};
