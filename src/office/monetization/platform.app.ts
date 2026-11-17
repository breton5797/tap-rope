/**
 * App build (vite --mode office-app) replacement for ./platform.ts: AdMob rewarded ads + the 칼퇴 패스 through the
 * platform store. Production ad unit ids come from VITE_ADMOB_REWARDED_IOS / VITE_ADMOB_REWARDED_ANDROID (not
 * secrets); without them the build uses Google's test units. The remote config is the JSON published with the
 * web office build on Pages.
 */
import { Capacitor } from '@capacitor/core';
import { createAdmobAdapter } from './adapters/admob';
import { createStorePassAdapter } from './adapters/store-pass';
import type { MonetizationPlatform } from './platform';

export type { MonetizationPlatform } from './platform';

export const REMOTE_CONFIG_URL = 'https://breton5797.github.io/tap-rope/office/monetization.json';

const env = (key: string): string | undefined => {
  const v: unknown = (import.meta.env as Record<string, unknown> | undefined)?.[key];
  return typeof v === 'string' && v.startsWith('ca-app-pub-') ? v : undefined;
};

/** the app never runs the scripted test adapters */
export function testAdaptersAllowed(_env?: { readonly DEV: boolean }): boolean {
  return false;
}

export function monetizationPlatform(): MonetizationPlatform {
  const p = Capacitor.getPlatform();
  if (p !== 'ios' && p !== 'android') return { ads: null, pass: null, configUrl: null };
  return {
    ads: createAdmobAdapter(p, { ios: env('VITE_ADMOB_REWARDED_IOS'), android: env('VITE_ADMOB_REWARDED_ANDROID') }),
    pass: createStorePassAdapter(p),
    configUrl: REMOTE_CONFIG_URL,
  };
}
