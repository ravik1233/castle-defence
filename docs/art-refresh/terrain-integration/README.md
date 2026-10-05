# Regional battlefield integration — 2026-10-05

The first integration pass is available in the [before/after comparison](index.html).
The same forts and placement cells are shown in Broken Fields, Drowned Coast,
and Demon Throne. The slider reveals the earlier rendering on the left.

The work is on `codex/regional-ground-integration`, which includes Claude's
`857e039` painted-continent support and the completed walk-cycle checkpoint
`6b816b3`. The histories were combined without discarding either change.

Buildings previously anchored the bottom of the image canvas rather than the
visible structure. Barricade has 54 pixels of transparent padding below its
solid base; those pixels became an apparent gap above the battlefield. Visible
bounds now determine the origin, fit and health-bar anchor. Each structure has
a feathered regional foundation, contact shadow, and a small foreground grit
layer. Damage flashes restore the regional incident light, and destruction
removes the contact layers. Structures with authored poses load alongside the
deck; Gatebreaker falls back to its static building if its sheet is unavailable.

All seven regions share their local materials and incident light between terrain
features and structures:

| Region | Ground contact |
| --- | --- |
| Fields | Trampled soil and meadow grass |
| Barrows | Damp peat and moss |
| Woods | Ash and fallen leaves |
| Highlands | Gravel and weathered bedrock |
| Coast | Wet sand and salt-worn stone |
| Abyss | Cooled slag and volcanic dust |
| Throne | Scuffed obsidian paving |

Terrain receives wide feathered material transitions. Existing regional feature
paintings remain selected where present; common geometry receives the regional
light. Rubble and grass alternate orientation to reduce visible repetition.
Water and marsh preserve their adjoining strip pieces and placement footprints.
Building contact textures are generated once on demand and cached per region;
there is no texture generation in the frame-update loop.

The coast and throne backdrops were also edited with the built-in image tool and
saved under new versioned WebP filenames. The coast's lower playable ground is
continuous wet beach: dry placement cells no longer sit over decorative ocean.
The throne's playfield is worn obsidian without foreground braziers, pillars,
chains, rubble, lava cracks, or glowing symbols that imply nonexistent obstacles.
The original atmospheric scenery is retained above the playfield. Runtime
terrain declares the water, obstacles and bonuses. Original backdrop files are
retained for comparison. The two delivered replacements total about 389 KiB.

## Gameplay direction

Keep the five-lane defence and exact placement grid for this pass. The rendering
changes preserve terrain maps, card costs, combat rules, mine deposits and legal
placement. A mechanics redesign should respond to a playtesting problem rather
than an artwork mismatch.

The next useful terrain design is authored connected areas within that grid:
continuous tidal channels and dry defensive shelves on the coast, ash clearings
and cover bands in the woods, and broken paving near the throne. Ground art and
movement/building permissions should come from the same map. That avoids a
painted river that units can stand on, or scattered isolated pools that imply
shallower water than the rules allow. This pass supplies regional rendering and
clear base ground; it does not replace every shared building with a new drawing
or redesign the seeded terrain generator.

## Validation

- Production build and 164 Vitest tests passed.
- Painted integrity: 414 images; regional action coverage: 85 characters;
  data-art links: 78 entries; walk coverage: 109 moving sets and one stationary
  build.
- `node scripts/grounding-test.mjs http://localhost:5173` passed for six building
  artworks in all seven regions: visible bases, lane fit, lighting, contact
  feathering, unchanged placement rules, damage-flash restoration and cleanup.
  It also verifies Gatebreaker's inclusion in deck preload.
- `node scripts/smoke.mjs http://localhost:5173` passed live placement,
  combat, victory and breach/defeat against the finished code.
- The browser comparison loads the three before/after pairs and its region
  tabs and reveal slider work without errors.

In this managed cloud environment the browser commands use:
`NODE_OPTIONS='--import=/workspace/cloud-setup/system-chromium.mjs'`.
