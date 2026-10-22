import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { target: 'es2022', outDir: 'dist' },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      // pure logic is unit-tested; canvas/DOM/audio layers are covered by the e2e smoke run
      include: ['src/core/**/*.ts', 'src/game/{session,bot,hints,feedback,snapshot}.ts'],
      reporter: ['text-summary', 'text'],
    },
  },
});
