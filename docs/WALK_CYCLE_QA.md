# Walk-cycle visual QA — 2026-09-26

Latest checkpoint: all 109 moving painted sets have movement cycles. The
2026-10-04 completion entry below supersedes the historical pending counts.

All 34 manifest entries whose movement animation points to two frames (`walk: [1, 2]`) were inspected at full sheet resolution. The frame mapping alone does not prove alternate legs.

## Original audit: 4 grounded characters (now resolved)

In every pair below, the same anatomical leg appears ahead in both movement cells, even when the stride or knee height changes. These sheets could not be counted as completed alternating-leg walks at that checkpoint. The repairs below resolve this audit list.

- `unit.goblin_king.frames`
- `unit.wolf_rider.frames`
- `unit.ghoul.frames`
- `unit.vampire.frames`

## Flying or floating movement: 12 sheets

These have visibly different wing or trailing-form silhouettes across the two movement cells, so the leg criterion does not apply:

- `unit.imp.frames`
- `unit.wraith.frames`
- `unit.goblin_glider.frames`
- `unit.plague_bat.frames`
- `unit.grave_raven.frames`
- `unit.necromancer.frames`
- `unit.wyvern_rider.frames`
- `unit.harpy.frames`
- `unit.abyss_wisp.frames`
- `unit.black_hawk.frames`
- `unit.succubus.frames`
- `unit.lich.frames`

The militia, archer and guardian sheets were repaired by compositing each character's own lower-body pixels: the near leg trails and the far leg leads in the second frame, with right-facing boots and unchanged upper bodies. All three were reviewed at 256 px, 96 px, and a 6 fps preview. Guardian walk B was redone on 2026-09-27: intact knee and shin plates from its idle cell and right-facing boots from its own walk cell replace a jagged first repair. The original tabard hem and upper 154 rows are preserved byte-for-byte; the four-row hip transition is blended. Goblin walk B was repaired on 2026-09-27 with its near boot trailing left and far boot leading right, both toes facing right; only the lower body changed, with all 170 upper rows byte-for-byte identical to walk A. Its rendered lower-body pixels were selected from that goblin's existing idle, walk and attack cells, and checked at 256 px, 96 px, and 6 fps. Goblin runner walk B was repaired with the near leg bending left toward the larger trailing boot and the far leg bending right toward the smaller leading boot. Both original boots retain right-facing toes; the upper 151 rows, arms and dagger remain byte-identical to walk A. Its leg surfaces come from the runner's own walk pixels and were checked at 256 px, 96 px, and 6 fps. Goblin bomber walk B reverses the leather shins and transfers its intact, unmirrored right-facing boots across the stride, while preserving its orange tabard, upper 181 rows and ground shadow. The lower-body hip overlap and the 256 px, 96 px, and 6 fps views were inspected. Hobgoblin walk B transfers its own complete unmirrored leather boots to a reversed stance while retaining the original right knee plate, tunic hem, sword, shield and upper 164 rows. The hip joins and 256 px, 96 px, and 6 fps views were reviewed. Cutthroat walk B moves the near leg and its intact large boot left behind the far leg, with the smaller boot leading right. The original unmirrored boots retain their right-facing toes; softened thigh joins preserve the tabard and both daggers, and the upper 166 rows match walk A. It was checked at 256 px, 96 px and 6 fps. Goblin thief walk B exchanges the leg geometry beneath the shorts, with the near large boot trailing left and the far small boot leading right. The boots are copied unmirrored from its own frame; both right-facing toes and both shin joins were checked at 256 px, 96 px and 6 fps. The upper 181 rows and baseline remain identical to walk A. Dwarf warrior walk B exchanges its own thigh and shin geometry, moving the near armored boot behind to the left and the far boot ahead to the right. Both original boots retain right-facing toes. The shield, apron and upper 172 rows are preserved, the hip overlap is feathered, and the 256 px, 96 px and 6 fps views were reviewed. Bran walk B moves the near armored leg behind to the left and the far leg ahead beneath the shield. Both intact boots come from Bran’s own walk pixels, keep the original scale and baseline, and stay connected to the body. The upper 160 rows and all opaque shield pixels are identical to walk A; the thigh overlap is softened and the sheet was reviewed at 256 px, 96 px and 6 fps. Skeleton archer walk B crosses the exposed bone thighs and knees, moving its near wrapped boot behind to the left and its far boot ahead to the right. Both boots are copied unmirrored from the same skeleton archer, the original red cloak and bow remain intact, the upper 149 rows and baseline match walk A, and the 256 px, 96 px and 6 fps views were reviewed. Bone golem walk B exchanges its own exposed bone knees and feet beneath the unchanged skull and blue drape. The large near foot trails left and the smaller far foot leads right, with right-facing toes, connected limbs and no stray cutout fragments. Its upper 166 rows and ground baseline match walk A, and the 256 px, 96 px and 6 fps views were reviewed. Zombie walk B uses the zombie’s own idle-cell opposite stance below the hips: the grey near leg trails left and the wrapped far leg leads right. The pants join is blended across four pixels, the weapon and upper 155 rows are preserved, and both feet face right at the same baseline. It was checked at 256 px, 96 px and 6 fps. Gravewarden walk B transfers the gravewarden’s own idle-cell lower stance under the unchanged walk upper: its armoured near leg trails left and the other leg leads right, with right-facing toes. The apron covers a four-pixel hip blend; the upper 169 rows and exact frame bounds match walk A. It was inspected at 256 px, 96 px and 6 fps. Skeleton walk B uses that skeleton’s own idle lower stance: its near wrapped boot trails left while the far boot leads right. The original sword, shield, upper 162 rows, tunic overlap, and ground baseline are preserved, with the cut hidden and blended beneath the apron and sword. The 256 px, 96 px and 6 fps views were inspected. Drafts that repeated the same leading leg or broke the boots were rejected before import. The arbalest now has two verified movement cells; see its 2026-09-30 checkpoint below. The 4 defects above add to, rather than replace, the manifest entries still using idle as their walk.

