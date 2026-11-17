/**
 * How a rewarded show ended (@capacitor-community/admob 8.4): showRewardVideoAd resolves when the SDK's reward
 * callback fires (the official grant signal) and rejects with code REWARDED_AD_CANCELLED when the ad is closed
 * before it. true = rewarded, false = closed early (skipped); any other rejection is thrown (no ad shown).
 */
export type ShowSettled = { readonly ok: true } | { readonly ok: false; readonly error: unknown };

export function rewardOutcome(s: ShowSettled): boolean {
  if (s.ok) return true;
  const code = typeof s.error === 'object' && s.error !== null ? (s.error as { code?: unknown }).code : undefined;
  if (code === 'REWARDED_AD_CANCELLED') return false;
  throw s.error instanceof Error ? s.error : new Error(`admob: show failed${typeof code === 'string' ? ` (${code})` : ''}`);
}
