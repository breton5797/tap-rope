/** the seams between the game and a platform's ad / purchase SDK (monetization spec §3) */

export interface AdAdapter {
  /** consent flow (UMP on the app): may ads be requested? */
  init(): Promise<{ readonly canRequestAds: boolean; readonly privacyOptionsRequired?: boolean }>;
  /** load one rewarded ad; rejects on no fill / network / SDK errors */
  load(): Promise<void>;
  /** show the loaded ad: true only when the SDK's reward callback fired; rejects when it cannot show */
  show(): Promise<boolean>;
  /** re-open the consent / privacy choices */
  privacyOptions(): Promise<void>;
  /** after show(): settles when the ad is off the screen (the reward can come while it is still up) */
  whenClosed?(): Promise<void>;
}

export type BuyResult = 'bought' | 'cancelled' | 'pending' | 'failed';

export interface PassAdapter {
  /** does the store say this player owns the pass? null = the store could not be asked */
  owned(): Promise<boolean | null>;
  /** localized price ("₩3,300"), null when the product cannot be loaded */
  price(): Promise<string | null>;
  buy(): Promise<BuyResult>;
  /** restore purchases: true when the pass was found, null when the store could not be reached */
  restore(): Promise<boolean | null>;
}
