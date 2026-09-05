import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
  define: {
    __QA_BUILD__: JSON.stringify(false),
  },
});
