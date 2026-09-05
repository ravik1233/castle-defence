/**
 * In-app purchase: the one product this game sells.
 *
 * The game ships a single non-consumable, THE CROWN PACK, at $4.99. There is
 * no second currency, no loot box, no subscription, and nothing else is for
 * sale, by design.
 *
 * Platform wiring
 * ---------------
 * On the web build the purchase flow is mocked so the whole game is testable
 * in a browser. On device, `NativeStore` is filled in by the Capacitor
 * purchases plugin (see docs/STORE.md). The abstraction is deliberately thin:
 * a store adapter only has to produce a receipt-validated boolean.
 */
import { profile } from './profile';

export const CROWN_PACK_PRODUCT_ID = 'com.lastgate.crownpack';
export const CROWN_PACK_PRICE_USD = 4.99;

export interface StoreProduct {
  id: string;
  title: string;
  description: string;
  /** Localised price string from the store, e.g. "$4.99" or "₹399". */
  priceLabel: string;
}

export type PurchaseResult =
  | { status: 'purchased' }
  | { status: 'restored' }
  | { status: 'cancelled' }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; reason: string };

export interface StoreAdapter {
  ready(): Promise<boolean>;
  product(): Promise<StoreProduct>;
  purchase(): Promise<PurchaseResult>;
  restore(): Promise<PurchaseResult>;
}

const FALLBACK_PRODUCT: StoreProduct = {
  id: CROWN_PACK_PRODUCT_ID,
  title: 'The Crown Pack',
  description:
    'Removes all ads forever, unlocks the Throne of the Demon King chapter, ' +
    'three exclusive defenders, the hero Seraphina, and every castle skin.',
  priceLabel: `$${CROWN_PACK_PRICE_USD.toFixed(2)}`,
};

/**
 * Browser adapter. There is no store outside the app, so this grants the pack
 * locally and says so plainly on the button - the web build exists to test the
 * game, and the real purchase only happens through Google Play or the App
 * Store on device.
 */
class MockStore implements StoreAdapter {
  async ready(): Promise<boolean> {
    return true;
  }

  async product(): Promise<StoreProduct> {
    return { ...FALLBACK_PRODUCT, priceLabel: 'TEST BUILD - FREE' };
  }

  async purchase(): Promise<PurchaseResult> {
    profile.grantCrownPack();
    return { status: 'purchased' };
  }

  async restore(): Promise<PurchaseResult> {
    return profile.hasCrownPack ? { status: 'restored' } : { status: 'cancelled' };
  }
}

/**
 * Device adapter. Talks to whatever purchases plugin is installed on
 * `window.CdvPurchase` (cordova-plugin-purchase, which Capacitor loads).
 * Kept defensive: any failure degrades to "unavailable" rather than throwing
 * a player into a broken screen.
 */
class NativeStore implements StoreAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get api(): any {
    return (globalThis as unknown as { CdvPurchase?: unknown }).CdvPurchase;
  }

  async ready(): Promise<boolean> {
    return Boolean(this.api);
  }

  async product(): Promise<StoreProduct> {
    try {
      const store = this.api?.store;
      const p = store?.get?.(CROWN_PACK_PRODUCT_ID);
      const price = p?.pricing?.price ?? p?.price;
      if (price) return { ...FALLBACK_PRODUCT, priceLabel: String(price) };
    } catch {
      /* fall through to the default label */
    }
    return FALLBACK_PRODUCT;
  }

  async purchase(): Promise<PurchaseResult> {
    const store = this.api?.store;
    if (!store) return { status: 'unavailable', reason: 'store plugin missing' };
    return new Promise<PurchaseResult>((resolve) => {
      let settled = false;
      const done = (r: PurchaseResult): void => {
        if (settled) return;
        settled = true;
        resolve(r);
      };
      try {
        const product = store.get(CROWN_PACK_PRODUCT_ID);
        if (!product) {
          done({ status: 'unavailable', reason: 'product not found in store' });
          return;
        }
        store.when().approved((t: { verify: () => void }) => t.verify());
        store.when().verified((receipt: { finish: () => void }) => {
          receipt.finish();
          profile.grantCrownPack();
          done({ status: 'purchased' });
        });
        store.when().cancelled(() => done({ status: 'cancelled' }));
        store.when().error((e: { message?: string }) =>
          done({ status: 'error', reason: e?.message ?? 'purchase failed' }),
        );
        void product.getOffer()?.order();
      } catch (e) {
        done({ status: 'error', reason: e instanceof Error ? e.message : 'purchase failed' });
      }
      // Never leave the UI spinning forever.
      setTimeout(() => done({ status: 'cancelled' }), 120000);
    });
  }

  async restore(): Promise<PurchaseResult> {
    const store = this.api?.store;
    if (!store) return { status: 'unavailable', reason: 'store plugin missing' };
    try {
      await store.restorePurchases();
      // The verified handler above grants the pack when a receipt comes back.
      return profile.hasCrownPack ? { status: 'restored' } : { status: 'cancelled' };
    } catch (e) {
      return { status: 'error', reason: e instanceof Error ? e.message : 'restore failed' };
    }
  }
}

function pickAdapter(): StoreAdapter {
  return isNativePlatform() ? new NativeStore() : new MockStore();
}

function isNativePlatform(): boolean {
  return Boolean(
    (globalThis as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      ?.isNativePlatform?.(),
  );
}

export const store: StoreAdapter = pickAdapter();

/** True in the browser build, where purchases are simulated locally. */
export function isWebTestBuild(): boolean {
  return !isNativePlatform();
}

/** What the Crown Pack gives, shown verbatim on the store screen. */
export const CROWN_PACK_BENEFITS = [
  'Removes every ad, permanently',
  'Chapter 4: Throne of the Demon King (8 levels)',
  'Three exclusive defenders: Paladin, Pyromancer, Warding Brazier',
  'Second hero: Seraphina the Stormcaller',
  'All three castle skins',
] as const;
