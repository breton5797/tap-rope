/** 칼퇴 패스 ownership from store transactions (pure; the native adapter feeds it) */

/** the non-consumable product id in App Store Connect and Play Console */
export const PASS_PRODUCT_ID = 'kaltoe.pass';

export interface PassTransaction {
  readonly productIdentifier: string;
  /** Android only: "1" PURCHASED, "2" PENDING (Play Billing PurchaseState; "0" is UNSPECIFIED) */
  readonly purchaseState?: string;
}

export type PassState = 'owned' | 'pending' | 'none';

export function passState(txs: readonly PassTransaction[], platform: 'ios' | 'android'): PassState {
  const mine = txs.filter((t) => t.productIdentifier === PASS_PRODUCT_ID);
  if (platform === 'ios') return mine.length > 0 ? 'owned' : 'none';
  if (mine.some((t) => t.purchaseState === '1')) return 'owned';
  return mine.some((t) => t.purchaseState === '2') ? 'pending' : 'none';
}

export type BuyErrorKind = 'pending' | 'cancelled' | 'owned' | 'failed';

/**
 * a purchase rejection from @capgo/native-purchases 8.9 → what happened. The plugin rejects (never resolves)
 * pending payments ("Transaction pending" iOS / "Purchase is pending" Android, e.g. Ask to Buy) and cancels
 * ("User cancelled" iOS / code USER_CANCELED Android); ITEM_ALREADY_OWNED means the store already has it.
 */
export function buyErrorKind(e: unknown): BuyErrorKind {
  const o = (typeof e === 'object' && e !== null ? e : {}) as { message?: unknown; code?: unknown };
  const msg = typeof o.message === 'string' ? o.message : '';
  const code = typeof o.code === 'string' ? o.code : '';
  if (/pending/i.test(msg)) return 'pending';
  if (code === 'USER_CANCELED' || /cancel/i.test(msg)) return 'cancelled';
  if (code === 'ITEM_ALREADY_OWNED') return 'owned';
  return 'failed';
}
