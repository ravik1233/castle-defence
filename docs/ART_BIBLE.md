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

## Painted art

For the practical route - generating a painted set with an image model and
dropping it in - see **[GEMINI_ART_PROMPTS.md](GEMINI_ART_PROMPTS.md)**, which
has a prompt per unit and a one-command importer. The rest of this section
documents the underlying mechanism.

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
| `unit.<id>.full` | A whole painted character | replaces the part rig entirely; feet at the bottom edge, facing right |
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

### Ground tiles

Special ground is part of the field, not something set down on it. The
vector originals were drawn as objects - a glossy oval with a dark rim for
water, a cone on a disc for a shrine - and against the painted backdrops they
read as stickers. Paint them the way `tile.ember.seam.png` is painted, and
keep to three rules:

1. **No outline and no hard shadow.** Contact shading is soft and local.
2. **Fade to fully transparent before the edge of the canvas.** A fade that
   reaches the edge is cut off there in a straight line, and that line is what
   makes a tile look boxed in. Keep alpha at zero along all four edges - except
   the edges where strip pieces join (below).
3. **Darken the ground rather than recolouring it** for wet or trodden earth.
   Translucent darks sit on every region's ground; an opaque brown only sits
   on one.

A cell is 200×150. Everything painted is at 2×.

**Features spill; strips do not.** A feature tile (the first five below) is
drawn at a fixed 2:1 density, centred on its cell, so a canvas bigger than
the cell simply reaches into the cells around it. Paint features on a
**640×480** canvas (a cell and a half each way) and let the ground they
disturb - the cracked earth round a vein, the grit round fallen stone, the
trampled ring round a shrine - run out into that margin and fade to nothing
before the canvas edge. The *thing itself* - the crystal, the stone, the
shelf, the stand of grass - stays inside the middle 400×300, because that is
the cell the player taps and the effect belongs to. A feature that looks
cut out of the field in a box is exactly what this is for.

A feature canvas smaller than 400×300 is older art and is fitted to the cell
instead, as the first `tile.ember.seam.png` (252×256) is.

| Key | What | Canvas | Drawn |
| --- | --- | --- | --- |
| `tile.highground` | A broken bedrock shelf with a level top | 640×480 | 2:1, centred, spills |
| `tile.rubble` | Fallen masonry in a spread of grit | 640×480 | 2:1, centred, spills |
| `tile.tallgrass` | A stand of tall grass, paler than the field | 640×480 | 2:1, centred, spills |
| `tile.shrine` | A weathered standing stone, a lit rune cut in it | 640×480 | 2:1, centred, spills |
| `tile.seam` | An Ember vein | 640×480 | 2:1, centred, spills |
| `tile.water` / `tile.marsh` | A pool on its own | 400×300 | exactly one cell |
| `tile.water.left` / `.mid` / `.right` | The ends and middle of a run of water | 400×300 | exactly one cell, edge to edge |
| `tile.marsh.left` / `.mid` / `.right` | The same for marsh | 400×300 | exactly one cell, edge to edge |

**Per region.** Any tile key can also be supplied for one region by adding
the region to it: `tile.rubble.barrows`, `tile.seam.throne`,
`tile.water.mid.coast`. The battle uses the region's own version when there
is one and the shared key otherwise. Region ids: `fields`, `barrows`,
`woods`, `highland`, `coast`, `abyss`, `throne`. Region-suffixed art is not
loaded at boot; each fort fetches only its own region's.

**Water and marsh come in pieces** because a run of them across a lane is one
body of ground, and a flooded lane is a single channel. The battle lays a
run as `left`, as many `mid` as it needs, then `right`; a lone cell uses the
plain `tile.water` / `tile.marsh`. So:

- `mid` must repeat seamlessly left to right: its left edge continues its own
  right edge.
- `left` must join `mid` on its right edge, and `right` must join `mid` on its
  left edge.
- The bank may wave, but keep its height at the joining edges the same in all
  three pieces, or every join shows as a step.
- Supply all four of a set together. A painted `tile.water` next to vector
  `left`/`mid`/`right` pieces will not match.

Water must read as deep - nothing without a boat can stand in it, and a
puddle says the opposite. Marsh must read as wet ground, never as water.

### Broken wall

Three overlays sit on the five-gate wall plate, one lane at a time. Each
covers **both parapet tiles** of a lane - 400 wide - and 15 px over the
lane's top and bottom edge so fallen stone can lie across the join: a
display size of **400×180**, painted at **800×360**, centred on the lane.
They are drawn *over* the plate, so everything outside the damage itself
must be transparent - the plate shows through.

| Key | When | What |
| --- | --- | --- |
| `rampart.broken` | The **Broken Rampart** lane role: that lane's parapet is gone and nothing can be built on it | The walkway collapsed into a heap of blocks and grit, broken merlons, snapped timbers. Must read as *unbuildable ground*, with no flat stone left to stand on. Replaces the two rubble tiles. |
| `wall.breach` | A section at 0 HP: the **Collapsed Gate** lane role and the **Breached Gate** doctrine start with one; any section can be battered down in the fight | A hole right through the wall at that lane: gate torn off or smashed, ragged masonry edges, rubble spilled through toward the keep, dark courtyard visible through the gap. Enemies walk through it. |
| `wall.cracks` | A section losing HP | Cracks, spalled stone and a loose block or two on the parapet face. Faded in by the game as the section is worn - paint it at full damage. |

Every one of them may be supplied per region (`wall.breach.barrows`), and
should be: the seven plates are seven different stones. With none painted,
the game falls back to rubble tiles and a dark block.

