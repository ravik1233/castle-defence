# Shipping on Android

Android only. There is no iOS target in this project — no Xcode, no
`@capacitor/ios`, nothing to maintain for a platform you are not shipping to.
If that changes later it is one `npx cap add ios` away.

Two ways to put this on a phone. Do them in this order.

---

## 1. Install it from the browser (free, instant)

The game is a full PWA: manifest, service worker, maskable icons, portrait
lock, fullscreen display. On Android, Chrome will offer to install it, and the
installed game runs with no URL bar, no browser chrome, and works offline.

On the phone: open the site in Chrome → menu → **Install app** (or take the
in-game prompt on the main menu). It lands on the home screen with its own
icon and launches fullscreen.

This is the right way to test. It behaves like the packaged app in every way
that matters except real purchases and ads.

```bash
npm run pwacheck        # verifies everything Chrome requires before it offers
```

---

## 2. Publish to Google Play

### Cost and account

A Google Play developer account is a **one-time $25 registration fee** — there
is no annual charge.

If you register as an **individual** rather than an organisation, Google
currently requires a closed test with a minimum number of testers running for a
continuous period before you can promote to production. Check the exact numbers
in the Play Console when you register, and start the closed test early — it is
usually the long pole in a launch, not the code.

### Build the app

```bash
npm install
npm run build
npx cap add android      # once
npm run cap:android      # build + sync + open Android Studio
```

`android/` is gitignored because it is generated. If you start hand-editing
native files, commit it.

### Configure the Android project

In `android/app/src/main/AndroidManifest.xml`, on the main activity:

```xml
android:screenOrientation="portrait"
android:hardwareAccelerated="true"
```

In `android/app/build.gradle`, set `versionCode` (an integer, must increase
with every upload) and `versionName` (what players see).

The app id is `com.lastgate.game`, set in `capacitor.config.ts`. **Change it
before your first upload if you want a different one** — the app id is
permanent once published.

### Icons and splash

Generated from `src/art/icons.ts`:

```bash
npm run dev &
npm run icons                    # writes resources/ and public/icons/
npx @capacitor/assets generate --android
```

### Signing

Google Play App Signing holds the release key; you upload with your own
*upload* key. Create it once:

```bash
keytool -genkey -v -keystore lastgate-upload.keystore \
  -alias lastgate -keyalg RSA -keysize 2048 -validity 10000
```

Keep that file and its password somewhere you will still have them in three
years. Losing the upload key is recoverable through Play support; losing it
*and* not being enrolled in Play App Signing is not.

Then build the bundle Play wants (an **AAB**, not an APK):

Android Studio → Build → Generate Signed Bundle → Android App Bundle.

### The one product

| | |
| --- | --- |
| Product ID | `com.lastgate.crownpack` |
| Type | One-time managed product (non-consumable) |
| Price | $4.99 |
| Title | The Crown Pack |

> Removes every ad, permanently. Unlocks Chapter 4: Throne of the Demon King
> (8 levels), three exclusive defenders — Paladin, Pyromancer and Warding
> Brazier — the hero Seraphina the Stormcaller, and all three castle skins.
> One purchase, no subscriptions, no loot boxes.

Create it under **Monetise → In-app products** using that exact id, then wire
the plugin:

```bash
npm i cordova-plugin-purchase
npx cap sync
```

`src/systems/iap.ts` already contains the adapter — `NativeStore` talks to
`window.CdvPurchase` and waits for the `verified` callback before granting the
pack. Register the product at startup, inside a native guard:

```ts
const { store, ProductType, Platform } = window.CdvPurchase;
store.register([{
  id: 'com.lastgate.crownpack',
  type: ProductType.NON_CONSUMABLE,
  platform: Platform.GOOGLE_PLAY,
}]);
store.initialize();
```

Test purchases with a **licence testing** account (Play Console → Setup →
Licence testing) — those accounts buy without being charged. Restore is
already wired to the button on the store screen and is expected behaviour on
Play.

### Ads

```bash
npm i @capacitor-community/admob
npx cap sync
```

Replace the test unit ids in `AD_UNITS` (`src/systems/ads.ts`) with your real
AdMob ids and add your AdMob app id to `AndroidManifest.xml` as the plugin's
README describes. The test ids are safe to ship — they serve test ads — but
they earn nothing, so this is a release-checklist item.

The ad policy the game holds itself to is in `src/systems/ads.ts`: never
during a battle, never before the fourth battle of a session, never twice
inside 90 seconds, rewarded video always opt-in, and all of it off forever for
Crown Pack owners.

### Store listing

- **Name**: The Last Gate
- **Short description**: Hold the wall against the Demon King. If the gate
  falls, so does everything behind it.
- **Category**: Games → Strategy
- **Graphics**: 512×512 icon and a 1024×500 feature graphic are required.
  `resources/icon.png` covers the icon.
- **Screenshots**: at least two phone screenshots. Generate them:

```bash
npm run dev &
node scripts/shot.mjs "/?scene=Battle&level=c2l6&unlock=1&nomodal=1" play-1.png 1080 1920 25000 --viewport
```

### Forms Play will not let you skip

- **Privacy policy URL** — required once you ship ads or IAP. The game itself
  collects nothing: progress lives in `localStorage` on the device and never
  leaves it. Say exactly that, and disclose what AdMob collects.
- **Data safety** — declare the AdMob SDK's collection, not the game's.
- **Content rating questionnaire** — fantasy violence, no blood beyond
  stylised bursts, no gambling, no user-generated content.
- **Ads declaration** — yes, the free version contains ads.
- **Target audience** — this is not a children's app; declaring it as one
  brings a stricter ad and privacy regime.

---

## Release checklist

- [ ] `npm test`, `npm run touchtest`, `npm run smoke`, `npm run pwacheck`
- [ ] `npm run build` (never `build:qa` — QA builds carry debug hooks)
- [ ] App id final, `versionCode` incremented
- [ ] Real AdMob unit ids in `src/systems/ads.ts`
- [ ] IAP product live with id `com.lastgate.crownpack`
- [ ] Purchase and restore tested with a licence-testing account on a device
- [ ] Portrait lock confirmed on a real phone
- [ ] Upload keystore backed up somewhere you will still have it
- [ ] Privacy policy live and linked
- [ ] Self-host the UI font (below)

### Self-hosting the font

`index.html` loads Fredoka from Google Fonts, with a system fallback. For a
packaged app, download the woff2 into `public/fonts/` and replace the `<link>`
with an `@font-face` rule, so the game never depends on the network and never
flashes an unstyled frame.
