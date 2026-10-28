// Vite plugin: whole-module swaps for a re-skinned build. `map` keys and values are repo-relative paths
// (resolved against the Vite root); any import that resolves to a key loads its value instead — except
// imports made by the replacement itself, so it can re-export or extend the original.
import { isAbsolute, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';

const clean = (id: string): string => id.split('?')[0].split('\\').join('/');

export function swapModules(map: Readonly<Record<string, string>>): Plugin {
  let root = process.cwd();
  const rel = (id: string): string => clean(relative(root, clean(id)));
  return {
    name: 'swap-modules',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
    },
    async resolveId(source, importer, options) {
      if (!importer) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (!resolved || resolved.external || !isAbsolute(clean(resolved.id))) return resolved;
      const target = map[rel(resolved.id)];
      if (!target || rel(importer) === target) return resolved;
      return resolve(root, target);
    },
  };
}
