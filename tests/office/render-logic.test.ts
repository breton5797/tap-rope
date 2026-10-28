// Office rendering helpers (office plan Task 5): sprite frame choice, blackout darkness, boss-attack kick.
import { describe, expect, it } from 'vitest';
import { heroFrame, heroLean } from '../../src/office/render/hero-frames';
import { blackoutAlpha, surpriseKick } from '../../src/office/render/surprise';
import { initialPlayer } from '../../src/core/physics';
import type { PlayerState } from '../../src/types';
import type { OfficeEvent } from '../../src/office/core/events';

const p0 = initialPlayer();
const run = { running: true, hitAge: Infinity, win: false };

describe('heroFrame', () => {
  it('cycles run1–run4 at 10 fps while running on the ground', () => {
    expect([0, 0.1, 0.2, 0.3, 0.4].map((t) => heroFrame(p0, t + 0.01, run))).toEqual(['run1', 'run2', 'run3', 'run4', 'run1']);
  });

  it('airborne → jump, sliding → slide, recent hit → hit (hit wins)', () => {
    const air: PlayerState = { ...p0, grounded: false, height: 40, level: 1 };
    const slide: PlayerState = { ...p0, sliding: true, slideTime: 0.3 };
    expect(heroFrame(air, 1, run)).toBe('jump');
    expect(heroFrame(slide, 1, run)).toBe('slide');
    expect(heroFrame(air, 1, { ...run, hitAge: 0.1 })).toBe('hit');
    expect(heroFrame(air, 1, { ...run, hitAge: 2 })).toBe('jump');
  });

  it('stands on run1 off the run and cheers with win', () => {
    expect(heroFrame(p0, 1.23, { ...run, running: false })).toBe('run1');
    expect(heroFrame(p0, 1.23, { ...run, win: true })).toBe('win');
  });

  it('leans up to ±8° during a lane change, 0 when settled', () => {
    expect(heroLean(p0)).toBe(0);
    const mid: PlayerState = { ...p0, lane: 2, laneFrom: 1, laneAge: 0.06 };
    const lean = heroLean(mid);
    expect(Math.abs(lean)).toBeGreaterThan(0);
    expect(Math.abs(lean)).toBeLessThanOrEqual((8 * Math.PI) / 180 + 1e-9);
    expect(Math.sign(heroLean({ ...mid, lane: 0 }))).toBe(-Math.sign(lean));
  });
});

describe('blackoutAlpha', () => {
  const e: OfficeEvent = { kind: 'blackout', beatIndex: 3, time: 10, duration: 1.5 };

  it('blackout keeps hazard outline alpha ≥ 0.8', () => {
    for (let t = 10; t <= 11.5; t += 0.05) {
      const a = blackoutAlpha(t, e);
      expect(a.scene, `t ${t}`).toBeGreaterThanOrEqual(0.75);
      expect(a.outline, `t ${t}`).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('is off outside the window (short fade after it, outlines stay bright while it fades)', () => {
    expect(blackoutAlpha(9.99, e)).toEqual({ scene: 0, outline: 0 });
    expect(blackoutAlpha(13, e)).toEqual({ scene: 0, outline: 0 });
    const fading = blackoutAlpha(11.55, e);
    expect(fading.scene).toBeGreaterThan(0);
    expect(fading.scene).toBeLessThan(0.75);
    expect(fading.outline).toBeGreaterThanOrEqual(0.8);
  });
});

describe('surpriseKick', () => {
  it('lasts 0.15 s with a peak zoom of 1.06', () => {
    expect(surpriseKick(4.99, 5)).toEqual({ zoom: 1, shake: 0 });
    expect(surpriseKick(5.16, 5)).toEqual({ zoom: 1, shake: 0 });
    const peak = Math.max(...Array.from({ length: 16 }, (_, i) => surpriseKick(5 + i * 0.01, 5).zoom));
    expect(peak).toBeCloseTo(1.06, 3);
    expect(surpriseKick(5.02, 5).shake).toBeGreaterThan(0);
    for (let i = 0; i <= 15; i++) expect(surpriseKick(5 + i * 0.01, 5).zoom).toBeLessThanOrEqual(1.06 + 1e-9);
  });
});