## Acceptance gate for each new or repaired sheet

1. Trace both thighs from hip to knee to boot in each frame. Walk A must lead with one anatomical leg, walk B with the other. A higher knee on the same leg fails.
2. Check at actual game size that both silhouettes, knee bends, boot placements, and thigh overlap make the reversal visible. Boot-color markers alone do not prove this: generated drafts swapped ribbon colors while preserving leg geometry.
3. For flying units, verify a true alternate wing pose at the wing roots, with complete consistent silhouettes.
4. Confirm equal scale, ground baseline, right-facing direction, character identity, transparent background, and no cell spill. Preserve idle, attack, and death art.
5. Only after visual approval update the manifest to five cells and `walk: [1, 2]`. Run typecheck, Vitest, `art:test:painted`, `art:test:links`, and `art:test:regions` before every art push; verify the remote branch ref.

This is an audit of existing assets and does not itself alter runtime art.

## 2026-09-30 lich movement repair

The lich floats and has no visible anatomical legs. Its movement is evaluated as trailing-form animation: walk B bends the lower cloak and ghost-fire left while preserving the upper 122 rows, skull, arms, lantern and scythe. Both frames share a 256×256 cell and vertical bounds. Idle, attack and death cells are pixel-identical to the preceding sheet. Reviewed at 256 px and 96 px; a 6 fps preview is generated from the final two cells. The updated sheet has a new filename to avoid stale asset caching. The six grounded repairs remain open.


## 2026-09-30 shaman and runesmith lower-body redraws

Under the approved lower-body redraw permission, walk B now places each character’s larger near boot behind on the left and its smaller far boot ahead on the right. Both boot toes remain right-facing; the connected shins cross beneath the original hem. Shaman’s clean leg textures were fitted deterministically to the opposite-stride geometry; the generated draft itself was rejected because it repeated the original stride. Runesmith retains its own unmirrored boots and fur cuff, with new connecting trouser sections below the shield and tabard. The original upper 198 rows of shaman and 191 rows of runesmith remain byte-identical to walk A. Idle, walk A, attack and death are unchanged. Opaque ground baselines match. Reviewed at 256 px and 96 px, with final 6 fps previews generated. Both sheets use new filenames. Four audited repairs remain, alongside the missing-cycle inventory.


## 2026-09-30 arbalest new walk cycle

Arbalest now uses a five-cell sheet with walk [1, 2] at 6 fps. Walk A leads with the larger near boot; walk B moves that same boot behind to image-left and the smaller far boot ahead to image-right. Both intact unmirrored boots come from the original character and retain their facing direction. New trouser pixels fill the crossing stride; three-pixel blends join them to the original cuffs. Both upper bodies, coat hem and quiver are preserved; idle, attack and death cells are byte-identical to the old three-cell sheet. Pale cutout ground residue was removed only from the two new movement cells. Their opaque baselines and 256×256 cells match. Full-resolution and 96 px previews were reviewed, with a final 6 fps preview generated. Four audited repairs and 68 idle-only painted movement entries remain.


## 2026-10-02 ghoul repair

Walk B uses new connected lower-leg geometry with the ghoul’s own painted skin texture and intact right-facing clawed feet. The near leg crosses from the right hip to the trailing left foot; the far leg crosses to the leading right foot. The upper 135 rows match walk A exactly; the hanging waist cloth and both hands are protected. Idle, walk A, attack and death cells are unchanged. Full-size and 96 px pairs were inspected; a 6 fps preview was prepared from the final cells. The sheet uses a new filename. Goblin king, wolf rider and vampire remain open.


## 2026-10-02 final three audited repairs

Based on `codex/regional-environment-ui` at `5bbc137`, the three remaining
flagged movement pairs are repaired. This checkpoint covers Goblin King, Wolf
Rider, and Vampire; the 68 idle-only movement entries are outside this batch.

- Goblin King: the foreground armored boot now trails to image-left while the
  other boot leads right. The upper 181 rows match walk A, with the cape and
  tabard layered over the new lower-body artwork.
- Wolf Rider: the foreground front leg bends back beneath the belly while the
  far front paw leads; the hind-leg silhouettes provide the opposite diagonal
  contact. The rider, equipment, and upper 178 rows match walk A, and the wolf's
  muzzle is retained below that boundary.
