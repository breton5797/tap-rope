// Emits sw.js from sw/sw.template.js with a content-derived cache version and the full hashed-asset precache
// list. Shared by the v8 build (vite.config.ts) and the office build (vite.office.config.ts): each build has its
// own public dir, cache-name prefix and sub-paths its worker leaves alone.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

export interface ServiceWorkerOptions {
  /** repo-relative public dir (art / fonts are listed from it) */
  readonly publicDir: string;
  /** ./-relative files copied from the public dir that must be precached */
  readonly publicFiles: readonly string[];
  /** cache names are `${cachePrefix}${version}`; activation deletes only older caches with this prefix */
  readonly cachePrefix: string;
  /** scope-relative path prefixes served by another worker (a sub-app), e.g. 'office/' */
  readonly skip: readonly string[];
}

const ROOT = new URL('../', import.meta.url);

export function serviceWorker(o: ServiceWorkerOptions): Plugin {
  /** v6 photographic art (public/art) and self-hosted fonts (public/fonts) are precached too (the game must work offline) */
  const listPublic = (dir: string, ext: string): string[] => {
    try {
      // recursive: v7 cutscene stills live in public/art/cut
      const files = readdirSync(new URL(`${o.publicDir}/${dir}`, ROOT), { recursive: true }) as string[];
      return files.filter((f) => f.endsWith(ext)).map((f) => `./${dir}/${f.split('\\').join('/')}`).sort();
    } catch {
      return [];
    }
  };
  const artFiles = (): string[] => [...listPublic('art', '.webp'), ...listPublic('fonts', '.woff2')];
  return {
    name: 'tap-rope-sw',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map')).sort();
      const art = artFiles();
      const precache = ['./', ...built.map((f) => `./${f}`), ...o.publicFiles, ...art];
      const hash = createHash('sha256').update(built.join('|'));
      // art keeps its file names across edits, so its bytes go into the cache version
      for (const f of art) hash.update(readFileSync(new URL(`${o.publicDir}/${f.slice(2)}`, ROOT)));
      const version = hash.digest('hex').slice(0, 12);
      const source = readFileSync(new URL('sw/sw.template.js', ROOT), 'utf8')
        .replace('__CACHE_PREFIX__', JSON.stringify(o.cachePrefix))
        .replace('__VERSION__', version)
        .replace('__SKIP__', JSON.stringify(o.skip))
        .replace('__PRECACHE__', JSON.stringify(precache));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}
