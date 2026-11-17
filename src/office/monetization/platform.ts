/**
 * Where the ad / purchase adapters come from. Web office build: no ads and no purchases (the web game stays
 * ad-free; H5 ad networks need an approval gate). Only in a dev build does `?monetization=test` turn on the
 * scripted test adapters. The app build swaps this module for ./platform.app.ts (build/app-swaps.ts).
 */
import type { AdAdapter, PassAdapter } from './adapters/types';
import { testAdaptersFromQuery } from './adapters/test';

export interface MonetizationPlatform {
  readonly ads: AdAdapter | null;
  readonly pass: PassAdapter | null;
  /** remote config JSON, null = local defaults only */
  readonly configUrl: string | null;
}

/** the scripted adapters exist only in dev builds (a shipped web build can't fake a 칼퇴 패스 — review M4) */
export function testAdaptersAllowed(env: { readonly DEV: boolean }): boolean {
  return env.DEV;
}

export function monetizationPlatform(): MonetizationPlatform {
  const test = typeof location === 'undefined' || !testAdaptersAllowed(import.meta.env) ? null : testAdaptersFromQuery(location.search);
  return test ? { ...test, configUrl: null } : { ads: null, pass: null, configUrl: null };
}
