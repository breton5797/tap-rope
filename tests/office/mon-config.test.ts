import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, parseConfig } from '../../src/office/monetization/config';

describe('monetization config (AD_MONETIZATION §6)', () => {
  it('starts from the family defaults: rewarded on, interstitial off', () => {
    expect(DEFAULT_CONFIG).toEqual({
      adsEnabled: true,
      rewardedEnabled: true,
      interstitialEnabled: false,
      graceSeconds: 180,
      rewardedDailyLimit: 5,
      stageRewardPoints: 30,
    });
  });

  it('reads the remote snake_case keys', () => {
    const cfg = parseConfig({ ads_enabled: false, rewarded_daily_limit: 3, new_user_ad_grace_seconds: 600, stage_reward_points: 20 });
    expect(cfg).toMatchObject({ adsEnabled: false, rewardedDailyLimit: 3, graceSeconds: 600, stageRewardPoints: 20 });
  });

  it('remote values can only make ads less frequent than the shipped defaults (a hijacked JSON cannot escalate)', () => {
    const cfg = parseConfig({ rewarded_daily_limit: 20, new_user_ad_grace_seconds: 0, stage_reward_points: 200 });
    expect(cfg).toMatchObject({ rewardedDailyLimit: 5, graceSeconds: 180, stageRewardPoints: 30 });
    expect(parseConfig({ rewarded_daily_limit: 2, new_user_ad_grace_seconds: 900 })).toMatchObject({ rewardedDailyLimit: 2, graceSeconds: 900 });
  });

  it('falls back per key on a wrong type or an out-of-range value', () => {
    const cfg = parseConfig({ ads_enabled: 'no', rewarded_daily_limit: 999, new_user_ad_grace_seconds: -5, stage_reward_points: 2.5 });
    expect(cfg).toEqual(DEFAULT_CONFIG);
  });

  it('keeps interstitials off for this family title whatever the remote says', () => {
    expect(parseConfig({ interstitial_enabled: true }).interstitialEnabled).toBe(false);
  });

  it('returns the defaults for anything that is not an object', () => {
    for (const raw of [null, undefined, 42, 'x', []]) expect(parseConfig(raw)).toEqual(DEFAULT_CONFIG);
  });

  it('the published remote config (public-office/monetization.json) equals the local defaults', () => {
    const raw: unknown = JSON.parse(readFileSync(new URL('../../public-office/monetization.json', import.meta.url), 'utf8'));
    expect(parseConfig(raw)).toEqual(DEFAULT_CONFIG);
  });
});
