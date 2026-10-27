import { describe, expect, it } from 'vitest';
import { clampPan, createDedupe, createLimiter, DEDUPE_MS, panBus, softLimitCurve } from '../../src/audio/mixer';
import { fakeCtx } from './fake-ctx';

describe('createDedupe', () => {
  it('drops a repeat of the same name inside the 50 ms window', () => {
    const fresh = createDedupe();
    expect(DEDUPE_MS).toBe(50);
    expect(fresh('land', 1000)).toBe(true);
    expect(fresh('land', 1020)).toBe(false);
    expect(fresh('land', 1049.9)).toBe(false);
    expect(fresh('land', 1050)).toBe(true);
  });

  it('measures the window from the last sound that actually played', () => {
    const fresh = createDedupe();
    fresh('zap', 0);
    fresh('zap', 40); // dropped, does not extend the window
    expect(fresh('zap', 55)).toBe(true);
  });

  it('keeps names independent and honours a custom window', () => {
    const fresh = createDedupe(100);
    expect(fresh('lane', 0)).toBe(true);
    expect(fresh('bump', 10)).toBe(true);
    expect(fresh('lane', 90)).toBe(false);
    expect(fresh('lane', 100)).toBe(true);
  });

  it('lets a sound through if the clock went backwards', () => {
    const fresh = createDedupe();
    fresh('jump', 500);
    expect(fresh('jump', 10)).toBe(true);
  });
});

describe('clampPan', () => {
  it('clamps to −1…1 and snaps to 0.1 steps', () => {
    expect(clampPan(0.6)).toBe(0.6);
    expect(clampPan(-0.64)).toBe(-0.6);
    expect(clampPan(3)).toBe(1);
    expect(clampPan(-9)).toBe(-1);
  });

  it('maps non-finite and tiny values to an exact centre (no −0)', () => {
    expect(clampPan(Number.NaN)).toBe(0);
    expect(clampPan(Number.POSITIVE_INFINITY)).toBe(0);
    expect(Object.is(clampPan(-0.01), 0)).toBe(true);
  });
});

describe('panBus', () => {
  it('returns the bus itself for centre', () => {
    const ctx = fakeCtx();
    const bus = ctx.createGain();
    expect(panBus(ctx, bus, 0)).toBe(bus);
    expect(ctx.created.StereoPanner ?? 0).toBe(0);
  });

  it('reuses one panner per snapped pan value', () => {
    const ctx = fakeCtx();
    const bus = ctx.createGain();
    const left = panBus(ctx, bus, -0.6);
    expect(left).not.toBe(bus);
    expect((left as unknown as { pan: { value: number } }).pan.value).toBe(-0.6);
    expect(panBus(ctx, bus, -0.61)).toBe(left);
    expect(panBus(ctx, bus, 0.6)).not.toBe(left);
    expect(ctx.created.StereoPanner).toBe(2);
  });

  it('falls back to the bus where StereoPannerNode is missing (old Safari)', () => {
    const ctx = fakeCtx({ noPanner: true });
    const bus = ctx.createGain();
    expect(panBus(ctx, bus, 0.6)).toBe(bus);
  });
});

describe('limiter', () => {
  it('soft clip curve is the identity below the knee and never reaches full scale', () => {
    const c = softLimitCurve(2001);
    const at = (x: number): number => c[Math.round(((x + 1) / 2) * 2000)];
    expect(at(0.5)).toBeCloseTo(0.5, 3);
    expect(at(-0.8)).toBeCloseTo(-0.8, 3);
    expect(at(1)).toBeLessThan(0.99);
    expect(at(1)).toBeGreaterThan(0.9);
    expect(at(-1)).toBeCloseTo(-at(1), 6);
    for (let i = 1; i < c.length; i++) expect(c[i]).toBeGreaterThanOrEqual(c[i - 1]);
  });

  it('createLimiter feeds the destination through a single wave shaper', () => {
    const ctx = fakeCtx();
    const dest = ctx.createGain();
    const input = createLimiter(ctx, dest);
    expect(ctx.created.WaveShaper).toBe(1);
    expect((input as unknown as { connected: unknown[] }).connected).toEqual([dest]);
  });
});
