import { defineConfig } from 'vitest/config';

// Benchmarks live outside the normal `npm test` run because they are slow and print timings.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/perf/**/*.bench.ts'],
    testTimeout: 120_000,
  },
});
