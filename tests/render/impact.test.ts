import { describe, expect, it } from 'vitest';
import { planImpact, RingShape, scalePlan, slideActive, SLIDE_FX, sprayAngle, zoneOffset } from '../../src/render/impact';
import type { ImpactKind } from '../../src/types';

const KINDS: readonly ImpactKind[] = ['jump', 'boost', 'land', 'slide', 'lane', 'bump', 'pass', 'graze', 'hit', 'shield'];

describe('planImpact', () => {
  it('gives every kind something to show', () => {
    for (const k of KINDS) {
      const p = planImpact(k, { level: 2, dir: 1, zone: 'low' });
      expect(p.ring + p.dust + p.sparks + p.debris + p.shards + p.streaks + p.glint, k).toBeGreaterThan(0);
    }
  });

  it('jump and land rings lie flat on the floor', () => {
    expect(planImpact('jump').ringShape).toBe(RingShape.Ground);
    expect(planImpact('land', { level: 2 }).ringShape).toBe(RingShape.Ground);
    expect(planImpact('boost', { level: 2 }).ringShape).toBe(RingShape.Ground);
  });

  it('landing grows with the level of the jump that ended; only a triple landing shakes', () => {
    const [l1, l2, l3] = [1, 2, 3].map((level) => planImpact('land', { level }));
    expect(l2.ring).toBeGreaterThan(l1.ring);
    expect(l3.ring).toBeGreaterThan(l2.ring);
    expect(l3.dust).toBeGreaterThan(l1.dust);
    expect(l1.shake).toBe(0);
    expect(l2.shake).toBe(0);
    expect(l3.shake).toBeGreaterThan(0);
    expect(l3.shake).toBeLessThan(0.4); // a tiny shake, the hit owns the big one
  });

  it('boost gets bigger and brighter per level', () => {
    const b2 = planImpact('boost', { level: 2 });
    const b3 = planImpact('boost', { level: 3 });
    expect(b3.ring).toBeGreaterThan(b2.ring);
    expect(b3.sparks).toBeGreaterThan(b2.sparks);
    expect(b3.glint).toBeGreaterThan(b2.glint);
  });

  it('clamps odd levels into 1..3', () => {
    expect(planImpact('land', { level: 9 })).toEqual(planImpact('land', { level: 3 }));
    expect(planImpact('land', { level: 0 })).toEqual(planImpact('land', { level: 1 }));
    expect(planImpact('land')).toEqual(planImpact('land', { level: 1 }));
  });

  it('a graze is much louder than a plain pass and carries a glint', () => {
    const pass = planImpact('pass', { zone: 'low', level: 1 });
    const graze = planImpact('graze', { zone: 'low', level: 1 });
    expect(pass.glint).toBe(0);
    expect(graze.glint).toBeGreaterThan(0);
    expect(graze.sparks).toBeGreaterThan(pass.sparks * 2);
  });

  it('lane changes draw speed lines; hit throws debris; shield breaks into hexagon shards', () => {
    expect(planImpact('lane', { dir: 1 }).streaks).toBeGreaterThan(0);
    expect(planImpact('hit').debris).toBeGreaterThan(0);
    const sh = planImpact('shield');
    expect(sh.shards).toBeGreaterThan(0);
    expect(sh.ringShape).toBe(RingShape.Hex);
  });
});

describe('scalePlan (reduced motion)', () => {
  it('is the identity without reduced motion', () => {
    const p = planImpact('land', { level: 3 });
    expect(scalePlan(p, false)).toBe(p);
  });

  it('drops streaks and shake, halves particle counts, keeps rings and glints', () => {
    for (const k of KINDS) {
      const p = planImpact(k, { level: 3, dir: -1, zone: 'high' });
      const r = scalePlan(p, true);
      expect(r.streaks, k).toBe(0);
      expect(r.shake, k).toBe(0);
      expect(r.sparks, k).toBeLessThanOrEqual(Math.ceil(p.sparks / 2));
      expect(r.dust, k).toBeLessThanOrEqual(Math.ceil(p.dust / 2));
      expect(r.ring, k).toBe(p.ring);
      expect(r.glint, k).toBe(p.glint);
    }
  });

  it('does not mutate the full plan', () => {
    const p = planImpact('lane', { dir: 1 });
    const before = { ...p };
    scalePlan(p, true);
    expect(p).toEqual(before);
  });
});

describe('graze placement', () => {
  it('low is at the feet, high above the head, side beside the body', () => {
    const lift = 48;
    const [, low] = zoneOffset('low', lift);
    const [, high] = zoneOffset('high', lift);
    const [sx, side] = zoneOffset('side', lift);
    expect(Math.abs(low)).toBeLessThan(8);
    expect(high).toBeLessThan(-lift * 2);
    expect(side).toBe(-lift);
    expect(sx).toBeGreaterThan(0);
    expect(zoneOffset(undefined, lift)).toEqual(zoneOffset('low', lift));
  });

  it('sprays back (toward −x) for every zone, upward for floor / ceiling skims', () => {
    for (const z of ['low', 'high', 'side'] as const) expect(Math.cos(sprayAngle(z)), z).toBeLessThan(0);
    expect(Math.sin(sprayAngle('low'))).toBeLessThan(0);
    expect(Math.sin(sprayAngle('high'))).toBeLessThan(0);
  });
});

describe('slideActive', () => {
  const NEVER = 1e9;
  it('runs for the slide duration after a slide cue', () => {
    expect(slideActive(0, NEVER, NEVER, NEVER)).toBe(true);
    expect(slideActive(SLIDE_FX.time - 0.01, NEVER, NEVER, NEVER)).toBe(true);
    expect(slideActive(SLIDE_FX.time + 0.01, NEVER, NEVER, NEVER)).toBe(false);
  });

  it('stops when a jump, boost or hit came after the slide', () => {
    expect(slideActive(0.2, 0.1, NEVER, NEVER)).toBe(false);
    expect(slideActive(0.2, NEVER, 0.05, NEVER)).toBe(false);
    expect(slideActive(0.2, NEVER, NEVER, 0.1)).toBe(false);
    expect(slideActive(0.2, 0.3, 0.3, 0.3)).toBe(true);
  });
});
