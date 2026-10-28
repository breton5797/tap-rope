import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from '../../src/core/achievements';
import { SKINS, STAGES } from '../../src/core/content';
import {
  ACH_REWARD, COSMETICS, applyRewards, buyCosmetic, cosmeticsOf, equipCosmetic, frameOf, runRewards, streakReward,
} from '../../src/core/economy';
import { defaultSave } from '../../src/core/storage';
import type { SaveData } from '../../src/types';

const boss = STAGES.find((s) => s.kind === 'boss')!;
const normal = STAGES[0];

describe('runRewards', () => {
  it('pays first clear +10, each new star +5, and the one-time first-mission bonus', () => {
    const before = defaultSave();
    const after: SaveData = { ...before, stars: { [normal.id]: 2 } };
    const r = runRewards(before, after, ['first-clear'], null);
    expect(r.map((x) => [x.kind, x.coins])).toEqual([['first-clear', 10], ['star', 10], ['first-mission', 60]]);
  });

  it('boss first clear pays +30; replays pay only for newly earned stars', () => {
    const b0: SaveData = { ...defaultSave(), stars: { [boss.id]: 0 } };
    expect(runRewards(b0, { ...b0, stars: { [boss.id]: 1 } }, [], null)).toEqual([
      expect.objectContaining({ kind: 'boss-clear', coins: 30 }), expect.objectContaining({ kind: 'star', coins: 5 }),
    ]);
    const s1: SaveData = { ...defaultSave(), stars: { [normal.id]: 1 } };
    expect(runRewards(s1, { ...s1, stars: { [normal.id]: 3 } }, [], null)).toEqual([
      expect.objectContaining({ kind: 'star', coins: 10 }),
    ]);
    expect(runRewards(s1, s1, [], null)).toEqual([]);
  });

  it('pays each achievement (20–50) and an extended daily streak', () => {
    const s = defaultSave();
    const r = runRewards(s, s, ['chain-50', 'daily-7'], { count: 7, extended: true });
    expect(r).toEqual([
      expect.objectContaining({ kind: 'achievement', coins: ACH_REWARD['chain-50'] }),
      expect.objectContaining({ kind: 'achievement', coins: ACH_REWARD['daily-7'] }),
      expect.objectContaining({ kind: 'streak', coins: streakReward(7) }),
    ]);
    expect(runRewards(s, s, [], { count: 3, extended: false })).toEqual([]);
  });

  it('every achievement has a reward in 20..60 (first-clear = the 60 first-mission bonus)', () => {
    for (const a of ACHIEVEMENTS) {
      const c = ACH_REWARD[a.id];
      expect(c, a.id).toBeGreaterThanOrEqual(20);
      expect(c, a.id).toBeLessThanOrEqual(a.id === 'first-clear' ? 60 : 50);
    }
  });

  it('streak tiers: 1–2 days 10, 3–6 days 25, 7+ days 50', () => {
    expect([1, 2, 3, 6, 7, 30].map(streakReward)).toEqual([10, 10, 25, 25, 50, 50]);
  });

  it('applyRewards adds the coins without mutating', () => {
    const s = { ...defaultSave(), coins: 5 };
    const next = applyRewards(s, [{ kind: 'star', label: '', coins: 10 }, { kind: 'streak', label: '', coins: 25 }]);
    expect(next.coins).toBe(40);
    expect(s.coins).toBe(5);
    expect(applyRewards(s, [])).toBe(s);
  });
});

describe('cosmetics', () => {
  const rich: SaveData = { ...defaultSave(), coins: 10000 };
  const tint = COSMETICS.find((c) => c.kind === 'tint' && c.skin === 'kid')!;
  const catTint = COSMETICS.find((c) => c.kind === 'tint' && c.skin === 'cat')!;
  const trail = COSMETICS.find((c) => c.kind === 'trail')!;

  it('catalog: unique ids, valid hex colours, every skin has colour variants', () => {
    expect(new Set(COSMETICS.map((c) => c.id)).size).toBe(COSMETICS.length);
    for (const c of COSMETICS) expect(c.color).toMatch(/^#[0-9a-f]{6}$/i);
    for (const s of SKINS) expect(COSMETICS.some((c) => c.kind === 'tint' && c.skin === s.id)).toBe(true);
    for (const k of ['trail', 'ring', 'frame'] as const) expect(COSMETICS.some((c) => c.kind === k)).toBe(true);
  });

  it('buy: needs funds, not yet owned, and (for a colour variant) the skin itself', () => {
    expect(buyCosmetic({ ...defaultSave(), coins: tint.price - 1 }, tint.id)).toBeNull();
    const bought = buyCosmetic(rich, tint.id)!;
    expect(bought.coins).toBe(10000 - tint.price);
    expect(bought.cosmetics.owned).toEqual([tint.id]);
    expect(buyCosmetic(bought, tint.id)).toBeNull();
    expect(buyCosmetic(rich, catTint.id)).toBeNull(); // cat not owned
    expect(buyCosmetic({ ...rich, ownedSkins: ['kid', 'cat'] }, catTint.id)).not.toBeNull();
    expect(buyCosmetic(rich, 'nope')).toBeNull();
  });

  it('equip / unequip owned cosmetics; cosmeticsOf resolves render colours for the deployed skin', () => {
    expect(cosmeticsOf(rich)).toEqual({ tint: null, trail: null, ring: null });
    expect(equipCosmetic(rich, tint.id)).toBe(rich); // not owned → unchanged
    let s = buyCosmetic(buyCosmetic(rich, tint.id)!, trail.id)!;
    s = equipCosmetic(equipCosmetic(s, tint.id), trail.id);
    expect(cosmeticsOf(s)).toEqual({ tint: tint.color, trail: trail.color, ring: null });
    expect(cosmeticsOf({ ...s, skin: 'cat' }).tint).toBeNull(); // the variant belongs to the kid skin
    const off = equipCosmetic(s, null, 'trail');
    expect(cosmeticsOf(off).trail).toBeNull();
    expect(equipCosmetic(s, null, 'tint', 'kid').cosmetics.tint).toEqual({});
  });

  it('frameOf returns the equipped result-card frame', () => {
    const frame = COSMETICS.find((c) => c.kind === 'frame')!;
    expect(frameOf(rich)).toBeNull();
    expect(frameOf(equipCosmetic(buyCosmetic(rich, frame.id)!, frame.id))?.id).toBe(frame.id);
  });
});
