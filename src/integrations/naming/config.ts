import type { Linter } from 'eslint';

const name = '[A-Za-z]*([A-Za-z0-9])';
const pascalName = '[A-Z]*([A-Za-z0-9])';
const suffixes = `*(.${name})`;
const filePath = '*(*/|.*/)[^.]*';

export const namingRules: Linter.RulesRecord = {
  'check-file/filename-naming-convention': ['error', {
    [`${filePath}.{js,cjs,mjs,jsx,ts,cts,mts,tsx}`]: `${name}${suffixes}`,
    [`${filePath}.vue`]: `${pascalName}${suffixes}`,
  }, { ignoreMiddleExtensions: false }],
  'check-file/folder-naming-convention': ['error', {
    '**/*/': `@(${name}|.*)`,
  }],
};
