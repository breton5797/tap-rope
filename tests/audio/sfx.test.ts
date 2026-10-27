import { describe, expect, it } from 'vitest';
import type { SfxName } from '../../src/types';
import { playSfx } from '../../src/audio/sfx';
import { fakeCtx } from './fake-ctx';

const ALL: readonly SfxName[] = [
  'jump', 'boost', 'land', 'perfect', 'good', 'hit', 'coin', 'powerup', 'combo', 'fever', 'clear', 'fail', 'click', 'count',
  'slide', 'warn', 'zap', 'rescue', 'lane', 'alert', 'door', 'boss-intro', 'boss-charge', 'boss-stagger', 'boss-down', 'achieve',
  'shield', 'graze', 'bump',
];

/** v7.1 layered action sounds and their node budgets (sources + filters + envelopes + shapers). */
const BUDGET: Readonly<Partial<Record<SfxName, number>>> = {
  jump: 14, boost: 12, land: 11, slide: 12, lane: 11, bump: 11, perfect: 9, good: 7, graze: 15, zap: 24, shield: 20,
};

const render = (name: SfxName, level = 1) => {
  const ctx = fakeCtx();
  const out = ctx.createGain();
  playSfx(ctx, out, name, level);
  const total = Object.entries(ctx.created).reduce((s, [k, v]) => (k === 'Gain' ? s + v - 1 : s + v), 0);
  return { ctx, total, sources: (ctx.created.Oscillator ?? 0) + (ctx.created.BufferSource ?? 0) };
};

describe('playSfx', () => {
  it.each(ALL)('%s schedules voices without throwing at any level', (name) => {
    for (const level of [0, 1, 2, 3, 99, Number.NaN]) expect(() => render(name, level)).not.toThrow();
    expect(render(name).sources).toBeGreaterThan(0);
  });

  it.each(Object.entries(BUDGET))('%s stays within its node budget at the heaviest level', (name, budget) => {
    expect(render(name as SfxName, 3).total).toBeLessThanOrEqual(budget as number);
  });

  it('layers every action sound (at least 3 voices) and keeps them short', () => {
    for (const name of Object.keys(BUDGET) as SfxName[]) {
      const r = render(name, 3);
      expect(r.sources, name).toBeGreaterThanOrEqual(3);
      expect(r.ctx.lastStop(), name).toBeLessThan(1);
    }
  });

  it('land and graze grow with the level', () => {
    expect(render('land', 3).total).toBeGreaterThan(render('land', 1).total);
    expect(render('graze', 3).total).toBeGreaterThan(render('graze', 1).total);
    expect(render('land', 3).ctx.lastStop()).toBeGreaterThan(render('land', 1).ctx.lastStop());
  });

  it('zap is the heaviest action sound', () => {
    const zap = render('zap').total;
    for (const name of ['jump', 'land', 'bump', 'lane', 'slide'] as const) expect(zap).toBeGreaterThan(render(name, 3).total);
  });
});
