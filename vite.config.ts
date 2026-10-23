import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const PUBLIC_FILES = ['./manifest.webmanifest', './icon.svg', './icon-maskable.svg'];

/** Emits sw.js with a content-derived cache version and the full hashed-asset precache list. */
function serviceWorker(): Plugin {
  return {
    name: 'tap-rope-sw',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map')).sort();
      const precache = ['./', ...built.map((f) => `./${f}`), ...PUBLIC_FILES];
      const version = createHash('sha256').update(built.join('|')).digest('hex').slice(0, 12);
      const source = readFileSync(new URL('./sw/sw.template.js', import.meta.url), 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(precache));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
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
