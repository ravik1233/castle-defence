/**
 * Advertising.
 *
 * Rules the game holds itself to:
 *   - never interrupt a battle
 *   - interstitials only between levels, and never twice inside 90 seconds
 *   - rewarded video is always opt-in and always pays out
 *   - the Crown Pack turns all of it off, forever, with no server check
 *
 * The web build uses a stub that simulates the ad break so the pacing can be
 * felt while testing; on device the adapter talks to AdMob via the Capacitor
 * community plugin (see docs/STORE.md).
 */
import { profile } from './profile';

export type AdPlacement = 'level_complete' | 'level_failed';

export interface AdAdapter {
  init(): Promise<void>;
  showInterstitial(placement: AdPlacement): Promise<boolean>;
  showRewarded(): Promise<boolean>;
}

const MIN_SECONDS_BETWEEN_INTERSTITIALS = 90;
/** Battles finished before the first interstitial is allowed. */
const GRACE_BATTLES = 3;

class StubAds implements AdAdapter {
  async init(): Promise<void> {
    /* nothing to warm up */
  }

  async showInterstitial(): Promise<boolean> {
    return true;
  }

  async showRewarded(): Promise<boolean> {
    // Dev builds always "watch" the video so the reward path is testable.
    return true;
  }
}

class AdMobAds implements AdAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get plugin(): any {
    return (globalThis as unknown as { AdMob?: unknown }).AdMob;
  }

  async init(): Promise<void> {
    try {
      await this.plugin?.initialize?.({ initializeForTesting: import.meta.env.DEV });
    } catch {
      /* ads are never load-bearing */
    }
  }

  async showInterstitial(): Promise<boolean> {
    try {
      await this.plugin?.prepareInterstitial?.({ adId: AD_UNITS.interstitial });
      await this.plugin?.showInterstitial?.();
      return true;
    } catch {
      return false;
    }
  }

  async showRewarded(): Promise<boolean> {
    try {
      await this.plugin?.prepareRewardVideoAd?.({ adId: AD_UNITS.rewarded });
      const result = await this.plugin?.showRewardVideoAd?.();
      return Boolean(result);
    } catch {
      return false;
    }
  }
}

/** Replace with real unit ids before shipping; see docs/STORE.md. */
export const AD_UNITS = {
  interstitial: 'ca-app-pub-3940256099942544/1033173712',
  rewarded: 'ca-app-pub-3940256099942544/5224354917',
} as const;

export class AdService {
  private lastInterstitial = 0;
  private battlesFinished = 0;
  private ready = false;

  constructor(private readonly adapter: AdAdapter) {}

  async init(): Promise<void> {
    if (this.ready) return;
    await this.adapter.init();
    this.ready = true;
  }

  /** True when an interstitial is allowed right now. */
  canShowInterstitial(): boolean {
    if (!profile.showAds) return false;
    if (this.battlesFinished < GRACE_BATTLES) return false;
    return (Date.now() - this.lastInterstitial) / 1000 >= MIN_SECONDS_BETWEEN_INTERSTITIALS;
  }

  noteBattleFinished(): void {
    this.battlesFinished += 1;
  }

  async maybeInterstitial(placement: AdPlacement): Promise<boolean> {
    if (!this.canShowInterstitial()) return false;
    this.lastInterstitial = Date.now();
    return this.adapter.showInterstitial(placement);
  }

  /** Rewarded video is offered, never forced; returns true when it paid out. */
  async rewarded(): Promise<boolean> {
    if (!profile.showAds) return true;
    return this.adapter.showRewarded();
  }
}

function pickAdapter(): AdAdapter {
  const isNative = Boolean(
    (globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      ?.isNativePlatform?.(),
  );
  return isNative ? new AdMobAds() : new StubAds();
}

export const ads = new AdService(pickAdapter());
