import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/office/monetization/config';
import { decide, type PolicyInput } from '../../src/office/monetization/policy';

const base: PolicyInput = {
  placement: 'stage',
  config: DEFAULT_CONFIG,
  canRequestAds: true,
  hasPass: false,
  showing: false,
  secondsSinceFirstOpen: 600,
  stageClaimsToday: 0,
  dailyClaimedToday: false,
};

describe('ad policy (AD_MONETIZATION §4)', () => {
  it('offers a rewarded ad when everything allows it', () => {
    expect(decide(base)).toEqual({ kind: 'ad' });
  });

  it('grants without an ad for a pass holder, but within the same limits', () => {
    expect(decide({ ...base, hasPass: true })).toEqual({ kind: 'pass' });
    expect(decide({ ...base, hasPass: true, canRequestAds: false, secondsSinceFirstOpen: 0 })).toEqual({ kind: 'pass' });
    expect(decide({ ...base, hasPass: true, stageClaimsToday: 5 })).toEqual({ kind: 'none', reason: 'limit' });
  });

  it('respects the emergency stop and the rewarded switch', () => {
    expect(decide({ ...base, config: { ...DEFAULT_CONFIG, adsEnabled: false } })).toEqual({ kind: 'none', reason: 'off' });
    expect(decide({ ...base, config: { ...DEFAULT_CONFIG, rewardedEnabled: false } })).toEqual({ kind: 'none', reason: 'off' });
  });

  it('never requests an ad before consent allows it', () => {
    expect(decide({ ...base, canRequestAds: false })).toEqual({ kind: 'none', reason: 'consent' });
  });

  it('keeps new players ad-free during the grace period', () => {
    expect(decide({ ...base, secondsSinceFirstOpen: 179 })).toEqual({ kind: 'none', reason: 'grace' });
    expect(decide({ ...base, secondsSinceFirstOpen: 180 })).toEqual({ kind: 'ad' });
  });

  it('caps stage rewards per day and the daily reward at once a day', () => {
    expect(decide({ ...base, stageClaimsToday: 4 })).toEqual({ kind: 'ad' });
    expect(decide({ ...base, stageClaimsToday: 5 })).toEqual({ kind: 'none', reason: 'limit' });
    expect(decide({ ...base, placement: 'daily', stageClaimsToday: 5 })).toEqual({ kind: 'ad' });
    expect(decide({ ...base, placement: 'daily', dailyClaimedToday: true })).toEqual({ kind: 'none', reason: 'limit' });
  });

  it('never stacks two full-screen ads (global lock)', () => {
    expect(decide({ ...base, showing: true })).toEqual({ kind: 'none', reason: 'busy' });
  });
});
