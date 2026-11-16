// Live-events economy gate (docs/balance/live-economy.md): the shipped constants meet the approved pacing for a regular
// player (1–2 runs a day): a new cosmetic every 2–3 days and the whole shop in 6–8 weeks; prices 300–800.
import { describe, expect, it } from 'vitest';
import { COSMETICS } from '../../src/office/core/live';
import { LIGHT, REGULAR, catalogCount, progressionPoints, summarise } from './balance.economy';

describe('live economy (model on the shipped constants)', () => {
  it('prices are fixed and inside 300–800 ₵', () => {
    for (const c of COSMETICS) {
      expect(c.price, c.id).toBeGreaterThanOrEqual(300);
      expect(c.price, c.id).toBeLessThanOrEqual(800);
    }
    expect(catalogCount).toEqual({ shop: 14, theme: 6 });
  });

  it('a regular player gets a cosmetic every 2–3 days and the whole shop in 6–8 weeks', () => {
    const r = summarise(REGULAR);
    expect(r.daysPerItem).toBeGreaterThanOrEqual(2);
    expect(r.daysPerItem).toBeLessThanOrEqual(3);
    expect(r.catalogWeeks).toBeGreaterThanOrEqual(6);
    expect(r.catalogWeeks).toBeLessThanOrEqual(8);
  });

  it('a light player still gets something about weekly; progression pays about 3–6 weeks of regular income', () => {
    expect(summarise(LIGHT).daysPerItem).toBeLessThanOrEqual(7);
    const weeks = progressionPoints() / summarise(REGULAR).weekly;
    expect(weeks).toBeGreaterThanOrEqual(3);
    expect(weeks).toBeLessThanOrEqual(6);
  });
});
