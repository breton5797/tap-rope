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
