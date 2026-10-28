// Office build (office spec §10): every swapped module must keep the v8 export surface, so the shared
// v8 code that imports it builds and runs unchanged against the office version (office may add exports).
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OFFICE_SWAPS } from '../../build/office-swaps';
import { swapModules } from '../../build/swap-modules';

const load = (path: string): Promise<Record<string, unknown>> => import(/* @vite-ignore */ new URL(`../../${path}`, import.meta.url).href);

describe('office module swaps', () => {
  it('maps v8 modules under src/ to src/office/<same relative path>', () => {
    const pairs = Object.entries(OFFICE_SWAPS);
    expect(pairs.length).toBeGreaterThan(0);
    for (const [v8, office] of pairs) {
      expect(v8.startsWith('src/') && !v8.startsWith('src/office/')).toBe(true);
      expect(office).toBe(v8.replace(/^src\//, 'src/office/'));
      expect(existsSync(new URL(`../../${v8}`, import.meta.url))).toBe(true);
      expect(existsSync(new URL(`../../${office}`, import.meta.url))).toBe(true);
    }
  });

  it.each(Object.entries(OFFICE_SWAPS))('%s keeps its exports in the office version', async (v8Path, officePath) => {
    const [v8, office] = await Promise.all([load(v8Path), load(officePath)]);
    const officeKeys = new Set(Object.keys(office));
    expect(Object.keys(v8).filter((k) => !officeKeys.has(k))).toEqual([]);
  });
});

describe('swapModules', () => {
  const root = '/repo';
  const plugin = swapModules({ 'src/a.ts': 'src/office/a.ts' });
  (plugin.configResolved as (c: { root: string }) => void)({ root });
  const resolveId = plugin.resolveId as (this: unknown, s: string, i: string | undefined, o: object) => Promise<unknown>;
  const ctx = { resolve: async () => ({ id: `${root}/src/a.ts` }) };
  const swapOf = async (importer: string): Promise<string> => {
    const r = (await resolveId.call(ctx, './a', importer, {})) as string | { id: string };
    return typeof r === 'string' ? r : r.id;
  };

  it('redirects any other importer to the replacement', async () => {
    expect(await swapOf(`${root}/src/game/app.ts`)).toBe(`${root}/src/office/a.ts`);
    expect(await swapOf('/src/game/app.ts')).toBe(`${root}/src/office/a.ts`);
  });

  it('leaves fetches of already-resolved ids alone (vitest re-fetches them with index.html as importer)', async () => {
    expect(await resolveId.call(ctx, '/src/a.ts', `${root}/index.html`, {})).toBeNull(); // Vite's own resolution
  });

  it('lets the replacement import its original, by file path or root-relative id (dev / vitest)', async () => {
    expect(await swapOf(`${root}/src/office/a.ts`)).toBe(`${root}/src/a.ts`);
    expect(await swapOf('/src/office/a.ts')).toBe(`${root}/src/a.ts`);
  });
});
