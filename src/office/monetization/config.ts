/**
 * MonetizationConfig (monetization spec §3, AD_MONETIZATION §6): local defaults, the remote JSON read key by key
 * with type and range checks, and an emergency stop. Any bad value falls back to its default; the config never
 * decides server-side rights — rewards are paid by the ledger under its own limits.
 */
export interface MonetizationConfig {
  /** emergency stop for every ad */
  readonly adsEnabled: boolean;
  readonly rewardedEnabled: boolean;
  /** always false: 칼퇴근 대작전 is a family title (GAME_PSYCHOLOGY P4, AD_MONETIZATION 0.4) */
  readonly interstitialEnabled: false;
  /** no ad offer until this long after the first launch */
  readonly graceSeconds: number;
  /** stage-clear rewarded bonuses per local day */
  readonly rewardedDailyLimit: number;
  /** points for one stage-clear rewarded bonus */
  readonly stageRewardPoints: number;
}

/** starting values for experiments — estimates, not measured optima */
export const DEFAULT_CONFIG: MonetizationConfig = {
  adsEnabled: true,
  rewardedEnabled: true,
  interstitialEnabled: false,
  graceSeconds: 180,
  rewardedDailyLimit: 5,
  stageRewardPoints: 30,
};

const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const int = (v: unknown, d: number, min: number, max: number): number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : d;

/** the remote JSON (snake_case keys, AD_MONETIZATION §6) → a valid config */
export function parseConfig(raw: unknown): MonetizationConfig {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return DEFAULT_CONFIG;
  const r = raw as Record<string, unknown>;
  const d = DEFAULT_CONFIG;
  return {
    adsEnabled: bool(r.ads_enabled, d.adsEnabled),
    rewardedEnabled: bool(r.rewarded_enabled, d.rewardedEnabled),
    interstitialEnabled: false,
    graceSeconds: int(r.new_user_ad_grace_seconds, d.graceSeconds, 0, 3600),
    rewardedDailyLimit: int(r.rewarded_daily_limit, d.rewardedDailyLimit, 0, 20),
    stageRewardPoints: int(r.stage_reward_points, d.stageRewardPoints, 0, 200),
  };
}

/** fetch the remote config; offline, slow or broken → the defaults (never throws) */
export async function loadConfig(url: string, fetcher: typeof fetch = fetch, timeoutMs = 3000): Promise<MonetizationConfig> {
  const ctl = typeof AbortController === 'undefined' ? null : new AbortController();
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const res = await fetcher(url, { cache: 'no-store', ...(ctl ? { signal: ctl.signal } : {}) });
    return res.ok ? parseConfig(await res.json()) : DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
