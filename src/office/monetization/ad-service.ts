/**
 * AdService (monetization spec §3, AD_MONETIZATION §5): rewarded ad lifecycle idle → loading → ready → showing →
 * closed / failed, with a bounded retry, a stale-ad reload and one global lock over loading + showing.
 * The SDK is started lazily — consent, then initialize, then load — on the first request, i.e. when the player
 * taps a bonus (security review H1: nothing reaches the ad network for players who never choose an ad).
 * Every SDK error ends in 'unavailable' — the game never waits on an ad.
 */
import type { AdAdapter } from './adapters/types';

export type AdState = 'idle' | 'loading' | 'ready' | 'showing' | 'closed' | 'failed';
export type ShowResult = 'rewarded' | 'skipped' | 'unavailable';

/** a loaded ad older than this is reloaded first (AdMob ads expire after about an hour) */
export const STALE_MS = 55 * 60 * 1000;
/** extra load attempts after the first failure (preload only) */
const RETRIES = 2;
const BACKOFF_MS = [2000, 6000] as const;
/** longest wait for an ad to close after its reward (a lost dismiss event must not lock ads for the session) */
const CLOSE_WAIT_MS = 120_000;

export interface AdServiceDeps {
  readonly sleep: (ms: number) => Promise<void>;
  readonly now: () => number;
}

const realDeps: AdServiceDeps = {
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  now: () => Date.now(),
};

export class AdService {
  state: AdState = 'idle';
  /** null until the SDK was started (consent not asked yet) */
  private canRequest: boolean | null = null;
  private privacyRequired = false;
  private loadedAt = 0;
  private inflight: Promise<void> | null = null;
  private starting: Promise<boolean> | null = null;
  /** a claim is between its tap and the ad closing (loading or showing) */
  private busy = false;
  private closed: Promise<void> = Promise.resolve();

  constructor(private readonly adapter: AdAdapter, private readonly deps: AdServiceDeps = realDeps) {}

  get showing(): boolean {
    return this.busy || this.state === 'showing';
  }

  get canRequestAds(): boolean | null {
    return this.canRequest;
  }

  /** the consent SDK asks for a way back into the privacy choices */
  get privacyOptionsRequired(): boolean {
    return this.privacyRequired;
  }

  /** consent + SDK start (once); false when ads may not be requested */
  init(): Promise<boolean> {
    this.starting ??= (async () => {
      try {
        const r = await this.adapter.init();
        this.canRequest = r.canRequestAds;
        this.privacyRequired = r.privacyOptionsRequired === true;
      } catch {
        // could not start (offline, SDK error): no ads now, but the next tap may try again
        this.canRequest = null;
        this.starting = null;
        return false;
      }
      return this.canRequest === true;
    })();
    return this.starting;
  }

  private async loadOnce(): Promise<boolean> {
    try {
      await this.adapter.load();
      this.loadedAt = this.deps.now();
      this.state = 'ready';
      return true;
    } catch {
      return false;
    }
  }

  private async loadWithRetry(retries: number): Promise<void> {
    this.state = 'loading';
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      if (attempt > 0) await this.deps.sleep(BACKOFF_MS[attempt - 1] ?? 6000);
      if (await this.loadOnce()) return;
    }
    this.state = 'failed';
  }

  /** load the next ad ahead of time — only once the SDK was started by a player's choice */
  preload(): Promise<void> {
    if (this.canRequest !== true || this.showing) return Promise.resolve();
    if (this.state === 'ready' && !this.stale()) return Promise.resolve();
    this.inflight ??= this.loadWithRetry(RETRIES).finally(() => {
      this.inflight = null;
    });
    return this.inflight;
  }

  private stale(): boolean {
    return this.deps.now() - this.loadedAt > STALE_MS;
  }

  /** settles once no ad is on the screen (the reward can arrive while the ad is still up) */
  idle(): Promise<void> {
    return this.closed;
  }

  /** show a rewarded ad the player chose to watch (starts the SDK on first use) */
  async showRewarded(): Promise<ShowResult> {
    if (this.showing) return 'unavailable';
    this.busy = true;
    let release: () => void = () => undefined;
    this.closed = new Promise<void>((r) => { release = r; });
    let holdUntilClosed = false;
    try {
      if (!(await this.init())) return 'unavailable';
      if (this.inflight) await this.inflight;
      if (this.state !== 'ready' || this.stale()) {
        this.state = 'loading';
        if (!(await this.loadOnce())) {
          this.state = 'failed';
          return 'unavailable';
        }
      }
      this.state = 'showing';
      try {
        const rewarded = await this.adapter.show();
        if (rewarded && this.adapter.whenClosed) {
          // the reward came first; the lock stays until the ad is gone (at most CLOSE_WAIT_MS)
          holdUntilClosed = true;
          const done = (): void => {
            this.state = 'closed';
            this.busy = false;
            release();
          };
          void Promise.race([this.adapter.whenClosed().catch(() => undefined), new Promise<void>((r) => setTimeout(r, CLOSE_WAIT_MS))]).then(done);
        }
        return rewarded ? 'rewarded' : 'skipped';
      } catch {
        return 'unavailable';
      } finally {
        if (!holdUntilClosed) this.state = 'closed';
      }
    } finally {
      if (!holdUntilClosed) {
        this.busy = false;
        release();
      }
    }
  }

  /** the privacy choices form, then consent is read again (a withdrawn consent stops requests this session) */
  async privacyOptions(): Promise<void> {
    try {
      await this.adapter.privacyOptions();
    } catch {
      /* the form could not open */
    }
    this.starting = null;
    await this.init();
  }
}
