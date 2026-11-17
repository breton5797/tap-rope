/**
 * 칼퇴 패스 through StoreKit 2 / Play Billing 7 (@capgo/native-purchases 8.9; app build only). Non-consumable.
 * - Pending payments (Ask to Buy, cash) and cancels come back as rejections: classified by buyErrorKind.
 * - Android: a purchase completed outside the app (a pending one approved later) is only acknowledged by
 *   restorePurchases (processUnfinishedPurchases); unacknowledged purchases are refunded by Play after 3 days,
 *   so every ownership check on Android runs it first (silent there; on iOS restore = AppStore.sync, which may
 *   ask the player to sign in, so iOS uses it only on the 구매 복원 button).
 */
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { PASS_PRODUCT_ID, buyErrorKind, passState } from '../pass-state';
import type { BuyResult, PassAdapter } from './types';

export function createStorePassAdapter(platform: 'ios' | 'android'): PassAdapter {
  const query = async (): Promise<boolean | null> => {
    try {
      const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP, onlyCurrentEntitlements: true });
      return passState(purchases, platform) === 'owned';
    } catch {
      return null;
    }
  };
  const acknowledge = async (): Promise<void> => {
    try {
      await NativePurchases.restorePurchases();
    } catch {
      /* still read what the store reports */
    }
  };
  const owned = async (): Promise<boolean | null> => {
    if (platform === 'android') await acknowledge();
    return query();
  };
  return {
    owned,
    async price() {
      try {
        const { product } = await NativePurchases.getProduct({ productIdentifier: PASS_PRODUCT_ID, productType: PURCHASE_TYPE.INAPP });
        return product.priceString || null;
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
        const kind = buyErrorKind(e);
        if (kind === 'owned') return (await owned()) === true ? 'bought' : 'failed';
        return kind;
      }
    },
    async restore() {
      await acknowledge();
      return query();
    },
  };
}
