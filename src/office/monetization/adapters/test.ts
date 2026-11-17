/**
 * TestAdAdapter / TestPassAdapter (AD_MONETIZATION §5: development and automated tests never touch real ads):
 * scripted outcomes for vitest and the e2e run (`?monetization=test` on the web office build).
 */
import type { AdAdapter, BuyResult, PassAdapter } from './types';

export interface TestAdScript {
  readonly consent?: boolean;
  readonly load?: 'ok' | 'fail';
  readonly show?: 'reward' | 'skip' | 'fail';
}

export function createTestAds(s: TestAdScript): AdAdapter {
  return {
    init: async () => ({ canRequestAds: s.consent ?? true }),
    load: async () => {
      if (s.load === 'fail') throw new Error('test: no fill');
    },
    show: async () => {
      if (s.show === 'fail') throw new Error('test: cannot show');
      return s.show !== 'skip';
    },
    privacyOptions: async () => undefined,
  };
}

export interface TestPassScript {
  readonly owned?: boolean;
  readonly buy?: BuyResult;
  /** the store price, null = the store could not be reached */
  readonly price?: string | null;
}

export function createTestPass(s: TestPassScript): PassAdapter {
  let owned = s.owned ?? false;
  return {
    owned: async () => owned,
    price: async () => (s.price === undefined ? '₩3,300' : s.price),
    buy: async () => {
      const r = s.buy ?? 'bought';
      if (r === 'bought') owned = true;
      return r;
    },
    restore: async () => owned,
  };
}

/** e2e: `?monetization=test[&ads=skip|fail|nofill|noconsent][&pass=1]` */
export function testAdaptersFromQuery(search: string): { ads: AdAdapter; pass: PassAdapter } | null {
  const q = new URLSearchParams(search);
  if (q.get('monetization') !== 'test') return null;
  const ads = q.get('ads');
  return {
    ads: createTestAds({
      consent: ads !== 'noconsent',
      load: ads === 'nofill' ? 'fail' : 'ok',
      show: ads === 'skip' ? 'skip' : ads === 'fail' ? 'fail' : 'reward',
    }),
    pass: createTestPass({ owned: q.get('pass') === '1' }),
  };
}
