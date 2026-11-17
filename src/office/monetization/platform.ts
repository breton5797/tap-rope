/**
 * Where the ad / purchase adapters come from. Web office build: no ads and no purchases (the web game stays
 * ad-free; H5 ad networks need an approval gate). Only `?monetization=test` turns on the scripted test adapters,
 * for the e2e run. The app build swaps this module for ./platform.app.ts (build/app-swaps.ts).
 */
import type { AdAdapter, PassAdapter } from './adapters/types';
import { testAdaptersFromQuery } from './adapters/test';

export interface MonetizationPlatform {
  readonly ads: AdAdapter | null;
  readonly pass: PassAdapter | null;
  /** remote config JSON, null = local defaults only */
  readonly configUrl: string | null;
}

export function monetizationPlatform(): MonetizationPlatform {
  const test = typeof location === 'undefined' ? null : testAdaptersFromQuery(location.search);
  return test ? { ...test, configUrl: null } : { ads: null, pass: null, configUrl: null };
}
