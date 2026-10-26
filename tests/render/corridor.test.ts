// Corridor photo-cache probe (review H1): when a theme has photo art, a stage start must reach a
// COMPLETE photo cache within a few frames for every theme × variant, and the procedural look must
// never be drawn for it — not even while the art is still downloading. Runs the real Corridor /
// ArtStore against a fake 2D canvas, fetch and createImageBitmap (vitest runs in node).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ArtStore } from '../../src/render/art';
import { Corridor } from '../../src/render/corridor';
import { computeView } from '../../src/render/view';
import type { Scene, Variant, WorldId } from '../../src/types';

const THEMES: readonly WorldId[] = [0, 1, 2, 3];
const VARIANTS: readonly Variant[] = ['base', 'alarm', 'dark', 'steam', 'night', 'dawn'];
/** frames a stage start may take to show its finished photo scene */
const MAX_FRAMES = 30;

/** A 2D context that accepts every call (gradients / patterns are inert objects). */
function fakeCtx(): CanvasRenderingContext2D {
  const store: Record<string | symbol, unknown> = {};
  return new Proxy(store, {
    get(t, p) {
      if (p in t) return t[p];
      return () => ({ addColorStop() {} });
    },
    set(t, p, v) {
      t[p] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

interface Net {
  exteriors: boolean;
  /** resolves the pending fetches (lets a test render frames while the art is still downloading) */
  release: () => void;
  gate: Promise<void>;
}

const saved: Record<string, unknown> = {};

function install(net: Net): void {
  const g = globalThis as unknown as Record<string, unknown>;
  for (const k of ['document', 'createImageBitmap', 'fetch']) saved[k] = g[k];
  g.document = { createElement: () => ({ width: 0, height: 0, getContext: () => fakeCtx() }) };
  g.createImageBitmap = async () => ({ width: 1024, height: 640, close() {} });
  g.fetch = async (url: string) => {
    await net.gate;
    const name = String(url).split('/').pop() ?? '';
    const exterior = /-(night|dawn)/.test(name);
    if (exterior && !net.exteriors) return { ok: false, headers: { get: () => 'text/html' } };
    return { ok: true, headers: { get: () => 'image/webp' }, blob: async () => new Blob(['webp']) };
  };
}

function makeNet(exteriors: boolean, gated: boolean): Net {
  let release = (): void => {};
  const gate = gated ? new Promise<void>((r) => { release = r; }) : Promise.resolve();
  return { exteriors, release, gate };
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** Run frames like the renderer does; returns the frame the photo scene was complete (or -1). */
async function runFrames(c: Corridor, scene: Scene, frames: number, onFrame?: (i: number) => void): Promise<number> {
  const v = computeView(390, 844, 3);
  const ctx = fakeCtx();
  for (let i = 0; i < frames; i++) {
    c.sync(v, scene, null);
    c.drawScene(ctx, v, scene, i * 4, i / 60, 0, 0);
    c.endFrame();
    onFrame?.(i);
    const p = c.probe(scene);
    if (p && p.photo && p.complete) return i;
    await tick();
  }
  return -1;
}

describe('corridor photo cache (H1)', () => {
  afterEach(() => {
    const g = globalThis as unknown as Record<string, unknown>;
    for (const [k, v] of Object.entries(saved)) g[k] = v;
  });

  describe('every theme × variant completes its photo cache after a stage start', () => {
    beforeEach(() => install(makeNet(false, false)));
    for (const world of THEMES) {
      for (const variant of VARIANTS) {
        it(`theme ${world} ${variant}`, async () => {
          const art = new ArtStore();
          await art.load();
          const corridor = new Corridor(art);
          const scene: Scene = { world, variant };
          let procedural = false;
          const done = await runFrames(corridor, scene, MAX_FRAMES, () => {
            const p = corridor.probe(scene);
            if (p && !p.photo) procedural = true;
          });
          expect(done).toBeGreaterThanOrEqual(0);
          expect(procedural).toBe(false);
        });
      }
    }
  });

  it('never draws the procedural look while the art is still downloading', async () => {
    const net = makeNet(false, true);
    install(net);
    const art = new ArtStore();
    const loading = art.load();
    const corridor = new Corridor(art);
    const scene: Scene = { world: 2, variant: 'base' };
    // frames rendered before any file has arrived: neutral stand-in only (probe = null)
    await runFrames(corridor, scene, 5, () => expect(corridor.probe(scene)).toBeNull());
    net.release();
    await loading;
    let procedural = false;
    const done = await runFrames(corridor, scene, MAX_FRAMES, () => {
      const p = corridor.probe(scene);
      if (p && !p.photo) procedural = true;
    });
    expect(done).toBeGreaterThanOrEqual(0);
    expect(procedural).toBe(false);
  });

  it('theme 0 night / dawn use the exterior set (open sky) when present', async () => {
    install(makeNet(true, false));
    const art = new ArtStore();
    await art.load();
    for (const variant of ['night', 'dawn'] as const) {
      const corridor = new Corridor(art);
      const scene: Scene = { world: 0, variant };
      expect(await runFrames(corridor, scene, MAX_FRAMES)).toBeGreaterThanOrEqual(0);
      expect(corridor.probe(scene)?.sky).toBe(true);
    }
  });

  it('a theme whose photos all fail to decode becomes a plain procedural theme', async () => {
    install(makeNet(false, false));
    (globalThis as unknown as Record<string, unknown>).createImageBitmap = async () => {
      throw new Error('decode failed');
    };
    const art = new ArtStore();
    await art.load();
    const corridor = new Corridor(art);
    const scene: Scene = { world: 1, variant: 'base' };
    await runFrames(corridor, scene, MAX_FRAMES);
    expect(corridor.probe(scene)).toEqual({ photo: false, complete: expect.any(Boolean), sky: false });
  });

  it('a stalled fetch of a scene\'s own file: neutral briefly, then procedural, photos at the next boundary', async () => {
    install(makeNet(false, false));
    let unstall = (): void => {};
    const stalled = new Promise<void>((r) => { unstall = r; });
    const g = globalThis as unknown as Record<string, unknown>;
    const base = g.fetch as (u: string) => Promise<unknown>;
    g.fetch = async (url: string) => {
      if (String(url).includes('floor-2')) await stalled;
      return base(url);
    };
    const art = new ArtStore();
    void art.load();
    const corridor = new Corridor(art);
    const scene: Scene = { world: 2, variant: 'base' };
    let neutral = 0;
    await runFrames(corridor, scene, 120, () => {
      if (corridor.probe(scene) === null) neutral++;
    });
    expect(neutral).toBeLessThanOrEqual(60);
    expect(corridor.probe(scene)?.photo).toBe(false);
    // the file arrives mid-stage: no swap until a boundary
    unstall();
    await tick();
    await tick();
    await runFrames(corridor, scene, 20);
    expect(corridor.probe(scene)?.photo).toBe(false);
    corridor.boundary();
    expect(await runFrames(corridor, scene, MAX_FRAMES)).toBeGreaterThanOrEqual(0);
  });
});
