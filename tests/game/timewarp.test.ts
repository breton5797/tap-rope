import { describe, expect, it } from 'vitest';
import { hitStop, MAX_STOP, slowMo, stepWarp, WARP0 } from '../../src/game/timewarp';

describe('timewarp', () => {
  it('passes real time through when idle', () => {
    const r = stepWarp(WARP0, 0.016);
    expect(r.dt).toBeCloseTo(0.016);
    expect(r.warp).toEqual(WARP0);
  });

  it('a hit stop swallows game time until it runs out, then time flows again in the same frame', () => {
    const w = hitStop(WARP0, 0.07, false);
    const a = stepWarp(w, 0.05);
    expect(a.dt).toBe(0);
    const b = stepWarp(a.warp, 0.05); // 0.02 left of the stop, 0.03 real time
    expect(b.dt).toBeCloseTo(0.03);
    expect(b.warp.stop).toBe(0);
  });

  it('stops never stack past MAX_STOP and keep the longer one', () => {
    const w = hitStop(hitStop(WARP0, 0.07, false), 0.05, false);
    expect(w.stop).toBeCloseTo(0.07);
    expect(hitStop(WARP0, 5, false).stop).toBe(MAX_STOP);
  });

  it('slow motion scales the overlapping part of the frame', () => {
    const w = slowMo(WARP0, 0.2, 0.5, false);
    const a = stepWarp(w, 0.1);
    expect(a.dt).toBeCloseTo(0.05);
    const b = stepWarp(a.warp, 0.15); // 0.1 slow → 0.05, then 0.05 normal
    expect(b.dt).toBeCloseTo(0.1);
    expect(b.warp.slow).toBe(0);
  });

  it('a stop is consumed before slow motion', () => {
    const w = slowMo(hitStop(WARP0, 0.05, false), 0.2, 0.5, false);
    const r = stepWarp(w, 0.1); // 0.05 stopped, 0.05 slow → 0.025
    expect(r.dt).toBeCloseTo(0.025);
  });

  it('reduced motion: no slow motion, shorter stops', () => {
    expect(slowMo(WARP0, 0.2, 0.5, true)).toEqual(WARP0);
    expect(hitStop(WARP0, 0.07, true).stop).toBeCloseTo(0.035);
  });

  it('never returns negative or more time than was given', () => {
    let w = slowMo(hitStop(WARP0, 0.07, false), 0.2, 0.55, false);
    for (const real of [0, 0.001, 0.016, 0.1]) {
      const r = stepWarp(w, real);
      expect(r.dt).toBeGreaterThanOrEqual(0);
      expect(r.dt).toBeLessThanOrEqual(real + 1e-12);
      w = r.warp;
    }
  });
});
