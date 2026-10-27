import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const PUBLIC_FILES = ['./manifest.webmanifest', './icon.svg', './icon-maskable.svg'];
/** v6 photographic art (public/art) and self-hosted fonts (public/fonts) are precached too (the game must work offline) */
const listPublic = (dir: string, ext: string): string[] => {
  try {
    // recursive: v7 cutscene stills live in public/art/cut
    const files = readdirSync(new URL(`./public/${dir}`, import.meta.url), { recursive: true }) as string[];
    return files.filter((f) => f.endsWith(ext)).map((f) => `./${dir}/${f.split('\\').join('/')}`).sort();
  } catch {
    return [];
  }
};
const artFiles = (): string[] => [...listPublic('art', '.webp'), ...listPublic('fonts', '.woff2')];

/** Emits sw.js with a content-derived cache version and the full hashed-asset precache list. */
function serviceWorker(): Plugin {
  return {
    name: 'tap-rope-sw',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map')).sort();
      const art = artFiles();
      const precache = ['./', ...built.map((f) => `./${f}`), ...PUBLIC_FILES, ...art];
      const hash = createHash('sha256').update(built.join('|'));
      // art keeps its file names across edits, so its bytes go into the cache version
      for (const f of art) hash.update(readFileSync(new URL(`./public/${f.slice(2)}`, import.meta.url)));
      const version = hash.digest('hex').slice(0, 12);
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
