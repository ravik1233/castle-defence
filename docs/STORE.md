# Publishing to Google Play and the App Store

The game is a static web build hosted inside a Capacitor WebView. Nothing about
the gameplay changes between the web and native builds; only purchases and ads
switch from their browser stubs to real platform SDKs.

## 1. Build the native projects

```bash
npm install
npm run build
npx cap add android         # once
npx cap add ios             # once, on a Mac with Xcode
npm run cap:sync            # after every web change
```

`npm run cap:android` and `npm run cap:ios` build, sync and open the IDE.

`android/` and `ios/` are gitignored: they are generated, and regenerating them
is one command. If you start hand-editing native code, commit them.

### App icons and splash

Artwork is generated from `src/art/icons.ts` into `resources/`:

```bash
npm run dev &                    # the generator renders through the browser
node scripts/gen-icons.mjs
npx @capacitor/assets generate   # fans resources/ out to every platform size
```

### Lock to portrait

The game is portrait-only.

- **Android** — `android/app/src/main/AndroidManifest.xml`, on the activity:
  `android:screenOrientation="portrait"`
- **iOS** — Xcode target → General → Deployment Info → Device Orientation:
  Portrait only

## 2. The one product

| | |
| --- | --- |
| Product ID | `com.lastgate.crownpack` |
| Type | Non-consumable / one-time managed product |
| Price | $4.99 (tier 5) |
| Title | The Crown Pack |

Description to paste into both stores:

> Removes every ad, permanently. Unlocks Chapter 4: Throne of the Demon King
> (8 levels), three exclusive defenders — Paladin, Pyromancer and Warding
> Brazier — the hero Seraphina the Stormcaller, and all three castle skins.
> One purchase, no subscriptions, no loot boxes.

Create it in **Play Console → Monetise → In-app products** and in **App Store
Connect → Features → In-App Purchases**, using that exact product id.

### Wiring the purchase

`src/systems/iap.ts` already contains the adapter. Install the plugin:

```bash
npm i cordova-plugin-purchase
npx cap sync
```

The `NativeStore` class talks to `window.CdvPurchase`. Before shipping,
register the product at startup (add to `src/main.ts`, inside a native guard):

```ts
const { store, ProductType, Platform } = window.CdvPurchase;
store.register([{
  id: 'com.lastgate.crownpack',
  type: ProductType.NON_CONSUMABLE,
  platform: Platform.GOOGLE_PLAY, // and APPLE_APPSTORE on iOS
}]);
store.initialize();
```

Receipt validation: for a single non-consumable with no server component,
platform-side validation through the plugin is sufficient. If you later add a
server, point `store.validator` at it — `NativeStore.purchase()` already waits
for the `verified` callback before granting the pack.

**Restore** is required by both stores and is already wired to the button on the
store screen.

### What the web build does

In a browser there is no store, so `MockStore` grants the pack locally and the
button reads `TEST BUILD - FREE`. That is deliberate: the web build exists for
testing. Do not publish the web build as the product.

## 3. Ads

`src/systems/ads.ts` holds the policy, and it is deliberately restrained:

- never during a battle
- interstitials only on the results screen, never before the 4th battle of a
  session, and never twice within 90 seconds
- rewarded video is opt-in and always pays out
- the Crown Pack disables all of it locally, with no server check

To turn them on:

```bash
npm i @capacitor-community/admob
npx cap sync
```

Replace the test ids in `AD_UNITS` (`src/systems/ads.ts`) with your real AdMob
unit ids, and add your AdMob app id to the platform manifests as the plugin's
README describes. Leaving the test ids in place is safe — they serve test ads —
but it also means zero revenue, so this is a release checklist item.

Both stores require a privacy policy URL when you ship ads or IAP, plus the
data-safety / privacy-nutrition-label questionnaire. The game itself collects
nothing: progress lives in `localStorage` on the device and never leaves it.

## 4. Store listing

- **Name**: The Last Gate
- **Short description**: Hold the wall against the Demon King. If the gate
  falls, so does everything behind it.
- **Category**: Games → Strategy
- **Content rating**: fantasy violence, no blood effects beyond stylised
  bursts; expect PEGI 7 / ESRB Everyone 10+
- **Screenshots**: run `node scripts/shot.mjs "/?scene=Battle&level=c3l6&unlock=1" store-1.png 1080 1920 25000 --viewport`
  and vary the level; both stores want at least 2 phone screenshots

## 5. Release checklist

- [ ] `npm test` and `npm run smoke` pass
- [ ] `npm run build` (not `build:qa` — QA builds ship debug hooks)
- [ ] Real AdMob unit ids in `src/systems/ads.ts`
- [ ] IAP product live in both consoles with id `com.lastgate.crownpack`
- [ ] Purchase and restore tested on a real device with a test account
- [ ] Portrait lock confirmed on both platforms
- [ ] Version bumped in `package.json`, `android/app/build.gradle`, Xcode target
- [ ] Privacy policy URL live and linked in both listings
- [ ] Self-host the UI font (see below) so the game looks right offline

### Self-hosting the font

`index.html` loads Fredoka from Google Fonts, with a system fallback if the
network is unavailable. For a packaged app, download the woff2, drop it in
`public/fonts/`, and replace the `<link>` with an `@font-face` rule so the game
never depends on the network.
