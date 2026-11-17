import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/office/monetization/config';
import { createMonetization, MON_KEY, PASS_KEY } from '../../src/office/monetization/index';
import { createTestAds, createTestPass } from '../../src/office/monetization/adapters/test';
import { DAILY_POINTS } from '../../src/office/core/live/daily';

const D = '2026-11-18';
const T0 = Date.UTC(2026, 10, 18, 9);
const LATER = T0 + 10 * 60 * 1000; // past the 180 s grace

function memStore(init: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> & { data: Record<string, string> } {
  const data = { ...init };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
}

async function setup(opts: { ads?: Parameters<typeof createTestAds>[0]; pass?: boolean; store?: ReturnType<typeof memStore>; now?: number } = {}) {
  const store = opts.store ?? memStore();
  // the first launch is at T0; `now` then moves to the time the test asks for
  let now = T0;
  const m = createMonetization({
    ads: createTestAds(opts.ads ?? {}),
    pass: createTestPass({ owned: opts.pass ?? false }),
    store,
    now: () => now,
    config: DEFAULT_CONFIG,
    sleep: async () => undefined,
  });
  await m.ready;
  now = opts.now ?? T0;
  return { m, store, setNow: (t: number) => { now = t; } };
}

describe('monetization facade', () => {
  it('hides offers during the new-player grace period, then grants the stage bonus once per watched ad', async () => {
    const { m, setNow } = await setup();
    expect(m.offer('stage', D)).toMatchObject({ kind: 'none', reason: 'grace' });
    setNow(LATER);
    expect(m.offer('stage', D)).toMatchObject({ kind: 'ad', points: 30, used: 0, limit: 5 });
    expect(await m.claim('stage', D)).toEqual({ result: 'granted', points: 30 });
    expect(m.offer('stage', D)).toMatchObject({ used: 1 });
  });

  it('pays nothing when the player skips the ad or no ad is available', async () => {
    const skip = await setup({ ads: { show: 'skip' }, now: LATER });
    expect(await skip.m.claim('stage', D)).toEqual({ result: 'skipped', points: 0 });
    const empty = await setup({ ads: { load: 'fail' }, now: LATER });
    expect(await empty.m.claim('stage', D)).toEqual({ result: 'unavailable', points: 0 });
    expect(empty.m.offer('stage', D)).toMatchObject({ used: 0 });
  });

  it('gives a pass holder the reward without an ad, within the limits', async () => {
    const { m } = await setup({ pass: true });
    expect(m.offer('daily', D)).toMatchObject({ kind: 'pass', points: DAILY_POINTS });
    expect(await m.claim('daily', D)).toEqual({ result: 'granted', points: DAILY_POINTS });
    expect(await m.claim('daily', D)).toEqual({ result: 'unavailable', points: 0 });
  });

  it('persists claims and the first launch across restarts', async () => {
    const store = memStore();
    const a = await setup({ store, now: LATER });
    await a.m.claim('stage', D);
    expect(JSON.parse(store.data[MON_KEY]!).ledger).toEqual([`ad:stage:${D}:1`]);
    const b = await setup({ store, now: LATER + 1000 });
    expect(b.m.offer('stage', D)).toMatchObject({ used: 1 });
  });

  it('remembers a bought pass and restores it from the store', async () => {
    const a = await setup({ now: LATER });
    expect(a.m.passOwned()).toBe(false);
    expect(await a.m.buyPass()).toBe('bought');
    expect(a.m.passOwned()).toBe(true);
    expect(a.store.data[PASS_KEY]).toBe('1');
    const b = await setup({ pass: true });
    expect(await b.m.restorePass()).toBe(true);
  });

  it('keeps a cached pass when the store cannot be asked (offline)', async () => {
    const store = memStore({ [PASS_KEY]: '1' });
    const m = createMonetization({
      ads: createTestAds({}), pass: { ...createTestPass({ owned: false }), owned: async () => null },
      store, now: () => T0, config: DEFAULT_CONFIG, sleep: async () => undefined,
    });
    await m.ready;
    expect(m.passOwned()).toBe(true);
  });

  it('works with no ad / purchase SDK at all (web build)', async () => {
    const m = createMonetization({ ads: null, pass: null, store: memStore(), now: () => LATER, config: DEFAULT_CONFIG });
    await m.ready;
    expect(m.available).toBe(false);
    expect(m.passAvailable).toBe(false);
    expect(m.offer('stage', D)).toMatchObject({ kind: 'none', reason: 'off' });
    expect(await m.claim('stage', D)).toEqual({ result: 'unavailable', points: 0 });
  });
});
