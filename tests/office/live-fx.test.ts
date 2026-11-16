// Office live events, in-run cosmetics (src/office/render/live-fx.ts): the equipped trail and jump effect as a
// small pooled particle system, the rain-week overlay, and the boosted clock. Nothing is allocated per frame.
import { describe, expect, it } from 'vitest';
import { FX_STYLES, LIVE_PARTICLES, LiveFx, fxStyle, rainOn, clockBoost } from '../../src/office/render/live-fx';
import { NO_LOOK, type LiveLook } from '../../src/office/render/live-look';
import type { RenderSnapshot } from '../../src/types';
import { COSMETICS } from '../../src/office/core/live';

const SCROLL_SPEED = 420;
const snap = (t: number, over: { grounded?: boolean; sliding?: boolean; reduced?: boolean } = {}): RenderSnapshot => ({
  time: t, realTime: t, scroll: t * SCROLL_SPEED, running: true, reducedMotion: over.reduced ?? false,
  player: { lane: 1, laneFrom: 1, laneAge: 0, height: over.grounded === false ? 80 : 0, grounded: over.grounded ?? true, sliding: over.sliding ?? false },
} as unknown as RenderSnapshot);
const look = (over: Partial<LiveLook>): LiveLook => ({ ...NO_LOOK, ...over });

/** runs `seconds` of frames at 60 fps */
function play(fx: LiveFx, l: LiveLook, seconds: number, over: Parameters<typeof snap>[1] = {}, from = 0): number {
  let t = from;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    t += 1 / 60;
    fx.update(snap(t, over), l);
  }
  return t;
}

describe('live cosmetics look table', () => {
  it('has a procedural look for every trail and jump cosmetic in the catalog', () => {
    for (const k of COSMETICS.filter((c) => c.category === 'trail' || c.category === 'jump').map((c) => c.sprite)) {
      expect(FX_STYLES[k], k).toBeDefined();
      expect(FX_STYLES[k].colors.length).toBeGreaterThan(0);
    }
  });

  it('an unknown key still gets a stable look (never throws, same key = same look)', () => {
    expect(fxStyle('trail-new-thing')).toEqual(fxStyle('trail-new-thing'));
    expect(fxStyle('trail-new-thing').colors.length).toBeGreaterThan(0);
  });
});

describe('LiveFx', () => {
  it('nothing equipped draws nothing', () => {
    const fx = new LiveFx();
    play(fx, NO_LOOK, 2);
    fx.update(snap(2.1, { grounded: false }), NO_LOOK);
    expect(fx.live()).toBe(0);
  });

  it('a trail leaves marks while running on the floor, a few at a time, and none in the air', () => {
    const fx = new LiveFx();
    play(fx, look({ trail: 'trail-sparkle' }), 2);
    const running = fx.live();
    expect(running).toBeGreaterThan(0);
    expect(running).toBeLessThanOrEqual(12);
    const air = new LiveFx();
    play(air, look({ trail: 'trail-sparkle' }), 2, { grounded: false });
    expect(air.live()).toBe(0);
  });

  it('reduced motion leaves fewer trail marks', () => {
    const a = new LiveFx();
    const b = new LiveFx();
    let spawnedA = 0;
    let spawnedB = 0;
    for (let i = 0; i < 120; i++) {
      a.update(snap(i / 60), look({ trail: 'trail-coffee' }));
      b.update(snap(i / 60, { reduced: true }), look({ trail: 'trail-coffee' }));
      spawnedA = Math.max(spawnedA, a.spawned);
      spawnedB = Math.max(spawnedB, b.spawned);
    }
    expect(spawnedB).toBeLessThan(spawnedA);
    expect(spawnedB).toBeGreaterThan(0);
  });

  it('the jump effect bursts once on take-off (the grounded → air edge), not every airborne frame', () => {
    const fx = new LiveFx();
    const l = look({ jump: 'jump-medal' });
    const t = play(fx, l, 0.5);
    expect(fx.live()).toBe(0);
    fx.update(snap(t + 1 / 60, { grounded: false }), l);
    const burst = fx.live();
    expect(burst).toBeGreaterThan(0);
    play(fx, l, 0.1, { grounded: false }, t + 1 / 60);
    expect(fx.spawned).toBe(burst);
  });

  it('the pool never grows past its capacity and drains after the effects end', () => {
    const fx = new LiveFx();
    const l = look({ trail: 'trail-confetti', jump: 'jump-papers' });
    let t = 0;
    for (let i = 0; i < 300; i++) {
      t += 1 / 60;
      fx.update(snap(t, { grounded: i % 2 === 0 }), l);
      expect(fx.live()).toBeLessThanOrEqual(LIVE_PARTICLES);
    }
    play(fx, NO_LOOK, 3, { grounded: false }, t);
    expect(fx.live()).toBe(0);
  });

  it('a new run (time going backwards) starts clean', () => {
    const fx = new LiveFx();
    play(fx, look({ trail: 'trail-sparkle' }), 1, {}, 5);
    expect(fx.live()).toBeGreaterThan(0);
    fx.update(snap(0.01), NO_LOOK);
    expect(fx.live()).toBe(0);
  });
});

