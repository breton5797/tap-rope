/**
 * The game's one door to ads and the 칼퇴 패스 (monetization spec §3). Screens ask `offer()` what to show and
 * `claim()` to run it; points come back for the caller to add to SaveData.coins. No SDK is touched from here —
 * adapters come from ./platform (web: none; the iPad / Android app build swaps in AdMob + store purchases).
 */
import type { DateKey } from '../core/live/types';
import { DAILY_POINTS } from '../core/live/daily';
import { AdService, type AdServiceDeps } from './ad-service';
import type { AdAdapter, BuyResult, PassAdapter } from './adapters/types';
import { DEFAULT_CONFIG, type MonetizationConfig } from './config';
import { claim as payOnce, claimsOn, emptyMon, nextKey, parseMon, type MonSave } from './ledger';
import { decide, type Decision, type Placement } from './policy';

export const MON_KEY = 'officeescape.mon.v1';
export const PASS_KEY = 'officeescape.pass.v1';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export type Offer = Decision & { readonly points: number; readonly used: number; readonly limit: number };
export interface ClaimResult {
  readonly result: 'granted' | 'skipped' | 'unavailable';
  readonly points: number;
}

export interface Monetization {
  /** settles after consent + the pass check; offers made before then are conservative (no ad) */
  readonly ready: Promise<void>;
  /** an ad or purchase SDK exists in this build */
  readonly available: boolean;
  offer(placement: Placement, date: DateKey): Offer;
  claim(placement: Placement, date: DateKey): Promise<ClaimResult>;
  passOwned(): boolean;
  passPrice(): string | null;
  buyPass(): Promise<BuyResult>;
  restorePass(): Promise<boolean>;
  privacyOptions(): Promise<void>;
  setConfig(config: MonetizationConfig): void;
}

export interface MonetizationDeps {
  readonly ads: AdAdapter | null;
  readonly pass: PassAdapter | null;
  readonly store: Store | undefined;
  readonly now: () => number;
  readonly config: MonetizationConfig;
  readonly sleep?: AdServiceDeps['sleep'];
}

function read(store: Store | undefined, key: string): string | null {
  try {
    return store?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(store: Store | undefined, key: string, value: string): void {
  try {
    store?.setItem(key, value);
  } catch {
    /* private mode / quota: this session still works */
  }
}

function loadMon(store: Store | undefined, now: number): MonSave {
  const text = read(store, MON_KEY);
  if (!text) return emptyMon(now);
  try {
    return parseMon(JSON.parse(text), now);
  } catch {
    return emptyMon(now);
  }
}

export function createMonetization(d: MonetizationDeps): Monetization {
  let config = d.config;
  let save = loadMon(d.store, d.now());
  if (read(d.store, MON_KEY) === null) write(d.store, MON_KEY, JSON.stringify(save));
  let pass = read(d.store, PASS_KEY) === '1';
  let price: string | null = null;
  const ads = d.ads ? new AdService(d.ads, { sleep: d.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))), now: d.now }) : null;

  const setPass = (owned: boolean): void => {
    pass = owned;
    write(d.store, PASS_KEY, owned ? '1' : '0');
  };

  const ready = (async () => {
    const [, owned, p] = await Promise.all([
      ads ? ads.init().then(() => ads.preload()) : Promise.resolve(),
      d.pass ? d.pass.owned().catch(() => null) : Promise.resolve(null),
      d.pass ? d.pass.price().catch(() => null) : Promise.resolve(null),
    ]);
    if (owned !== null) setPass(owned);
    price = p;
  })();

  const offer = (placement: Placement, date: DateKey): Offer => {
    const day = claimsOn(save, date);
    const decision = decide({
      placement,
      config: ads ? config : { ...config, adsEnabled: false },
      canRequestAds: ads?.canRequestAds ?? false,
      hasPass: pass,
      showing: ads?.showing ?? false,
      secondsSinceFirstOpen: (d.now() - save.firstOpenMs) / 1000,
      stageClaimsToday: day.stage,
      dailyClaimedToday: day.daily,
    });
    const points = placement === 'daily' ? DAILY_POINTS : config.stageRewardPoints;
    return placement === 'daily'
      ? { ...decision, points, used: day.daily ? 1 : 0, limit: 1 }
      : { ...decision, points, used: day.stage, limit: config.rewardedDailyLimit };
  };

  const grant = (placement: Placement, date: DateKey, key: string): ClaimResult => {
    const paid = payOnce(save, key, config);
    if (!paid || nextKey(save, placement, date) !== key) return { result: 'unavailable', points: 0 };
    save = paid.save;
    write(d.store, MON_KEY, JSON.stringify(save));
    return { result: 'granted', points: paid.points };
  };

  const claim = async (placement: Placement, date: DateKey): Promise<ClaimResult> => {
    const o = offer(placement, date);
    // the grant id is fixed before the ad shows, so a late or repeated callback can only pay this one grant
    const key = nextKey(save, placement, date);
    if (o.kind === 'pass') return grant(placement, date, key);
    if (o.kind !== 'ad' || !ads) return { result: 'unavailable', points: 0 };
    const shown = await ads.showRewarded();
    void ads.preload();
    if (shown !== 'rewarded') return { result: shown, points: 0 };
    return grant(placement, date, key);
  };

  return {
    ready,
    available: Boolean(d.ads || d.pass),
    offer,
    claim,
    passOwned: () => pass,
    passPrice: () => price,
    buyPass: async () => {
      if (!d.pass) return 'failed';
      const r = await d.pass.buy().catch((): BuyResult => 'failed');
      if (r === 'bought') setPass(true);
      return r;
    },
    restorePass: async () => {
      if (!d.pass) return false;
      const found = await d.pass.restore().catch(() => false);
      if (found) setPass(true);
      return found;
    },
    privacyOptions: () => ads?.privacyOptions() ?? Promise.resolve(),
    setConfig: (c) => {
      config = c;
    },
  };
}

export { DEFAULT_CONFIG };
export type { Placement };
