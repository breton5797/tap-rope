import { describe, expect, it } from 'vitest';
import { AdService, STALE_MS } from '../../src/office/monetization/ad-service';
import type { AdAdapter } from '../../src/office/monetization/adapters/types';

interface Script {
  consent?: boolean;
  loads?: Array<'ok' | 'fail'>;
  show?: 'reward' | 'skip' | 'fail';
}

function fake(s: Script): AdAdapter & { loadCalls: number; showCalls: number } {
  const loads = [...(s.loads ?? ['ok'])];
  const a = {
    loadCalls: 0,
    showCalls: 0,
    init: async () => ({ canRequestAds: s.consent ?? true }),
    load: async () => {
      a.loadCalls += 1;
      if ((loads.shift() ?? 'ok') === 'fail') throw new Error('no fill');
    },
    show: async () => {
      a.showCalls += 1;
      if (s.show === 'fail') throw new Error('show failed');
      return s.show !== 'skip';
    },
    privacyOptions: async () => undefined,
  };
  return a;
}

const noSleep = async (): Promise<void> => undefined;

describe('AdService (rewarded lifecycle)', () => {
  it('loads after consent and reports rewarded only from the reward callback', async () => {
    const a = fake({});
    const svc = new AdService(a, { sleep: noSleep, now: () => 0 });
    expect(await svc.init()).toBe(true);
    await svc.preload();
    expect(svc.state).toBe('ready');
    expect(await svc.showRewarded()).toBe('rewarded');
    expect(svc.state).toBe('closed');
  });

  it('reports skipped when the player closes the ad before the reward', async () => {
    const svc = new AdService(fake({ show: 'skip' }), { sleep: noSleep, now: () => 0 });
    await svc.init();
    expect(await svc.showRewarded()).toBe('skipped');
  });

  it('never loads without consent', async () => {
    const a = fake({ consent: false });
    const svc = new AdService(a, { sleep: noSleep, now: () => 0 });
    expect(await svc.init()).toBe(false);
    await svc.preload();
    expect(a.loadCalls).toBe(0);
    expect(await svc.showRewarded()).toBe('unavailable');
  });

  it('retries a failed load at most twice, then gives up (no endless retry)', async () => {
    const a = fake({ loads: ['fail', 'fail', 'fail', 'fail'] });
    const svc = new AdService(a, { sleep: noSleep, now: () => 0 });
    await svc.init();
    await svc.preload();
    expect(a.loadCalls).toBe(3);
    expect(svc.state).toBe('failed');
    expect(await svc.showRewarded()).toBe('unavailable');
  });

  it('turns a show failure into unavailable and frees the lock', async () => {
    const svc = new AdService(fake({ show: 'fail' }), { sleep: noSleep, now: () => 0 });
    await svc.init();
    expect(await svc.showRewarded()).toBe('unavailable');
    expect(svc.showing).toBe(false);
  });

  it('refuses a second ad while one is on screen (global lock)', async () => {
    let release: (v: boolean) => void = () => undefined;
    const a = { ...fake({}), show: () => new Promise<boolean>((r) => { release = r; }) };
    const svc = new AdService(a, { sleep: noSleep, now: () => 0 });
    await svc.init();
    await svc.preload();
    const first = svc.showRewarded();
    await Promise.resolve();
    expect(svc.showing).toBe(true);
    expect(await svc.showRewarded()).toBe('unavailable');
    release(true);
    expect(await first).toBe('rewarded');
    expect(svc.showing).toBe(false);
  });

  it('reloads a stale ad before showing it', async () => {
    let t = 0;
    const a = fake({});
    const svc = new AdService(a, { sleep: noSleep, now: () => t });
    await svc.init();
    await svc.preload();
    t = STALE_MS + 1;
    expect(await svc.showRewarded()).toBe('rewarded');
    expect(a.loadCalls).toBe(2);
  });

  it('survives an adapter whose init throws (no ads, game goes on)', async () => {
    const a = { ...fake({}), init: async () => { throw new Error('sdk missing'); } };
    const svc = new AdService(a, { sleep: noSleep, now: () => 0 });
    expect(await svc.init()).toBe(false);
    expect(await svc.showRewarded()).toBe('unavailable');
  });

  it('starts the SDK (consent, then load) only when an ad is first asked for', async () => {
    let inits = 0;
    const a = { ...fake({}), init: async () => { inits += 1; return { canRequestAds: true }; } };
    const svc = new AdService(a, { sleep: noSleep, now: () => 0 });
    expect(inits).toBe(0);
    expect(svc.canRequestAds).toBeNull();
    expect(await svc.showRewarded()).toBe('rewarded');
    expect(await svc.showRewarded()).toBe('rewarded');
    expect(inits).toBe(1);
  });

  it('a tap that finds no consent loads nothing', async () => {
    const a = fake({ consent: false });
    const svc = new AdService(a, { sleep: noSleep, now: () => 0 });
    expect(await svc.showRewarded()).toBe('unavailable');
    expect(a.loadCalls).toBe(0);
    expect(svc.canRequestAds).toBe(false);
  });

  it('a second request while the first is still loading is refused (lock covers loading)', async () => {
    let release: () => void = () => undefined;
    const a = { ...fake({}), load: () => new Promise<void>((r) => { release = r; }) };
    const svc = new AdService(a, { sleep: noSleep, now: () => 0 });
    const first = svc.showRewarded();
    await new Promise((r) => setTimeout(r, 0));
    expect(await svc.showRewarded()).toBe('unavailable');
    release();
    expect(await first).toBe('rewarded');
  });

  it('re-reads consent after the privacy options form', async () => {
    let consent = true;
    const a = { ...fake({}), init: async () => ({ canRequestAds: consent }) };
    const svc = new AdService(a, { sleep: noSleep, now: () => 0 });
    await svc.init();
    consent = false;
    await svc.privacyOptions();
    expect(svc.canRequestAds).toBe(false);
  });

  it('keeps the lock until the ad is closed, even though the reward came first', async () => {
    let close: () => void = () => undefined;
    const a = { ...fake({}), whenClosed: () => new Promise<void>((r) => { close = r; }) };
    const svc = new AdService(a, { sleep: noSleep, now: () => 0 });
    expect(await svc.showRewarded()).toBe('rewarded');
    expect(svc.showing).toBe(true);
    let idle = false;
    void svc.idle().then(() => { idle = true; });
    await new Promise((r) => setTimeout(r, 0));
    expect(idle).toBe(false);
    close();
    await new Promise((r) => setTimeout(r, 0));
    expect(svc.showing).toBe(false);
    expect(idle).toBe(true);
  });
});
