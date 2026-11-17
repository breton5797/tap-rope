import { describe, expect, it } from 'vitest';
import { PASS_PRODUCT_ID, buyErrorKind, passState } from '../../src/office/monetization/pass-state';
import { rewardOutcome } from '../../src/office/monetization/adapters/reward-outcome';

const tx = (over: Record<string, unknown>) => ({ transactionId: 't', productIdentifier: PASS_PRODUCT_ID, purchaseDate: '2026-11-18T00:00:00Z', ...over });

describe('pass ownership from store transactions', () => {
  it('iOS: a current entitlement for the pass owns it', () => {
    expect(passState([tx({})], 'ios')).toBe('owned');
  });

  it('Android: only purchaseState "1" (PURCHASED) owns it; "2" (PENDING) is pending', () => {
    expect(passState([tx({ purchaseState: '1' })], 'android')).toBe('owned');
    expect(passState([tx({ purchaseState: '2' })], 'android')).toBe('pending');
    expect(passState([tx({ purchaseState: '0' })], 'android')).toBe('none');
    expect(passState([tx({})], 'android')).toBe('none');
  });

  it('ignores other products and empty lists', () => {
    expect(passState([tx({ productIdentifier: 'other' })], 'ios')).toBe('none');
    expect(passState([], 'ios')).toBe('none');
  });

  it('classifies purchase rejections by the plugin\'s real codes / messages', () => {
    expect(buyErrorKind({ message: 'Transaction pending' })).toBe('pending');
    expect(buyErrorKind({ message: 'Purchase is pending' })).toBe('pending');
    expect(buyErrorKind({ message: 'User cancelled' })).toBe('cancelled');
    expect(buyErrorKind({ message: 'Purchase is not purchased', code: 'USER_CANCELED' })).toBe('cancelled');
    expect(buyErrorKind({ message: 'Purchase is not purchased', code: 'ITEM_ALREADY_OWNED' })).toBe('owned');
    expect(buyErrorKind({ message: 'BILLING_SETUP_FAILED' })).toBe('failed');
    expect(buyErrorKind('weird')).toBe('failed');
  });
});

describe('rewarded show outcome', () => {
  it('a resolved show is the reward; a dismissal before the reward is skipped; anything else fails', () => {
    expect(rewardOutcome({ ok: true })).toBe(true);
    expect(rewardOutcome({ ok: false, error: { code: 'REWARDED_AD_CANCELLED' } })).toBe(false);
    expect(() => rewardOutcome({ ok: false, error: { code: 'REWARDED_AD_SHOW_FAILED' } })).toThrow();
    expect(() => rewardOutcome({ ok: false, error: new Error('x') })).toThrow();
  });
});
