// Office camera (playtest: "see people, scene and hazards from a little farther away"): a pulled-back view
// with more corridor ahead of the hero. Projection only — beats, judge timing and hit boxes are untouched.
import { describe, expect, it } from 'vitest';
import { V8_CAMERA, computeView, computeViewWith } from '../../src/office/render/view';
import { PLAYER_X, SCROLL_SPEED } from '../../src/types';

/** seconds of look-ahead: a floor hazard enters at the right edge this long before it reaches the hero */
const ahead = (v: ReturnType<typeof computeView>) => (v.x0 + v.w - PLAYER_X) / SCROLL_SPEED;
const lookAhead = (cssW: number, cssH: number) => ahead(computeView(cssW, cssH, 2));
const v8LookAhead = (cssW: number, cssH: number) => ahead(computeViewWith(V8_CAMERA, cssW, cssH, 2));

describe('office camera', () => {
  it('phone (390×844) zooms about 1.0–1.1 instead of the v8 1.35', () => {
    const v = computeView(390, 844, 3);
    expect(v.zoom).toBeGreaterThanOrEqual(1);
    expect(v.zoom).toBeLessThanOrEqual(1.1);
  });

  it('iPad (1024×1366) pulls back below the fit scale by the same share', () => {
    expect(computeView(1024, 1366, 2).zoom).toBeLessThan(1);
    expect(computeView(1024, 1366, 2).zoom).toBeGreaterThanOrEqual(0.75);
  });

  it('shows at least 25% more corridor ahead than the v8 camera', () => {
    for (const [w, h] of [[390, 844], [1024, 1366]] as const) {
      expect(lookAhead(w, h), `${w}x${h}`).toBeGreaterThanOrEqual(v8LookAhead(w, h) * 1.25 - 1e-9);
    }
    expect(lookAhead(390, 844)).toBeGreaterThan(1.1);
  });

  it('keeps the hero on screen with room behind it and the rhythm lane docked', () => {
    for (const [w, h] of [[390, 844], [1024, 1366], [844, 390]] as const) {
      const v = computeView(w, h, 2);
      expect(PLAYER_X - v.x0).toBeGreaterThan(40);
      expect(v.loy + 542 * v.ls + 68 * v.ls).toBeLessThanOrEqual(h + 1e-6);
    }
  });
});
