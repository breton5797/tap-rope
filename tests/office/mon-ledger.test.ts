import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/office/monetization/config';
import { claim, claimsOn, emptyMon, nextKey, parseMon, unclaim } from '../../src/office/monetization/ledger';
import { DAILY_POINTS } from '../../src/office/core/live/daily';

const D1 = '2026-11-18';
const D2 = '2026-11-19';

describe('ad reward ledger (one grant per reward id)', () => {
  it('pays the stage bonus once per key and counts it for the day', () => {
    const s0 = emptyMon(1000);
    const key = nextKey(s0, 'stage', D1);
    const r1 = claim(s0, key, DEFAULT_CONFIG);
    expect(r1?.points).toBe(30);
    expect(claimsOn(r1!.save, D1)).toEqual({ stage: 1, daily: false });
    // the same callback twice (duplicate SDK event) pays nothing
    expect(claim(r1!.save, key, DEFAULT_CONFIG)).toBeNull();
    // the next ad of the day gets a fresh key
    expect(nextKey(r1!.save, 'stage', D1)).not.toBe(key);
  });

  it('pays the daily-mission bonus once a day at the daily mission points', () => {
    const s0 = emptyMon(0);
    const k = nextKey(s0, 'daily', D1);
    const r = claim(s0, k, DEFAULT_CONFIG)!;
    expect(r.points).toBe(DAILY_POINTS);
    expect(claimsOn(r.save, D1).daily).toBe(true);
    expect(claim(r.save, nextKey(r.save, 'daily', D1), DEFAULT_CONFIG)).toBeNull();
    expect(claim(r.save, nextKey(r.save, 'daily', D2), DEFAULT_CONFIG)?.points).toBe(DAILY_POINTS);
  });

  it('refuses a stage key past the daily limit', () => {
    let s = emptyMon(0);
    for (let i = 0; i < DEFAULT_CONFIG.rewardedDailyLimit; i += 1) s = claim(s, nextKey(s, 'stage', D1), DEFAULT_CONFIG)!.save;
    expect(claim(s, nextKey(s, 'stage', D1), DEFAULT_CONFIG)).toBeNull();
    expect(claimsOn(s, D2)).toEqual({ stage: 0, daily: false });
  });

  it('undoes a grant whose points could not be saved (the reward can be earned again)', () => {
    const s0 = emptyMon(0);
    const key = nextKey(s0, 'stage', D1);
    const paid = claim(s0, key, DEFAULT_CONFIG)!.save;
    const back = unclaim(paid, key);
    expect(claimsOn(back, D1)).toEqual({ stage: 0, daily: false });
    expect(back.ledger).toEqual([]);
    expect(claim(back, key, DEFAULT_CONFIG)?.points).toBe(30);
    expect(unclaim(back, key)).toBe(back);
  });

  it('rejects malformed keys', () => {
    const s = emptyMon(0);
    for (const k of ['', 'ad:stage:2026-11-18', 'ad:x:2026-11-18:1', 'ad:stage:bad:1', 'daily:2026-11-18']) {
      expect(claim(s, k, DEFAULT_CONFIG)).toBeNull();
    }
  });

  it('round-trips through storage and repairs a corrupt save', () => {
    const s = claim(emptyMon(5), nextKey(emptyMon(5), 'stage', D1), DEFAULT_CONFIG)!.save;
    expect(parseMon(JSON.parse(JSON.stringify(s)), 9)).toEqual(s);
    expect(parseMon({ v: 99 }, 9)).toEqual(emptyMon(9));
    expect(parseMon('junk', 9)).toEqual(emptyMon(9));
  });

  it('never mutates the save it was given', () => {
    const s0 = Object.freeze(emptyMon(0));
    expect(() => claim(s0, nextKey(s0, 'stage', D1), DEFAULT_CONFIG)).not.toThrow();
    expect(s0.ledger).toEqual([]);
  });
});
