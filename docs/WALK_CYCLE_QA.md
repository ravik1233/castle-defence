# Walk-cycle visual QA — 2026-09-26

All 34 manifest entries whose movement animation points to two frames (`walk: [1, 2]`) were inspected at full sheet resolution. The frame mapping alone does not prove alternate legs.

## Repair required: 22 grounded characters

In every pair below, the same anatomical leg appears ahead in both movement cells, even when the stride or knee height changes. These sheets must not be counted as completed alternating-leg walks.

- `unit.archer.frames`
- `unit.goblin.frames`
- `unit.goblin_bomber.frames`
- `unit.goblin_runner.frames`
- `unit.guardian.frames`
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

The militia sheet was repaired by compositing its own lower-body pixels: the near leg trails and the far leg leads in the second frame, with right-facing boots and unchanged upper body. It was reviewed at 256 px, 96 px, and 6 fps. The arbalest remains on `walk: [0]`. Several generated arbalest and militia replacement drafts repeated the leading leg and were rejected before import. The 22 defects above add to, rather than replace, the manifest entries still using idle as their walk.

## Acceptance gate for each new or repaired sheet

1. Trace both thighs from hip to knee to boot in each frame. Walk A must lead with one anatomical leg, walk B with the other. A higher knee on the same leg fails.
2. Check at actual game size that both silhouettes, knee bends, boot placements, and thigh overlap make the reversal visible. Boot-color markers alone do not prove this: generated drafts swapped ribbon colors while preserving leg geometry.
3. For flying units, verify a true alternate wing pose at the wing roots, with complete consistent silhouettes.
4. Confirm equal scale, ground baseline, right-facing direction, character identity, transparent background, and no cell spill. Preserve idle, attack, and death art.
5. Only after visual approval update the manifest to five cells and `walk: [1, 2]`. Run typecheck, Vitest, `art:test:painted`, `art:test:links`, and `art:test:regions` before every art push; verify the remote branch ref.

This is an audit of existing assets and does not itself alter runtime art.
