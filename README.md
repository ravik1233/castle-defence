# The Last Gate

A castle defence game for phones. Five lanes, a wall on the left, and a demon
host that walks. Place defenders, cast hero spells, and hold the gate — if it
falls, there is nothing behind it.

**Play the current build:** https://castle-defense-game-cd83.netlify.app

Screenshots are regenerated rather than committed:

```bash
npm run dev &
node scripts/shot.mjs "/?scene=Battle&level=c2l6&unlock=1&nomodal=1" battle.png 1920 1080 25000 --viewport
node scripts/shot.mjs /preview.html art.png 1000 1500      # the whole cast
```

## What it is

- Landscape lane defence: Plants vs. Zombies pacing with a Clash-style card
  tray and a hero you tap to cast with. Landscape because the lanes run
  horizontally - lane direction should match the long axis of the screen.
- 38 hand-named levels across four chapters, each with a seeded wave
  generator so every player fights identical waves.
- 14 defenders, 14 enemy types, a Demon King boss, two heroes.
- Free to play. One optional purchase: **the Crown Pack, $4.99** — removes all
  ads, unlocks chapter 4, three defenders, a second hero and every castle skin.
  Nothing else is for sale.

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production bundle into dist/
npm run preview      # serve the production bundle
npm test             # unit tests
npm run smoke        # boots a real battle in Chromium and asserts it plays
npm run touchtest    # asserts taps land where fingers are, on three phone sizes
npm run pwacheck     # asserts Chrome on Android will offer to install it
npm run art:import   # pull painted art from art-in/ into the game
```

Useful development URLs (dev builds and `npm run build:qa` only):

| URL | What it does |
| --- | --- |
| `/?scene=Battle&level=c3l10` | Drop straight into a level |
| `/?unlock=1` | Grant the Crown Pack, all levels and 250k gold |
| `/?nomodal=1` | Skip the pre-battle briefing |
| `/?touchdebug=1` | Draw where the game thinks your finger is |
| `/preview.html` | Art sheet: every character, part by part |
| `/iconsheet.html` | Store artwork (icon, adaptive layers, splash) |

These hooks are compiled out of shipping builds — see `__QA_BUILD__` in
`vite.config.ts`.

## Layout

```
src/
  art/          Vector art engine: everything on screen is drawn from code
    Svg.ts        SVG document builder + the shared lighting model
    humanoid.ts   Parametric character generator (one spec -> body parts)
    cast.ts       Art spec for every character in the game
    compose.ts    Where each body part sits; used by rig and by card art
    structures.ts Buildings, the wall, the gate, castle skins
    scenery.ts    Biome backdrops, menu and map art
    props.ts      Projectiles, effects, pickups, UI frames
    icons.ts      App icon, adaptive layers, splash
    registry.ts   Rasterises it all into textures; painted-art override
  battle/       Simulation: entities and pure combat maths
  core/         Colour maths and screen layout constants
  data/         Stats and content: defenders, enemies, heroes, levels
  objects/Rig   The animated cut-out puppet
  scenes/       Preload, MainMenu, Map, Battle, Armory, Store, Settings, Result
  systems/      Save, profile, IAP, ads, audio, native shell, textures
tests/          Unit tests (vitest)
scripts/        Screenshot, smoke test, icon generation
docs/           Art bible, store/publishing guide, design notes
```

## The art

There are no image files. Every character, building, projectile and UI frame is
an SVG document generated at runtime and rasterised into a texture at boot.
That keeps the download at ~360 KB gzipped, stays crisp on any screen, and lets
a unit be recoloured by changing one hex value.

Characters are not spritesheets either: the generator emits each body part as
its own texture with a pivot, and `Rig` animates them as a cut-out puppet.
Adding a unit is one entry in `src/art/cast.ts` plus a stat block in
`src/data/`.

**Painted art can replace any of it** without touching code — see
[docs/ART_BIBLE.md](docs/ART_BIBLE.md).

## Playing it on a phone

**Android only** — there is no iOS target in this project.

The game is a full PWA. Open the site in Chrome on Android and install it
(menu → Install app, or the prompt on the main menu). It gets a home-screen
icon and launches fullscreen with no URL bar, and works offline. That is the
right way to test: it behaves like the packaged app in everything except real
purchases and ads.

For Google Play, the web build is wrapped with Capacitor:

```bash
npm run build
npx cap add android            # once
npm run cap:android            # build + sync + open Android Studio
```

Signing, the IAP product, ad units, the listing and the release checklist are
in [docs/PLAY_STORE.md](docs/PLAY_STORE.md).