- Vampire: the foreground ornate boot trails left while the smaller far boot
  leads right. The upper 164 rows, original cloak overlap, and sword are retained.

The replacement lower-body artwork was produced with the built-in image tool,
then packed beneath the existing upper bodies. Candidates that repeated the
leading leg or introduced a background glow were rejected. The accepted pairs
were inspected at 256 px, 96 px, and as 6 fps loops, then in a running battle.
The original walk A cell is pixel-identical in all three sheets.

During inspection, Goblin King's idle/death cells and Wolf Rider's idle/attack
cells proved to contain background fragments instead of complete character
cutouts. They were restored from their original source paintings with transparent
backgrounds. Goblin King's attack, Wolf Rider's death, and all Vampire non-walk
cells are pixel-identical to the preceding sheets. New versioned filenames avoid
stale browser asset caches. The existing two-contact, 6 fps timing is retained;
this checkpoint does not add passing poses or change combat timing.

| Character | 6 fps loop | 96 px contact pair |
| --- | --- | --- |
| Goblin King | [Loop](art-refresh/walk-repairs/goblin_king.gif) | [Pair](art-refresh/walk-repairs/goblin_king-96.png) |
| Wolf Rider | [Loop](art-refresh/walk-repairs/wolf_rider.gif) | [Pair](art-refresh/walk-repairs/wolf_rider-96.png) |
| Vampire | [Loop](art-refresh/walk-repairs/vampire.gif) | [Pair](art-refresh/walk-repairs/vampire-96.png) |

Validation passed:

- `npm run build` (TypeScript check and production bundle).
- `npm test`: 164 tests across seven files.
- `npm run art:test:painted`, `art:test:regions`, and `art:test:links`.
- `node scripts/walk-repair-test.mjs http://localhost:5173`: each character's
  sheet dimensions, nonempty alpha in all five cells, clear cell boundaries,
  unchanged upper bodies and retained cells, matching walk baseline, and actual
  Phaser idle/walk/attack/death playback. The runner loads the game, exercises
  both movement cells, and writes a battle screenshot to the ignored screenshots
  directory. Use the environment's system-Chromium startup instructions when
  running it in this cloud machine.

Different frame pixels alone cannot establish anatomical quality; the automated
checks supplement the contact-pair and gameplay review. This is a local repair
checkpoint; publication has not been performed.


## 2026-10-04 remaining movement completion

The 68 idle-only entries contained 67 moving character sets and Gatebreaker,
which `src/data/defenders.ts` declares as a stationary build. All 67 moving sets
now use new `movement.v61.png` sheets with 256×256 cells in the order idle,
walk A, walk B, attack, death. Walk plays cells `[1, 2]` at 6 fps. The 42
existing movement sets, including the three audited repairs above and seven
legacy drawn strips, retain their current animation artwork. No moving entry
still maps walk to idle.

The [interactive review gallery](art-refresh/walk-completion/index.html) shows
all 67 contact pairs and loops, with region filters, pause and individual-pose
controls, and 96 px or 256 px display sizes. The
[coverage record](art-refresh/walk-completion/coverage.json) records each source
sheet, replacement, preserved upper boundary, and retained action indices.

New artwork was authored with the built-in image tool. For 51 humanoid sets,
separate connected lower-body contacts were extracted from generated cutouts
and fitted under a shared upper body, with coat hems, weapons, shields, and
hands layered over the joins. Walk A places the larger foreground boot to the
right; walk B places it to the left, with both sets of toes facing right.
Generated full-body quadruped, crawler, and flying contacts retain connected
limbs and wings. The serpent changes its coil, while floating characters change
water, cloth, or trailing spectral forms. Both contacts were reviewed as full
pairs and in game-size previews; disconnected leg roots and horizontal cut
lines found during review were rejected.

Idle, attack, and death cells remain pixel-identical for 66 of the 67 new
sheets. Deepwatch's old presentation and portrait incorrectly showed a gate;
these were replaced with the moving aquatic spear-and-shield guard. Garrick's
new movement art restores the cropped crown of his head while retaining his
original non-walk cells. All sheets use transparent backgrounds and versioned
filenames.

Validation:

- `npm run build` and all 164 tests across seven Vitest files passed.
- `art:test:walks` verifies 109 moving sets and the stationary Gatebreaker
  exception; regional coverage verifies 85 characters, painted integrity
  verifies 414 images, and data links verify 78 entries.
- `scripts/walk-completion-test.mjs` passed for all 67 new sheets, checking packed
  dimensions, retained action pixels, shared humanoid upper pixels, distinct
  nonempty movement cells, cell boundaries, matching baselines, and actual
  Phaser Rig idle/walk/attack/death playback.
- The three-character `walk-repair-test.mjs` regression also passed against
  the final manifest.
- The final gallery loads all 67 sheets without browser errors.

Run browser checks against a running Vite server. In this cloud environment,
use the system Chromium launch override described in the setup instructions.
Pixel checks verify packing and playback; anatomical review remains visual.
These changes are local on `codex/regional-environment-ui`; no publication
has been performed.
