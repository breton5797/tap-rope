// Office build (office spec §10): every swapped module must keep the v8 export surface, so the shared
// v8 code that imports it builds and runs unchanged against the office version (office may add exports).
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OFFICE_SWAPS } from '../../build/office-swaps';

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
