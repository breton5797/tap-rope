import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { OFFICE_SWAPS } from './build/office-swaps.ts';
import { serviceWorker } from './build/service-worker.ts';
import { swapModules } from './build/swap-modules.ts';
import { defineConfig } from 'vitest/config';

/** the office project transforms the same sources differently (swapped imports): it gets its own transform
 * cache, keyed by the swap plugin and map so a change to either never reuses stale output */
const OFFICE_CACHE = `node_modules/.vitest-cache/office-${createHash('sha256')
  .update(readFileSync(new URL('./build/swap-modules.ts', import.meta.url)))
  .update(JSON.stringify(OFFICE_SWAPS))
  .digest('hex')
  .slice(0, 12)}`;

const PUBLIC_FILES = ['./manifest.webmanifest', './icon.svg', './icon-maskable.svg', './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];

export default defineConfig({
  base: './',
  // the office build (vite.office.config.ts) ships under ./office/ with its own worker
  plugins: [serviceWorker({ publicDir: 'public', publicFiles: PUBLIC_FILES, cachePrefix: 'tap-rope-', skip: ['office/'] })],
  build: { target: 'es2022', outDir: 'dist' },
  test: {
    environment: 'node',
    // two module graphs: v8 as shipped, and the office build's (src/office swapped in, as vite.office.config.ts
    // does). *.parity.test.ts compare the two builds side by side, so they run on the v8 graph.
    projects: [
      {
        extends: true,
        test: { name: 'v8', include: ['tests/**/*.test.ts'], exclude: ['tests/office/**'] },
      },
      { extends: true, test: { name: 'parity', include: ['tests/office/**/*.parity.test.ts'] } },
      {
        extends: true,
        plugins: [swapModules(OFFICE_SWAPS)],
        test: {
          name: 'office', include: ['tests/office/**/*.test.ts'], exclude: ['tests/office/**/*.parity.test.ts'], fsModuleCachePath: OFFICE_CACHE,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      // pure logic is unit-tested; canvas/DOM/audio layers are covered by the e2e smoke run
      include: ['src/core/**/*.ts', 'src/game/{session,bot,hints,feedback,snapshot}.ts'],
      reporter: ['text-summary', 'text'],
    },
  },
});
