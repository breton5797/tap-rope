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
    const cfg = parseConfig({ ads_enabled: false, rewarded_daily_limit: 3, new_user_ad_grace_seconds: 60, stage_reward_points: 20 });
    expect(cfg).toMatchObject({ adsEnabled: false, rewardedDailyLimit: 3, graceSeconds: 60, stageRewardPoints: 20 });
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
});
