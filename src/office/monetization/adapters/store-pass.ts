/**
 * 칼퇴 패스 through StoreKit 2 / Play Billing 7 (@capgo/native-purchases; app build only). Non-consumable: Android
 * purchases are acknowledged by the plugin (autoAcknowledgePurchases default) so Play does not refund them.
 */
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { PASS_PRODUCT_ID, passState } from '../pass-state';
import type { BuyResult, PassAdapter } from './types';

const isCancel = (e: unknown): boolean => /cancel/i.test(e instanceof Error ? e.message : String(e));

export function createStorePassAdapter(platform: 'ios' | 'android'): PassAdapter {
  const owned = async (): Promise<boolean | null> => {
    try {
      const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP, onlyCurrentEntitlements: true });
      return passState(purchases, platform) === 'owned';
    } catch {
      return null;
    }
  };
  return {
    owned,
    async price() {
      try {
        const { product } = await NativePurchases.getProduct({ productIdentifier: PASS_PRODUCT_ID, productType: PURCHASE_TYPE.INAPP });
        return product.priceString ?? null;
      } catch {
        return null;
      }
    },
    async buy(): Promise<BuyResult> {
      try {
        const tx = await NativePurchases.purchaseProduct({ productIdentifier: PASS_PRODUCT_ID, productType: PURCHASE_TYPE.INAPP, quantity: 1 });
        const state = passState([tx], platform);
        return state === 'owned' ? 'bought' : state === 'pending' ? 'pending' : 'failed';
      } catch (e) {
        return isCancel(e) ? 'cancelled' : 'failed';
      }
    },
    async restore() {
      try {
        await NativePurchases.restorePurchases();
      } catch {
        /* still read what the store reports */
      }
      return (await owned()) === true;
    },
  };
}