describe('theme render flags', () => {
  it('rain only on a part-2 stage in the rain week', () => {
    expect(rainOn(look({ rain: true }), 5)).toBe(true);
    expect(rainOn(look({ rain: true }), 9)).toBe(true);
    expect(rainOn(look({ rain: true }), 4)).toBe(false);
    expect(rainOn(look({ rain: false }), 7)).toBe(false);
  });

  it('the clock week turns the clock urgent for the last third of any run', () => {
    expect(clockBoost(look({ clock: true }), 0.7)).toBe(true);
    expect(clockBoost(look({ clock: true }), 0.5)).toBe(false);
    expect(clockBoost(look({ clock: false }), 0.9)).toBe(false);
  });
});

describe('rain', () => {
  it('one stroked path per frame, the drops inside the view; reduced motion holds them still', async () => {
    const { drawRain, RAIN_DROPS } = await import('../../src/office/render/live-fx');
    const calls = { stroke: 0, moveTo: [] as number[][] };
    const ctx = {
      save() {}, restore() {}, beginPath() {}, lineTo() {}, stroke() { calls.stroke++; },
      moveTo(x: number, y: number) { calls.moveTo.push([x, y]); },
    } as unknown as CanvasRenderingContext2D;
    const v = { x0: -50, y0: 0, w: 500, h: 900 } as never;
    drawRain(ctx, v, 3.2, false);
    expect(calls.stroke).toBe(1);
    expect(calls.moveTo).toHaveLength(RAIN_DROPS);
    for (const [x, y] of calls.moveTo) {
      expect(x).toBeGreaterThanOrEqual(-50);
      expect(x).toBeLessThan(450);
      expect(y).toBeGreaterThanOrEqual(-16);
      expect(y).toBeLessThanOrEqual(900);
    }
    const still: number[][] = [];
    const ctx2 = { ...ctx, moveTo: (x: number, y: number) => still.push([x, y]) } as unknown as CanvasRenderingContext2D;
    drawRain(ctx2, v, 1, true);
    const still2: number[][] = [];
    drawRain({ ...ctx, moveTo: (x: number, y: number) => still2.push([x, y]) } as unknown as CanvasRenderingContext2D, v, 9, true);
    expect(still2).toEqual(still);
  });
});

describe('cosmetics read clearly but stay behind the hero (pt-casual P2d)', () => {
  const record = () => {
    const xs: number[] = [];
    const sizes: number[] = [];
    const ctx = new Proxy({}, {
      get: (_t, k) => {
        if (k === 'drawImage') return (_i: unknown, x: number, _y: number, w: number) => { xs.push(x + w / 2); sizes.push(w); };
        if (k === 'ellipse' || k === 'arc') return (x: number) => xs.push(x);
        if (k === 'moveTo') return (x: number) => xs.push(x);
        return () => undefined;
      },
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, xs, sizes };
  };
  const img = { width: 128 } as HTMLImageElement;

  it('trail marks are drawn ≥ 28 px wide, all behind the hero', async () => {
    const { PLAYER_X } = await import('../../src/types');
    const fx = new LiveFx();
    play(fx, look({ trail: 'trail-sparkle' }), 1);
    const r = record();
    fx.draw(r.ctx, () => img);
    expect(r.sizes.length).toBeGreaterThan(0);
    for (const w of r.sizes) expect(w).toBeGreaterThanOrEqual(28);
    for (const x of r.xs) expect(x).toBeLessThan(PLAYER_X - 10);
  });

  it('a jump burst flies up and back, never ahead of the hero (the hazard lane)', async () => {
    const { PLAYER_X } = await import('../../src/types');
    const fx = new LiveFx();
    const l = look({ jump: 'jump-petal' });
    const t = play(fx, l, 0.3);
    play(fx, l, 0.4, { grounded: false }, t);
    const r = record();
    fx.draw(r.ctx, () => img);
    expect(r.xs.length).toBeGreaterThan(0);
    for (const x of r.xs) expect(x).toBeLessThanOrEqual(PLAYER_X + 12);
    for (const w of r.sizes) expect(w).toBeGreaterThanOrEqual(24);
  });
});
