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

/** ./-relative files under a public dir with this extension (recursive: v7 cutscene stills live in art/cut) */
function listPublic(publicDir: string, dir: string, ext: string): string[] {
  try {
    const files = readdirSync(new URL(`${publicDir}/${dir}`, ROOT), { recursive: true }) as string[];
    return files.filter((f) => f.endsWith(ext)).map((f) => `./${dir}/${f.split('\\').join('/')}`).sort();
  } catch {
    return [];
  }
}

/**
 * The public files a build precaches besides its bundle: art and self-hosted fonts (the game must work offline)
 * and, office v2.1, the sampled sfx in ONE format — .m4a (AAC plays in current Chrome, Safari and Firefox); the
 * .ogg twins are fetched (and runtime-cached by the worker) only where .m4a will not play. v8's public has no sfx.
 */
export function precachedPublicFiles(publicDir: string): string[] {
  return [...listPublic(publicDir, 'art', '.webp'), ...listPublic(publicDir, 'fonts', '.woff2'), ...listPublic(publicDir, 'sfx', '.m4a')];
}

export function serviceWorker(o: ServiceWorkerOptions): Plugin {
  const artFiles = (): string[] => precachedPublicFiles(o.publicDir);
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
