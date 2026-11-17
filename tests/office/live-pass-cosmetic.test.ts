import { describe, expect, it } from 'vitest';
import { COSMETICS, PASS_ITEMS, affordable, buyCosmetic, emptyLive, grantPassItems } from '../../src/office/core/live';
import { collection, mallItems } from '../../src/office/ui/live/model';

const D = '2026-11-18';

describe('칼퇴 패스 exclusive stamp', () => {
  it('exists as a stamp that is never sold for points', () => {
    expect(PASS_ITEMS).toEqual(['stamp-pass']);
    const c = COSMETICS.find((x) => x.id === 'stamp-pass');
    expect(c).toMatchObject({ category: 'stamp', exclusive: 'pass' });
    expect(buyCosmetic(emptyLive(), 'stamp-pass', 1e9, D)).toEqual({ ok: false, reason: 'exclusive' });
    expect(affordable(emptyLive(), 1e9, D).some((x) => x.id === 'stamp-pass')).toBe(false);
  });

  it('is granted once to a pass holder', () => {
    const live = grantPassItems(emptyLive());
    expect(live.owned).toEqual(['stamp-pass']);
    expect(grantPassItems(live)).toBe(live);
  });

  it('does not count toward the collection of players without the pass (no completion pressure)', () => {
    const all = COSMETICS.length;
    expect(collection(emptyLive()).total).toBe(all - 1);
    expect(collection(grantPassItems(emptyLive()))).toEqual({ owned: 1, total: all });
  });

  it('shows in the mall only where the pass can be bought, or once owned', () => {
    const ids = (show: boolean, live = emptyLive()) => mallItems(live, 0, D, 'stamp', show).map((x) => x.item.id);
    expect(ids(false)).not.toContain('stamp-pass');
    expect(mallItems(emptyLive(), 0, D, 'stamp', true).find((x) => x.item.id === 'stamp-pass')?.state).toBe('pass-only');
    expect(ids(false, grantPassItems(emptyLive()))).toContain('stamp-pass');
  });
});
