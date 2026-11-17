/** 칼퇴 패스 ownership from store transactions (pure; the native adapter feeds it) */

/** the non-consumable product id in App Store Connect and Play Console */
export const PASS_PRODUCT_ID = 'kaltoe.pass';

export interface PassTransaction {
  readonly productIdentifier: string;
  /** Android only: "1" purchased, "0" pending */
  readonly purchaseState?: string;
}

export type PassState = 'owned' | 'pending' | 'none';

export function passState(txs: readonly PassTransaction[], platform: 'ios' | 'android'): PassState {
  const mine = txs.filter((t) => t.productIdentifier === PASS_PRODUCT_ID);
  if (platform === 'ios') return mine.length > 0 ? 'owned' : 'none';
  if (mine.some((t) => t.purchaseState === '1')) return 'owned';
  return mine.some((t) => t.purchaseState === '0') ? 'pending' : 'none';
}
