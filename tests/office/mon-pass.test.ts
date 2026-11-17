import { describe, expect, it } from 'vitest';
import { PASS_PRODUCT_ID, passState } from '../../src/office/monetization/pass-state';

const tx = (over: Record<string, unknown>) => ({ transactionId: 't', productIdentifier: PASS_PRODUCT_ID, purchaseDate: '2026-11-18T00:00:00Z', ...over });

describe('pass ownership from store transactions', () => {
  it('iOS: a current entitlement for the pass owns it', () => {
    expect(passState([tx({})], 'ios')).toBe('owned');
  });

  it('Android: only purchaseState "1" owns it; "0" is pending', () => {
    expect(passState([tx({ purchaseState: '1' })], 'android')).toBe('owned');
    expect(passState([tx({ purchaseState: '0' })], 'android')).toBe('pending');
    expect(passState([tx({ purchaseState: '2' })], 'android')).toBe('none');
    expect(passState([tx({})], 'android')).toBe('none');
  });

  it('ignores other products and empty lists', () => {
    expect(passState([tx({ productIdentifier: 'other' })], 'ios')).toBe('none');
    expect(passState([], 'ios')).toBe('none');
  });
});
