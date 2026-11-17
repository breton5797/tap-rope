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
import { claim as payOnce, claimsOn, emptyMon, nextKey, parseMon, unclaim, type MonSave } from './ledger';
import { decide, type Decision, type Placement } from './policy';

export const MON_KEY = 'officeescape.mon.v1';
export const PASS_KEY = 'officeescape.pass.v1';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export type Offer = Decision & { readonly points: number; readonly used: number; readonly limit: number };
export interface ClaimResult {
  readonly result: 'granted' | 'skipped' | 'unavailable';
  readonly points: number;
  /** take the grant back when its points could not be saved (the player can earn it again) */
  undo(): void;
}

export interface Monetization {
  /** settles after the pass check (the ad SDK is not touched until a player taps a bonus) */
  readonly ready: Promise<void>;
  /** an ad or purchase SDK exists in this build */
  readonly available: boolean;
  /** a store purchase SDK exists (the 칼퇴 패스 card is shown) */
  readonly passAvailable: boolean;
  offer(placement: Placement, date: DateKey): Offer;
  claim(placement: Placement, date: DateKey): Promise<ClaimResult>;
  passOwned(): boolean;
  passPrice(): string | null;
  buyPass(): Promise<BuyResult>;
  /** true found, false not found, null the store could not be reached */
  restorePass(): Promise<boolean | null>;
  /** ask the store again (app back in the foreground: a pending purchase may have been approved) */
  refreshPass(): Promise<void>;
  /** the consent SDK asks for a way back into the privacy choices (known once ads were started) */
  privacyOptionsRequired(): boolean;
  /** settles when no ad is on the screen (reward effects wait for it) */
  afterAd(): Promise<void>;
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
  // a build without a store sells no pass: a stored flag there means nothing (review N5)
  let pass = d.pass ? read(d.store, PASS_KEY) === '1' : false;
  /** bumped by a purchase / restore: a store check started before it must not overwrite it */
  let passGen = 0;
  let price: string | null = null;
  const ads = d.ads ? new AdService(d.ads, { sleep: d.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))), now: d.now }) : null;

  const setPass = (owned: boolean, bump = false): void => {
    if (bump) passGen += 1;
    pass = owned;
    write(d.store, PASS_KEY, owned ? '1' : '0');
  };

  const refreshPass = async (): Promise<void> => {
    if (!d.pass) return;
    const gen = passGen;
    const [owned, p] = await Promise.all([d.pass.owned().catch(() => null), d.pass.price().catch(() => null)]);
    // the store could not be asked: keep what we knew (an offline launch never takes the pass away);
    // a purchase / restore that finished meanwhile wins over this older answer
    if (owned !== null && gen === passGen) setPass(owned);
    if (p !== null) price = p;
  };

  const ready = refreshPass();

  const offer = (placement: Placement, date: DateKey): Offer => {
    const day = claimsOn(save, date);
    const decision = decide({
      placement,
      config: ads ? config : { ...config, adsEnabled: false },
      canRequestAds: ads ? ads.canRequestAds : false,
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

  const persist = (next: MonSave): void => {
    save = next;
    write(d.store, MON_KEY, JSON.stringify(save));
  };
  const none = (result: 'skipped' | 'unavailable'): ClaimResult => ({ result, points: 0, undo: () => undefined });

  const grant = (placement: Placement, date: DateKey, key: string): ClaimResult => {
    const paid = payOnce(save, key, config);
    if (!paid || nextKey(save, placement, date) !== key) return none('unavailable');
    persist(paid.save);
    return { result: 'granted', points: paid.points, undo: () => persist(unclaim(save, key)) };
  };

  const claim = async (placement: Placement, date: DateKey): Promise<ClaimResult> => {
    const o = offer(placement, date);
    // the grant id is fixed before the ad shows, so a late or repeated callback can only pay this one grant
    const key = nextKey(save, placement, date);
    if (o.kind === 'pass') return grant(placement, date, key);
    if (o.kind !== 'ad' || !ads) return none('unavailable');
    const shown = await ads.showRewarded();
    // the SDK was started by this player's choice: the next ad may load ahead
    if (!pass) void ads.preload();
    if (shown !== 'rewarded') return none(shown);
    return grant(placement, date, key);
  };

  return {
    ready,
    available: Boolean(d.ads || d.pass),
    passAvailable: d.pass !== null,
    offer,
    claim,
    passOwned: () => pass,
    passPrice: () => price,
    buyPass: async () => {
      if (!d.pass) return 'failed';
      const r = await d.pass.buy().catch((): BuyResult => 'failed');
      if (r === 'bought') setPass(true, true);
      return r;
    },
    restorePass: async () => {
      if (!d.pass) return false;
      const found = await d.pass.restore().catch(() => null);
      if (found) setPass(true, true);
      return found;
    },
    refreshPass,
    privacyOptionsRequired: () => ads?.privacyOptionsRequired ?? false,
    afterAd: () => ads?.idle() ?? Promise.resolve(),
    privacyOptions: () => ads?.privacyOptions() ?? Promise.resolve(),
    setConfig: (c) => {
      config = c;
    },
  };
}

export { DEFAULT_CONFIG };
export type { Placement };
