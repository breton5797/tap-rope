// Art-director fix: a frame set the art worker shrank to fit its canvas (고도약's jumps) is scaled back so the
// hero's body matches his run1 size; well-sized sets are untouched; slides compare against the lying extent.
import { describe, expect, it } from 'vitest';
import { SET_EXPECT, setScale, setOf } from '../../src/office/render/hero-scale';

describe('hero frame-set scale', () => {
  it('a set shrunk to fit the canvas is scaled back up to run1 (synthetic smaller frames)', () => {
    expect(setScale(615, [500, 500, 500, 500], SET_EXPECT.jump)).toBeCloseTo(1.23, 2);
    // 고도약's measured jump extents
    expect(setScale(615, [539, 498, 557, 638, 623, 636, 533, 541], SET_EXPECT.jump)).toBeCloseTo(615 / 549, 2);
  });

  it('well-sized sets stay 1 (within 4%), never shrink, never grow past 1.25', () => {
    expect(setScale(615, [615, 595, 620, 590, 595, 634, 610, 633], SET_EXPECT.jump)).toBe(1); // 칼퇴준
    expect(setScale(615, [640, 640, 640, 640], SET_EXPECT.jump)).toBe(1);
    expect(setScale(615, [300, 300], SET_EXPECT.jump)).toBe(1.25);
    expect(setScale(615, [530, 498, 498, 499], SET_EXPECT.slide)).toBe(1); // 칼퇴준 slide (lying)
    expect(setScale(615, [], SET_EXPECT.jump)).toBe(1);
  });

  it('frames map to their set; run and win are never rescaled', () => {
    expect(setOf('jump3')).toBe('jump');
    expect(setOf('jump')).toBe('jump');
    expect(setOf('slide2')).toBe('slide');
    expect(setOf('hit4')).toBe('hit');
    expect(setOf('run5')).toBeNull();
    expect(setOf('win')).toBeNull();
  });
});

describe('shielded hero stays readable', () => {
  it('the hurt blink never drops below 0.6 alpha while shielded', async () => {
    const { blinkAlpha } = await import('../../src/office/render/hero-scale');
    let min = 1;
    for (let t = 0; t < 1; t += 0.003) min = Math.min(min, blinkAlpha(t, true));
    expect(min).toBeGreaterThanOrEqual(0.6);
    let m2 = 1;
    for (let t = 0; t < 1; t += 0.003) m2 = Math.min(m2, blinkAlpha(t, false));
    expect(m2).toBeLessThan(0.6);
  });
});
