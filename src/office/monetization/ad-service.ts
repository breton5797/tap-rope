/**
 * AdService (monetization spec §3, AD_MONETIZATION §5): rewarded ad lifecycle idle → loading → ready → showing →
 * closed / failed, with a bounded retry, a stale-ad reload and one global full-screen lock. Every SDK error ends in
 * 'unavailable' — the game never waits on an ad.
 */
import type { AdAdapter } from './adapters/types';

export type AdState = 'idle' | 'loading' | 'ready' | 'showing' | 'closed' | 'failed';
export type ShowResult = 'rewarded' | 'skipped' | 'unavailable';

/** a loaded ad older than this is reloaded first (AdMob ads expire after about an hour) */
export const STALE_MS = 55 * 60 * 1000;
/** extra load attempts after the first failure */
const RETRIES = 2;
const BACKOFF_MS = [2000, 6000] as const;

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
  private canRequest = false;
  private loadedAt = 0;
  private inflight: Promise<void> | null = null;

  constructor(private readonly adapter: AdAdapter, private readonly deps: AdServiceDeps = realDeps) {}

  get showing(): boolean {
    return this.state === 'showing';
  }

  get canRequestAds(): boolean {
    return this.canRequest;
  }

  async init(): Promise<boolean> {
    try {
      this.canRequest = (await this.adapter.init()).canRequestAds;
    } catch {
      this.canRequest = false;
    }
    return this.canRequest;
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

  /** load ahead of the offer; safe to call often (one load at a time, nothing without consent) */
  preload(): Promise<void> {
    if (!this.canRequest || this.showing) return Promise.resolve();
    if (this.state === 'ready' && !this.stale()) return Promise.resolve();
    if (!this.inflight) {
      this.inflight = this.loadWithRetry(RETRIES).finally(() => {
        this.inflight = null;
      });
    }
    return this.inflight;
  }

  private stale(): boolean {
    return this.deps.now() - this.loadedAt > STALE_MS;
  }

  /** show a rewarded ad the player chose to watch */
  async showRewarded(): Promise<ShowResult> {
    if (!this.canRequest || this.showing) return 'unavailable';
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
      return (await this.adapter.show()) ? 'rewarded' : 'skipped';
    } catch {
      return 'unavailable';
    } finally {
      this.state = 'closed';
    }
  }

  privacyOptions(): Promise<void> {
    return this.adapter.privacyOptions().catch(() => undefined);
  }
}
