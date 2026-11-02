// Part 2 corridor art (part 2 spec §2): the office ArtStore also fetches the three new outdoor themes
// (walls, floor, ceiling of 4 거리 / 5 지하철역 / 6 먹자골목) without holding the loading screen for them.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArtStore } from '../../src/render/art';

afterEach(() => vi.unstubAllGlobals());

describe('office ArtStore themes', () => {
  it('requests walls, floor and ceiling of themes 4–6 and reports progress over the part-1 files only', async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      asked.push(url);
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    const totals = new Set<number>();
    await new ArtStore().load((_d, total) => totals.add(total));
    for (const t of [4, 5, 6]) {
      for (const f of [`wall-${t}-a`, `wall-${t}-b`, `wall-${t}-c`, `floor-${t}`, `ceiling-${t}`]) expect(asked).toContain(`./art/${f}.webp`);
    }
    expect([...totals]).toEqual([20]);
  });

  it('a part-2 scene waits for its own files while they are in flight', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    vi.stubGlobal('fetch', async (url: string) => {
      if (url.includes('-5')) await gate;
      return new Response(null, { status: 404 });
    });
    const art = new ArtStore();
    await art.load();
    expect(art.waiting(5, 'base')).toBe(true);
    expect(art.waiting(1, 'base')).toBe(false);
    release();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(art.waiting(5, 'base')).toBe(false);
  });
});
