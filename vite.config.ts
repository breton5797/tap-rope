import { serviceWorker } from './build/service-worker.ts';
import { defineConfig } from 'vitest/config';

const PUBLIC_FILES = ['./manifest.webmanifest', './icon.svg', './icon-maskable.svg', './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

export default defineConfig({
  base: './',
  // the office build (vite.office.config.ts) ships under ./office/ with its own worker
  plugins: [serviceWorker({ publicDir: 'public', publicFiles: PUBLIC_FILES, cachePrefix: 'tap-rope-', skip: ['office/'] })],
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
