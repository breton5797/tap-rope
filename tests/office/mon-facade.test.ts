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
    expect(await m.claim('stage', D)).toMatchObject({ result: 'granted', points: 30 });
    expect(m.offer('stage', D)).toMatchObject({ used: 1 });
  });

  it('pays nothing when the player skips the ad or no ad is available', async () => {
    const skip = await setup({ ads: { show: 'skip' }, now: LATER });
    expect(await skip.m.claim('stage', D)).toMatchObject({ result: 'skipped', points: 0 });
    const empty = await setup({ ads: { load: 'fail' }, now: LATER });
    expect(await empty.m.claim('stage', D)).toMatchObject({ result: 'unavailable', points: 0 });
    expect(empty.m.offer('stage', D)).toMatchObject({ used: 0 });
  });

  it('gives a pass holder the reward without an ad, within the limits', async () => {
    const { m } = await setup({ pass: true });
    expect(m.offer('daily', D)).toMatchObject({ kind: 'pass', points: DAILY_POINTS });
    expect(await m.claim('daily', D)).toMatchObject({ result: 'granted', points: DAILY_POINTS });
    expect(await m.claim('daily', D)).toMatchObject({ result: 'unavailable', points: 0 });
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

  it('does not touch the ad SDK until the player taps a bonus (child data minimisation)', async () => {
    let inits = 0;
    const ads = { ...createTestAds({}), init: async () => { inits += 1; return { canRequestAds: true }; } };
    const m = createMonetization({ ads, pass: createTestPass({}), store: memStore(), now: () => T0, config: DEFAULT_CONFIG, sleep: async () => undefined });
    await m.ready;
    expect(inits).toBe(0);
    const later = createMonetization({ ads, pass: createTestPass({}), store: memStore(), now: () => LATER, config: DEFAULT_CONFIG, sleep: async () => undefined });
    await later.ready;
    expect(inits).toBe(0);
  });

  it('never starts the ad SDK for a pass holder', async () => {
    let inits = 0;
    const ads = { ...createTestAds({}), init: async () => { inits += 1; return { canRequestAds: true }; } };
    const m = createMonetization({ ads, pass: createTestPass({ owned: true }), store: memStore(), now: () => LATER, config: DEFAULT_CONFIG, sleep: async () => undefined });
    await m.ready;
    expect((await m.claim('stage', D)).result).toBe('granted');
    expect(inits).toBe(0);
  });

  it('undo() takes back a grant whose points could not be saved', async () => {
    const { m } = await setup({ now: LATER });
    const r = await m.claim('stage', D);
    expect(r.result).toBe('granted');
    r.undo();
    expect(m.offer('stage', D)).toMatchObject({ used: 0 });
    expect((await m.claim('stage', D)).points).toBe(30);
  });

  it('a restore that cannot reach the store says so (null), and keeps the pass', async () => {
    const store = memStore({ [PASS_KEY]: '1' });
    const m = createMonetization({
      ads: null, pass: { ...createTestPass({}), owned: async () => null, restore: async () => null },
      store, now: () => T0, config: DEFAULT_CONFIG,
    });
    await m.ready;
    expect(await m.restorePass()).toBeNull();
    expect(m.passOwned()).toBe(true);
  });

  it('a store check that started before a purchase cannot switch the bought pass off', async () => {
    let answer: (v: boolean) => void = () => undefined;
    let calls = 0;
    const pass = { ...createTestPass({}), owned: () => { calls += 1; return calls === 1 ? Promise.resolve(false) : new Promise<boolean>((r) => { answer = r; }); } };
    const m = createMonetization({ ads: null, pass, store: memStore(), now: () => T0, config: DEFAULT_CONFIG });
    await m.ready;
    const stale = m.refreshPass(); // e.g. back in the foreground: asks the store (slow)
    expect(await m.buyPass()).toBe('bought');
    answer(false); // the old answer arrives after the purchase
    await stale;
    expect(m.passOwned()).toBe(true);
  });

  it('a build without a store never trusts a stored pass flag', async () => {
    const m = createMonetization({ ads: null, pass: null, store: memStore({ [PASS_KEY]: '1' }), now: () => T0, config: DEFAULT_CONFIG });
    await m.ready;
    expect(m.passOwned()).toBe(false);
  });

  it('works with no ad / purchase SDK at all (web build)', async () => {
    const m = createMonetization({ ads: null, pass: null, store: memStore(), now: () => LATER, config: DEFAULT_CONFIG });
    await m.ready;
    expect(m.available).toBe(false);
    expect(m.passAvailable).toBe(false);
    expect(m.offer('stage', D)).toMatchObject({ kind: 'none', reason: 'off' });
    expect(await m.claim('stage', D)).toMatchObject({ result: 'unavailable', points: 0 });
  });
});
