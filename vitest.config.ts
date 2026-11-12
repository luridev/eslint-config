import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/*.test.ts', 'tests/base/*.test.ts', 'tests/integrations/*.test.ts'],
    fileParallelism: false,
  },
});
