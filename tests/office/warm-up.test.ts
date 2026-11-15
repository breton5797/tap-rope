// R5 reviewer LOW notes: the stage-start warm-up must never spin when fonts are not ready (measureText → 0),
// and must stop doing work once everything is warm.
import { describe, expect, it } from 'vitest';
import { warmPopups, WARM_ATTEMPTS } from '../../src/office/render/popups';
import { warmCallouts } from '../../src/office/render/surprise-fx';

/** a 2D context whose text has no width yet (web fonts still loading) */
const noFonts = () => {
  let measures = 0;
  const ctx = { font: '', measureText: () => { measures++; return { width: 0 }; } } as unknown as CanvasRenderingContext2D;
  return { ctx, measures: () => measures };
};

describe('warm-up with fonts not ready', () => {
  it('warmPopups gives up after WARM_ATTEMPTS calls instead of reporting work forever', () => {
    const { ctx } = noFonts();
    let calls = 0;
    while (warmPopups(ctx, 2) && calls < 1000) calls++;
    expect(calls).toBeLessThanOrEqual(WARM_ATTEMPTS * 16);
    expect(warmPopups(ctx, 2)).toBe(false);
  });

  it('warmCallouts stops measuring once the stage is warm (or given up)', () => {
    const { ctx, measures } = noFonts();
    for (let i = 0; i < WARM_ATTEMPTS + 2; i++) warmCallouts(ctx, ['postit', 'papers']);
    const after = measures();
    warmCallouts(ctx, ['postit', 'papers']);
    expect(measures()).toBe(after);
  });
});

describe('overlay canvas memory (R5 LOW)', () => {
  it('the overlay layer is backed only during a running run (menus, pause, results: released)', async () => {
    const { overlayBacking } = await import('../../src/office/render/index');
    expect(overlayBacking(true, 2048, 2732)).toEqual({ w: 2048, h: 2732 });
    expect(overlayBacking(false, 2048, 2732)).toEqual({ w: 0, h: 0 });
  });
});
