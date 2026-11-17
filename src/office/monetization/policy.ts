/**
 * AdPolicy (monetization spec §1, AD_MONETIZATION §4): may this placement offer its reward now, and how —
 * a rewarded ad the player chooses to watch, or (칼퇴 패스) the same reward without an ad. Pure.
 */
import type { MonetizationConfig } from './config';

export type Placement = 'daily' | 'stage';

export interface PolicyInput {
  readonly placement: Placement;
  readonly config: MonetizationConfig;
  /** the consent SDK says ads may be requested */
  readonly canRequestAds: boolean;
  readonly hasPass: boolean;
  /** a full-screen ad is on screen (global lock) */
  readonly showing: boolean;
  readonly secondsSinceFirstOpen: number;
  readonly stageClaimsToday: number;
  readonly dailyClaimedToday: boolean;
}

export type DenyReason = 'limit' | 'off' | 'consent' | 'grace' | 'busy';
export type Decision = { readonly kind: 'ad' } | { readonly kind: 'pass' } | { readonly kind: 'none'; readonly reason: DenyReason };

const none = (reason: DenyReason): Decision => ({ kind: 'none', reason });

function overLimit(i: PolicyInput): boolean {
  return i.placement === 'daily' ? i.dailyClaimedToday : i.stageClaimsToday >= i.config.rewardedDailyLimit;
}

export function decide(i: PolicyInput): Decision {
  if (overLimit(i)) return none('limit');
  if (i.hasPass) return { kind: 'pass' };
  if (!i.config.adsEnabled || !i.config.rewardedEnabled) return none('off');
  if (i.showing) return none('busy');
  if (!i.canRequestAds) return none('consent');
  if (i.secondsSinceFirstOpen < i.config.graceSeconds) return none('grace');
  return { kind: 'ad' };
}
