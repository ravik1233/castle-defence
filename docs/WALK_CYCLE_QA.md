# Walk-cycle visual QA — 2026-09-26

All 34 manifest entries whose movement animation points to two frames (`walk: [1, 2]`) were inspected at full sheet resolution. The frame mapping alone does not prove alternate legs.

## Repair required: 18 grounded characters

In every pair below, the same anatomical leg appears ahead in both movement cells, even when the stride or knee height changes. These sheets must not be counted as completed alternating-leg walks.

- `unit.goblin_bomber.frames`
- `unit.hobgoblin.frames`
- `unit.shaman.frames`
- `unit.cutthroat.frames`
- `unit.goblin_king.frames`
- `unit.goblin_thief.frames`
- `unit.wolf_rider.frames`
- `unit.dwarf_warrior.frames`
- `unit.runesmith.frames`
- `unit.gravewarden.frames`
- `unit.bran.frames`
- `unit.skeleton.frames`
- `unit.skeleton_archer.frames`
- `unit.zombie.frames`
- `unit.ghoul.frames`
- `unit.vampire.frames`
- `unit.bone_golem.frames`
- `unit.lich.frames`

## Flying or floating movement: 11 sheets

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

The militia, archer and guardian sheets were repaired by compositing each character's own lower-body pixels: the near leg trails and the far leg leads in the second frame, with right-facing boots and unchanged upper bodies. All three were reviewed at 256 px, 96 px, and a 6 fps preview. Guardian walk B was redone on 2026-09-27: intact knee and shin plates from its idle cell and right-facing boots from its own walk cell replace a jagged first repair. The original tabard hem and upper 154 rows are preserved byte-for-byte; the four-row hip transition is blended. Goblin walk B was repaired on 2026-09-27 with its near boot trailing left and far boot leading right, both toes facing right; only the lower body changed, with all 170 upper rows byte-for-byte identical to walk A. Its rendered lower-body pixels were selected from that goblin's existing idle, walk and attack cells, and checked at 256 px, 96 px, and 6 fps. Goblin runner walk B was repaired with the near leg bending left toward the larger trailing boot and the far leg bending right toward the smaller leading boot. Both original boots retain right-facing toes; the upper 151 rows, arms and dagger remain byte-identical to walk A. Its leg surfaces come from the runner's own walk pixels and were checked at 256 px, 96 px, and 6 fps. Drafts that repeated the same leading leg or broke the boots were rejected before import. The arbalest remains on `walk: [0]`. The 18 defects above add to, rather than replace, the manifest entries still using idle as their walk.

## Acceptance gate for each new or repaired sheet

1. Trace both thighs from hip to knee to boot in each frame. Walk A must lead with one anatomical leg, walk B with the other. A higher knee on the same leg fails.
2. Check at actual game size that both silhouettes, knee bends, boot placements, and thigh overlap make the reversal visible. Boot-color markers alone do not prove this: generated drafts swapped ribbon colors while preserving leg geometry.
3. For flying units, verify a true alternate wing pose at the wing roots, with complete consistent silhouettes.
4. Confirm equal scale, ground baseline, right-facing direction, character identity, transparent background, and no cell spill. Preserve idle, attack, and death art.
5. Only after visual approval update the manifest to five cells and `walk: [1, 2]`. Run typecheck, Vitest, `art:test:painted`, `art:test:links`, and `art:test:regions` before every art push; verify the remote branch ref.

This is an audit of existing assets and does not itself alter runtime art.
