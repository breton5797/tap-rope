/**
 * AdMob rewarded adapter (app build only; monetization spec §3–4). Family title: every request is child-directed,
 * under the age of consent and rated General; no App Tracking Transparency prompt. Consent (UMP) runs before the
 * SDK starts and ads are requested only when `canRequestAds`. The reward counts only when the SDK's reward callback settles the show.
 * Ad unit ids come from the build env; without them Google's public test units are used (and marked testing).
 */
import { AdMob, AdmobConsentStatus, MaxAdContentRating } from '@capacitor-community/admob';
import { rewardOutcome } from './reward-outcome';
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
      // UMP first; the Mobile Ads SDK starts only when consent allows requests (Google UMP guidance)
      let info = await AdMob.requestConsentInfo({ tagForUnderAgeOfConsent: true });
      if (info.status === AdmobConsentStatus.REQUIRED && info.isConsentFormAvailable) info = await AdMob.showConsentForm();
      if (info.canRequestAds) {
        await AdMob.initialize({
          tagForChildDirectedTreatment: true,
          tagForUnderAgeOfConsent: true,
          maxAdContentRating: MaxAdContentRating.General,
          initializeForTesting: unit.testing,
        });
      }
      return {
        canRequestAds: info.canRequestAds,
        privacyOptionsRequired: String(info.privacyOptionsRequirementStatus) === 'REQUIRED', // the enum is not exported by the package
      };
    },
    async load() {
      await AdMob.prepareRewardVideoAd({ adId: unit.id, isTesting: unit.testing });
    },
    // resolves on the SDK's reward callback; REWARDED_AD_CANCELLED = closed before it (verified on Android 2026-11-18)
    show: () =>
      AdMob.showRewardVideoAd().then(
        () => rewardOutcome({ ok: true }),
        (error: unknown) => rewardOutcome({ ok: false, error }),
      ),
    privacyOptions: () => AdMob.showPrivacyOptionsForm(),
  };
}
