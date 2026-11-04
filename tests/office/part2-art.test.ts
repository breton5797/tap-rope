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

describe('office ArtStore: stage 10 night street set', () => {
  /** a fetch that serves `ok` files as tiny images and 404s the rest */
  const serve = (ok: readonly string[]) => (url: string) => {
    const name = url.replace('./art/', '').replace('.webp', '');
    return Promise.resolve(ok.includes(name)
      ? new Response(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/webp' }), { status: 200, headers: { 'content-type': 'image/webp' } })
      : new Response(null, { status: 404 }));
  };
  const BASE4 = ['wall-4-a', 'wall-4-b', 'wall-4-c', 'floor-4', 'ceiling-4'];
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('requests the night files of theme 4', async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', (url: string) => {
      asked.push(url);
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    await new ArtStore().load();
    for (const f of ['wall-4-night-a', 'wall-4-night-b', 'wall-4-night-c', 'floor-4-night']) expect(asked).toContain(`./art/${f}.webp`);
  });

  it('uses the night walls / floor when they exist (base ceiling, no sky, painted = no extra dusk tint)', async () => {
    vi.stubGlobal('fetch', serve([...BASE4, 'wall-4-night-a', 'wall-4-night-b', 'floor-4-night']));
    const art = new ArtStore();
    await art.load();
    await settle();
    const set = art.photoSet(4, 'night');
    expect(set?.walls).toEqual(['wall-4-night-a', 'wall-4-night-b']);
    expect(set?.floor).toBe('floor-4-night');
    expect(set?.ceiling).toBe('ceiling-4');
    expect(set?.sky).toBeNull();
    expect(set?.painted).toBe(true);
    expect(art.photoSet(4, 'base')?.walls).toEqual(['wall-4-a', 'wall-4-b', 'wall-4-c']);
  });

  it('falls back to the base street (dusk-tinted) without night files', async () => {
    vi.stubGlobal('fetch', serve(BASE4));
    const art = new ArtStore();
    await art.load();
    await settle();
    const set = art.photoSet(4, 'night');
    expect(set?.walls).toEqual(['wall-4-a', 'wall-4-b', 'wall-4-c']);
    expect(set?.floor).toBe('floor-4');
    expect(set?.painted).toBeFalsy();
  });
});
