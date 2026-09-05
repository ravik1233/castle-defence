# Art bible

Everything on screen is generated from code. This document is what an
illustrator needs to replace it with painted art, and what a programmer needs
to add a new unit.

## The look

The rules below are applied uniformly by `src/art/Svg.ts`, which is why the
cast reads as one family:

| Rule | Where it lives |
| --- | --- |
| One key light from the top; every solid shape gets a light-to-shadow vertical ramp | `Svg.bodyFill` |
| A chunky dark outline on every silhouette shape (~5% of the shape's width) | `Svg.strokeAttrs` |
| Shadow tones cool and gain saturation; highlights warm and lose it | `core/color.ts` `lighten`/`darken` |
| One saturated accent colour per character carries its identity | `CharacterSpec.accent` |
| Exaggerated proportions: big head, big hands, small feet | `humanoid.ts` `BUILDS` |
| Everything stands on a soft ground shadow | `Svg.groundShadow` |

Palette anchors: gold `#f5c542`, parchment `#f4ecdd`, ink `#1b1626`, danger
`#e8455c`, good `#5fd07a`, arcane `#a45cf0`.

## Adding a character

1. Add a `CharacterSpec` to `src/art/cast.ts`:

```ts
orc_shaman: {
  id: 'orc_shaman',
  height: 150,              // art px, feet to crown
  build: 'lean',            // small | lean | broad | huge
  skin: '#6fa03c',
  cloth: '#4a2f5e',
  metal: '#7f8894',         // omit for unarmoured
  accent: '#a45cf0',        // the identity colour
  eye: '#c98bff',
  glowEyes: true,
  head: { shape: 'long', ears: 'big', horns: 'small', jaw: 'fangs', gear: 'hood', brow: 0.3 },
  weapon: 'staff',
  offhand: 'none',
  cape: '#241d38',
  wings: 'none',
  aura: '#a45cf0',
}
```

2. Add the stat block in `src/data/enemies.ts` or `defenders.ts`, pointing
   `art` at the id.
3. That's it — textures, animation and card art all follow.

Run `npm run dev` and open `/preview.html` to see the whole cast, and the
per-part breakdown of any character.

### The vocabulary

- `build`: `small` (goblins), `lean` (archers, mages), `broad` (orcs, knights),
  `huge` (trolls, the Demon King)
- `head.shape`: `round`, `square`, `long`, `skull`
- `head.ears`: `none`, `pointy`, `big`, `torn`
- `head.horns`: `none`, `small`, `curved`, `crown`, `antler`
- `head.jaw`: `none`, `tusks`, `fangs`, `beard`
- `head.gear`: `none`, `cap`, `full`, `crown`, `hood`, `wizard`, `plume`
- `head.brow`: −1 noble/calm … +1 furious
- `weapon`: `sword`, `greatsword`, `axe`, `greataxe`, `club`, `spear`, `bow`,
  `staff`, `dagger`, `hammer`, `scythe`, `torch`, `crossbow`
- `offhand`: `shield`, `buckler`, `orb`, `lantern`
- `wings`: `bat`, `feather`

## Animation

`src/objects/Rig.ts` drives the parts procedurally — no frames to draw:

| State | What moves |
| --- | --- |
| `idle` | slow breath bob, small arm sway |
| `walk` | legs swing ±0.62 rad, arms counter-swing, body bobs on the step |
| `attack` | wind-up to −1.15 rad, strike to +0.35, hit event fires at 55% |
| `cast` | weapon arm raises to −1.9 rad, effect fires at 50% |
| `hurt` | recoil and white flash |
| `die` | topple 1.35 rad and fade |
| `spawn` | scale and fade in |

Pose geometry is in `src/art/compose.ts` (`characterLayout`), which both the rig
and the static character sheets read, so a tweak applies everywhere.

## Replacing the vector art with painted art

Any texture key can be overridden by a PNG with no code change.

1. Put PNGs in `public/assets/painted/`.
2. Create `public/assets/painted/manifest.json` mapping texture keys to
   filenames:

```json
{
  "unit.orc.head": "orc_head.png",
  "unit.orc.torso": "orc_torso.png",
  "build.ballista": "ballista.png",
  "bg.fields": "fields.png"
}
```

Anything listed is loaded from the PNG; anything absent keeps the vector art, so
the pack can be delivered a unit at a time.

### Key naming

| Key | What | Notes |
| --- | --- | --- |
| `unit.<id>.<part>` | One body part | parts: `head`, `torso`, `armFront`, `armBack`, `legFront`, `legBack`, `weapon`, `offhand`, `cape`, `wings` |
| `build.<id>` | A structure | origin is bottom-centre |
| `bg.<biome>` | Battlefield backdrop | `fields`, `woods`, `abyss`, `throne` |
| `wall.<skin>` / `gate.<skin>` / `keep.<skin>` | Castle art per skin | `stone`, `ivory`, `obsidian`, `verdant` |
| `shot.<id>` | Projectile | drawn pointing **+x** |
| `fx.<id>` | Effect | |
| `icon.<id>` | Pickup / HUD icon | |
| `ui.*` | Frames, buttons, bars | |

### Sizes and pivots

Character parts are authored at 2× their in-game size (`SUPERSAMPLE` in
`registry.ts`). A painted replacement must match the **aspect ratio and the
pivot** of the generated part, or the puppet will come apart. To get the exact
numbers for any character:

```
npm run dev            # then open /preview.html
```

The per-part detail row shows each part at its authored size; pivots are
`PartArt.pivotX/pivotY` in `src/art/humanoid.ts` (fractions of the texture).
The safest workflow is to export the generated part as a template, paint over
it at the same canvas size, and keep the same anchor point.

Backdrops are rasterised at half resolution and scaled up (`BACKDROP_SCALE`),
so a painted `bg.*` at 1080×1160 or larger will look sharper than the vector
original, not worse.
