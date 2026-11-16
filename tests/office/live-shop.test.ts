// 사원 복지몰 and the weekly theme: fixed-price cosmetics (no randomness), one equipped per category, theme
// items sold from the week after their theme week, six themes in a weekly rotation with a goal each.
import { describe, expect, it } from 'vitest';
import {
  COSMETICS, COSMETIC_PRICES, THEMES, addDays, addGoalProgress, affordable, buyCosmetic, cosmeticById, emptyLive, equipCosmetic,
  themeOf, weekOf, type LiveRunCounts, type LiveSave,
} from '../../src/office/core/live';

const ZERO: LiveRunCounts = { coffee: 0, 'dodge-dinner': 0, docs: 0, perfects: 0, jumps: 0, 'part2-clears': 0, clears: 0 };
const MON = '2026-11-16';

describe('cosmetics catalog', () => {
  it('has 6 trails, 4 jump effects, 6 stamps and 4 card themes with unique ids, Korean names and the category price', () => {
    const count = (c: string) => COSMETICS.filter((x) => x.category === c).length;
    expect([count('trail'), count('jump'), count('stamp'), count('cardTheme')]).toEqual([6, 4, 6, 4]);
    expect(new Set(COSMETICS.map((c) => c.id)).size).toBe(COSMETICS.length);
    for (const c of COSMETICS) {
      expect(c.name, c.id).toMatch(/[가-힣]/);
      expect(c.price).toBe(COSMETIC_PRICES[c.category]);
      expect(c.sprite).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('every theme gives its own cosmetic, marked with that theme', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['monday-blues', 'dodge-dinner', 'paper-bomb', 'speed-clockout', 'sports-day', 'rainy-commute']);
    for (const t of THEMES) {
      expect(cosmeticById(t.goal.cosmetic)?.theme, t.id).toBe(t.id);
      expect(t.goal.target).toBeGreaterThan(0);
      expect(t.name).toMatch(/주간$/);
    }
    expect(COSMETICS.filter((c) => c.theme).length).toBe(THEMES.length);
  });
});

describe('weekly theme rotation and goal', () => {
  it('rotates through all six themes over six weeks and is the same all week', () => {
    const weeks = Array.from({ length: 6 }, (_, i) => addDays(MON, i * 7));
    expect(new Set(weeks.map((w) => themeOf(w).id)).size).toBe(6);
    for (let d = 0; d < 7; d += 1) expect(themeOf(weekOf(addDays(MON, d))).id).toBe(themeOf(MON).id);
    expect(themeOf(addDays(MON, 42)).id).toBe(themeOf(MON).id);
  });

  it('goal progress counts only the week metric, caps at the target, restarts each week, stays done', () => {
    const goal = themeOf(MON).goal;
    let g = addGoalProgress(null, MON, { ...ZERO, [goal.metric]: 5 });
    expect(g).toEqual({ week: MON, value: 5, done: false });
    g = addGoalProgress(g, MON, { ...ZERO, coffee: 999, docs: 999, perfects: 999, jumps: 999, 'dodge-dinner': 999, 'part2-clears': 999 });
    expect(g).toEqual({ week: MON, value: goal.target, done: true });
    const next = addDays(MON, 7);
    expect(addGoalProgress(g, next, ZERO)).toEqual({ week: next, value: 0, done: false });
    expect(addGoalProgress(g, MON, { ...ZERO, [goal.metric]: -3 }).value).toBe(goal.target);
  });
});

describe('buy and equip', () => {
  const plain = COSMETICS.find((c) => !c.theme)!;
  const themed = COSMETICS.find((c) => c.theme)!;
  const withSeen = (week: string): LiveSave => ({ ...emptyLive(), themeSeen: { [themed.theme!]: week } });

  it('buys at the fixed price: unknown / owned / too poor are refused, nothing random', () => {
    const r = buyCosmetic(emptyLive(), plain.id, plain.price, MON);
    expect(r).toMatchObject({ ok: true, cost: plain.price });
    if (!r.ok) throw new Error('bought');
    expect(r.live.owned).toEqual([plain.id]);
    expect(buyCosmetic(r.live, plain.id, 10_000, MON)).toEqual({ ok: false, reason: 'owned' });
    expect(buyCosmetic(emptyLive(), plain.id, plain.price - 1, MON)).toEqual({ ok: false, reason: 'poor' });
    expect(buyCosmetic(emptyLive(), 'nope', 10_000, MON)).toEqual({ ok: false, reason: 'unknown' });
  });

  it('a theme item is the event prize in its own week and on sale every other week (by the rotation, seen or not)', () => {
    const own = Array.from({ length: 6 }, (_, i) => addDays(MON, 7 * i)).find((w) => themeOf(w).id === themed.theme)!;
    expect(buyCosmetic(emptyLive(), themed.id, 10_000, own)).toEqual({ ok: false, reason: 'not-yet' });
    expect(buyCosmetic(emptyLive(), themed.id, 10_000, addDays(own, 6))).toEqual({ ok: false, reason: 'not-yet' });
    expect(buyCosmetic(emptyLive(), themed.id, 10_000, addDays(own, 7)).ok).toBe(true);
    expect(buyCosmetic(emptyLive(), themed.id, 10_000, addDays(own, -1)).ok).toBe(true);
    // a player who never opened the game during that theme week can still buy it
    expect(buyCosmetic(withSeen(own), themed.id, 10_000, addDays(own, 7 * 43)).ok).toBe(true);
  });

  it('equips one per category, only owned items', () => {
    const [a, b] = COSMETICS.filter((c) => c.category === 'trail' && !c.theme);
    const live = { ...emptyLive(), owned: [a.id, b.id] };
    expect(equipCosmetic(live, a.id).equipped).toEqual({ trail: a.id });
    expect(equipCosmetic(equipCosmetic(live, a.id), b.id).equipped).toEqual({ trail: b.id });
    expect(equipCosmetic(live, plain.id === a.id ? COSMETICS.find((c) => c.category === 'jump')!.id : plain.id)).toEqual(live);
    expect(equipCosmetic(live, 'nope')).toEqual(live);
  });

  it('affordable lists what can be bought right now', () => {
    const cheapest = Math.min(...COSMETICS.map((c) => c.price));
    expect(affordable(emptyLive(), cheapest - 1, MON)).toEqual([]);
    const list = affordable(emptyLive(), 10_000, MON);
    // everything except this week's event item
    expect(list.map((c) => c.id).sort()).toEqual(COSMETICS.filter((c) => c.theme !== themeOf(MON).id).map((c) => c.id).sort());
  });
});
