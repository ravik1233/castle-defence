# Premium art refresh — work in progress

Quality target: the character appeal, readability, material polish and animation
craft of premium mobile games such as Clash Royale and Plants vs. Zombies.
Characters and buildings must have their own original designs.

## Direction

- Sculpted, stylized 3D appearance with large expressive heads and hands.
- Strong silhouettes and broad color blocks that read at 96–120 screen pixels.
- Rounded bevels, restrained surface detail, warm key light and cool shadows.
- Distinct personalities and faction silhouettes, not costume recolors alone.
- Side-view gameplay camera; consistent ground line, scale and facing.
- Separate animation poses with anticipation, impact and recovery. Repeated
  near-identical poses do not constitute a complete walking cycle.

The earlier `militia-style-draft.png` is a superseded painted-style exploration,
not an approved or installed production sprite.

## Coverage

`inventory.json` records 103 distinct character art IDs, five placeable
structures, and twelve wall/gate/keep assets across the four castle skins.
Multiple gameplay units currently share character art. Shared IDs therefore
need a second review against gameplay roles before claiming visually distinct
coverage for every gameplay unit and commander.

Stage 1 is the first production slice. Militia, Archer, Goblin Grunt, Goblin
Runner and Commander Aldric now use clean packed eight-frame sets, with distinct
idle, walk, attack, hurt and defeat poses. The Tithe Shrine and Ironhold gate
also use the new premium direction. Later forts still fall back to their
existing painted or vector artwork until their region is refreshed.

## Animation support

`PaintedFrames` now accepts a `sheet` filename and an `animations` map:

```json
{
  "unit.example.frames": {
    "sheet": "unit.example.sheet.png",
    "count": 24,
    "width": 256,
    "height": 256,
    "names": [],
    "animations": {
      "idle": { "frames": [0, 1, 2, 3, 4, 5], "fps": 6 },
      "walk": { "frames": [6, 7, 8, 9, 10, 11], "fps": 10 },
      "attack": { "frames": [12, 13, 14, 15, 16, 17], "fps": 14 },
      "cast": { "frames": [18, 19], "fps": 4 },
      "hurt": { "frames": [20], "fps": 5 },
      "spawn": { "frames": [21, 0], "fps": 7 },
      "die": { "frames": [22, 23], "fps": 4 }
    }
  }
}
```

Frame width and height are cell dimensions, not image dimensions. Sheets use
row-major order. Attack and cast playback follow existing combat durations;
their impacts remain at 55% and 50%, respectively. The map is an initial
interchange example, not a quality ceiling: add poses where an action needs them.

Legacy five-pose sets remain supported. Frame sets take priority over static
painted images. Hurt and spawn return to idle, and frame-based characters now
receive tint and damage-flash effects.

## Acceptance checks

Inspect actual alpha data, not just the image preview: a visible background in
a preview can still have transparent pixels in the underlying PNG. Conversely,
a painted checkerboard is not transparency. Inspect each animation at gameplay
size, verify anatomy and equipment continuity, and check every cell for clipping.
Validate ground alignment and impact timing in a running battle.

Packed sheets reduce per-character image uploads. GPU memory and download size
still need measurement after the final assets exist. No total memory or loading
speed improvement is claimed yet.

## Validation so far

- TypeScript check passed.
- Existing suite: 144 tests passed.
- Production and QA builds passed.
- Packed runtime checks: 13 passed.
- Browser smoke test passed through victory and defeat.
- New final sprite coverage: Stage 1 complete; Region 1 pending.

This branch is a playable Stage 1 art and animation test build, not the
completed full-roster replacement.
