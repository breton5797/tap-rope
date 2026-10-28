// Vite plugin: whole-module swaps for a re-skinned build. `map` keys and values are repo-relative paths
// (resolved against the Vite root); any import that resolves to a key loads its value instead — except
// imports made by the replacement itself, so it can re-export or extend the original. Requests from an HTML
// page are entries or re-fetches of ids already resolved, never swapped.
import { isAbsolute, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';

const clean = (id: string): string => id.split('?')[0].split('\\').join('/');

export function swapModules(map: Readonly<Record<string, string>>): Plugin {
  let root = process.cwd();
  /** repo-relative path of a module id: an absolute file path, or a root-relative URL id ("/src/…", dev / vitest) */
  const rel = (id: string): string => {
    const file = clean(id);
    return file.startsWith(`${clean(root)}/`) ? clean(relative(root, file)) : file.replace(/^\//, '');
  };
  return {
    name: 'swap-modules',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
    },
    async resolveId(source, importer, options) {
      // no module importer: a page entry, or a fetch of an id resolved earlier (vitest asks with index.html)
      if (!importer || clean(importer).endsWith('.html')) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved || resolved.external || !isAbsolute(clean(resolved.id))) return resolved;
      const target = map[rel(resolved.id)];
      if (!target || rel(importer) === target) return resolved;
      return resolve(root, target);
    },
  };
}
