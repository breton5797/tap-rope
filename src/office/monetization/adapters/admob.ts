/**
 * AdMob rewarded adapter (app build only; monetization spec §3–4). Family title: every request is child-directed,
 * under the age of consent and rated General; no App Tracking Transparency prompt. Consent (UMP) runs before the
 * SDK starts and ads are requested only when `canRequestAds`. The reward counts only from the SDK's Rewarded event.
 * Ad unit ids come from the build env; without them Google's public test units are used (and marked testing).
 */
import { AdMob, AdmobConsentStatus, MaxAdContentRating, RewardAdPluginEvents } from '@capacitor-community/admob';
import type { PluginListenerHandle } from '@capacitor/core';
import type { AdAdapter } from './types';

/** Google's public rewarded test units (developers.google.com/admob/{ios,android}/test-ads) */
export const TEST_REWARDED = { ios: 'ca-app-pub-3940256099942544/1712485313', android: 'ca-app-pub-3940256099942544/5224354917' } as const;

export interface AdmobUnits {
  readonly ios: string;
  readonly android: string;
}

export function rewardedUnit(platform: 'ios' | 'android', env: Partial<AdmobUnits>): { readonly id: string; readonly testing: boolean } {
  const prod = env[platform];
  return prod ? { id: prod, testing: false } : { id: TEST_REWARDED[platform], testing: true };
}

export function createAdmobAdapter(platform: 'ios' | 'android', env: Partial<AdmobUnits>): AdAdapter {
  const unit = rewardedUnit(platform, env);
  return {
    async init() {
      let info = await AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: true });
      if (info.status === AdmobConsentStatus.REQUIRED && info.isConsentFormAvailable) info = await AdMob.showConsentForm();
      await AdMob.initialize({
        tagForChildDirectedTreatment: true,
        tagForUnderAgeOfConsent: true,
        maxAdContentRating: MaxAdContentRating.General,
        initializeForTesting: unit.testing,
      });
      return { canRequestAds: info.canRequestAds };
    },
    async load() {
      await AdMob.prepareRewardVideoAd({ adId: unit.id, isTesting: unit.testing });
    },
    show() {
      return new Promise<boolean>((resolve, reject) => {
        let earned = false;
        const handles: Array<Promise<PluginListenerHandle>> = [];
        const done = (fn: () => void): void => {
          for (const h of handles) void h.then((x) => x.remove());
          fn();
        };
        handles.push(AdMob.addListener(RewardAdPluginEvents.Rewarded, () => { earned = true; }));
        handles.push(AdMob.addListener(RewardAdPluginEvents.Dismissed, () => done(() => resolve(earned))));
        handles.push(AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => done(() => reject(new Error('admob: failed to show')))));
        AdMob.showRewardVideoAd().catch((e: unknown) => done(() => reject(e instanceof Error ? e : new Error('admob: show rejected'))));
      });
    },
    privacyOptions: () => AdMob.showPrivacyOptionsForm(),
  };
}
