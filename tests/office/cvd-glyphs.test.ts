// R5 colour-blind audit: slide (blue) and stay-low (purple) collapse into one blue for protan / deutan players,
// so each move also carries a SHAPE: jump = ▽ notches, lane = dashed ring, slide = ▼ duck chevron, low = double
// ring — inside the footprint and on the laser pointer's dot.
import { describe, expect, it } from 'vitest';
import { cueGlyph } from '../../src/office/render/readability';

/** a fake 2D context counting path calls per drawFootprint / pointerBeam */
function recorder() {
  const n = { ellipse: 0, arc: 0, lineTo: 0, fill: 0, stroke: 0 };
  const ctx = {
    globalAlpha: 1, strokeStyle: '', fillStyle: '', lineWidth: 1, lineCap: '', lineJoin: '',
    save() {}, restore() {}, beginPath() {}, closePath() {}, moveTo() {}, setLineDash() {},
    ellipse() { n.ellipse++; }, arc() { n.arc++; }, lineTo() { n.lineTo++; }, fill() { n.fill++; }, stroke() { n.stroke++; },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, n };
}

describe('move glyphs', () => {
  it('one distinct shape per move', () => {
    const g = (['jump', 'lane', 'slide', 'low'] as const).map(cueGlyph);
    expect(g).toEqual(['notches', 'dash', 'chevron', 'double']);
    expect(new Set(g).size).toBe(4);
  });

  it('the slide footprint carries a ▼ chevron, the stay-low footprint a second ring', async () => {
    const { drawFootprint } = await import('../../src/office/render/props');
    const slide = recorder();
    drawFootprint(slide.ctx, 'ceiling', 100, 200, 60);
    const plainJump = recorder();
    drawFootprint(plainJump.ctx, 'floor', 100, 200, 60);
    expect(slide.n.lineTo).toBeGreaterThanOrEqual(2); // the chevron's sides
    expect(plainJump.n.lineTo).toBe(0);
    const low = recorder();
    drawFootprint(low.ctx, 'drone', 100, 200, 60);
    expect(low.n.ellipse).toBeGreaterThanOrEqual(2); // outer + inner ring
    expect(plainJump.n.ellipse).toBe(1);
  });

  it('the laser pointer dot carries the same glyph for slide and stay-low', async () => {
    const { pointerBeam } = await import('../../src/office/render/readability');
    const at = (cue: 'jump' | 'slide' | 'low') => {
      const r = recorder();
      pointerBeam(r.ctx, 0, 0, 50, 50, 1, 1, cue);
      return r.n;
    };
    expect(at('slide').lineTo).toBeGreaterThan(at('jump').lineTo);
    expect(at('low').arc).toBeGreaterThan(at('jump').arc);
  });
});

describe('blackout silhouettes (R5 P3)', () => {
  it('a hazard prop glows in its move colour (white when unknown), never the pickup cyan', async () => {
    const { silhouetteColor, ACTION_COLORS } = await import('../../src/office/render/props');
    expect(silhouetteColor('jump')).toBe(ACTION_COLORS.jump);
    expect(silhouetteColor('slide')).toBe(ACTION_COLORS.slide);
    expect(silhouetteColor(null)).toBe('#FFFFFF');
    for (const c of ['jump', 'slide', 'lane', 'low', null] as const) expect(silhouetteColor(c).toUpperCase()).not.toBe('#7CFFEA');
  });
});
