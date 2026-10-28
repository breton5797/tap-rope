import { describe, expect, it } from 'vitest';
import { newSpring, springKick, springStep } from '../../src/render/rig-spring';

describe('rig spring', () => {
  it('settles on the target', () => {
    const s = newSpring(0);
    for (let i = 0; i < 120; i++) springStep(s, 10, 200, 0.7, 1 / 60);
    expect(s.x).toBeCloseTo(10, 2);
    expect(Math.abs(s.v)).toBeLessThan(0.01);
  });

  it('lags behind a moving target (secondary motion)', () => {
    const s = newSpring(0);
    springStep(s, 10, 200, 0.7, 1 / 60);
    expect(s.x).toBeGreaterThan(0);
    expect(s.x).toBeLessThan(5);
  });

  it('under-damped springs overshoot and ring after a kick, then die out', () => {
    const s = newSpring(0);
    springKick(s, 50);
    let max = 0;
    let min = 0;
    for (let i = 0; i < 240; i++) {
      springStep(s, 0, 300, 0.25, 1 / 60);
      max = Math.max(max, s.x);
      min = Math.min(min, s.x);
    }
    expect(max).toBeGreaterThan(1);
    expect(min).toBeLessThan(-0.3);
    expect(Math.abs(s.x)).toBeLessThan(0.05);
  });

  it('is frame-rate independent and survives a long hitch', () => {
    const a = newSpring(0);
    const b = newSpring(0);
    for (let i = 0; i < 60; i++) springStep(a, 5, 150, 0.5, 1 / 60);
    for (let i = 0; i < 30; i++) springStep(b, 5, 150, 0.5, 1 / 30);
    expect(a.x).toBeCloseTo(b.x, 3);
    const c = newSpring(0);
    springStep(c, 5, 150, 0.5, 5);
    expect(Number.isFinite(c.x)).toBe(true);
    springStep(c, 5, 150, 0.5, -1);
    expect(Number.isFinite(c.x)).toBe(true);
  });
});
