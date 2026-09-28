# Walk-cycle visual QA — 2026-09-26

All 34 manifest entries whose movement animation points to two frames (`walk: [1, 2]`) were inspected at full sheet resolution. The frame mapping alone does not prove alternate legs.

## Repair required: 8 grounded characters

In every pair below, the same anatomical leg appears ahead in both movement cells, even when the stride or knee height changes. These sheets must not be counted as completed alternating-leg walks.

- `unit.shaman.frames`
- `unit.goblin_king.frames`
- `unit.wolf_rider.frames`
- `unit.runesmith.frames`
- `unit.skeleton.frames`
- `unit.ghoul.frames`
- `unit.vampire.frames`
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

The militia, archer and guardian sheets were repaired by compositing each character's own lower-body pixels: the near leg trails and the far leg leads in the second frame, with right-facing boots and unchanged upper bodies. All three were reviewed at 256 px, 96 px, and a 6 fps preview. Guardian walk B was redone on 2026-09-27: intact knee and shin plates from its idle cell and right-facing boots from its own walk cell replace a jagged first repair. The original tabard hem and upper 154 rows are preserved byte-for-byte; the four-row hip transition is blended. Goblin walk B was repaired on 2026-09-27 with its near boot trailing left and far boot leading right, both toes facing right; only the lower body changed, with all 170 upper rows byte-for-byte identical to walk A. Its rendered lower-body pixels were selected from that goblin's existing idle, walk and attack cells, and checked at 256 px, 96 px, and 6 fps. Goblin runner walk B was repaired with the near leg bending left toward the larger trailing boot and the far leg bending right toward the smaller leading boot. Both original boots retain right-facing toes; the upper 151 rows, arms and dagger remain byte-identical to walk A. Its leg surfaces come from the runner's own walk pixels and were checked at 256 px, 96 px, and 6 fps. Goblin bomber walk B reverses the leather shins and transfers its intact, unmirrored right-facing boots across the stride, while preserving its orange tabard, upper 181 rows and ground shadow. The lower-body hip overlap and the 256 px, 96 px, and 6 fps views were inspected. Hobgoblin walk B transfers its own complete unmirrored leather boots to a reversed stance while retaining the original right knee plate, tunic hem, sword, shield and upper 164 rows. The hip joins and 256 px, 96 px, and 6 fps views were reviewed. Cutthroat walk B moves the near leg and its intact large boot left behind the far leg, with the smaller boot leading right. The original unmirrored boots retain their right-facing toes; softened thigh joins preserve the tabard and both daggers, and the upper 166 rows match walk A. It was checked at 256 px, 96 px and 6 fps. Goblin thief walk B exchanges the leg geometry beneath the shorts, with the near large boot trailing left and the far small boot leading right. The boots are copied unmirrored from its own frame; both right-facing toes and both shin joins were checked at 256 px, 96 px and 6 fps. The upper 181 rows and baseline remain identical to walk A. Dwarf warrior walk B exchanges its own thigh and shin geometry, moving the near armored boot behind to the left and the far boot ahead to the right. Both original boots retain right-facing toes. The shield, apron and upper 172 rows are preserved, the hip overlap is feathered, and the 256 px, 96 px and 6 fps views were reviewed. Bran walk B moves the near armored leg behind to the left and the far leg ahead beneath the shield. Both intact boots come from Bran’s own walk pixels, keep the original scale and baseline, and stay connected to the body. The upper 160 rows and all opaque shield pixels are identical to walk A; the thigh overlap is softened and the sheet was reviewed at 256 px, 96 px and 6 fps. Skeleton archer walk B crosses the exposed bone thighs and knees, moving its near wrapped boot behind to the left and its far boot ahead to the right. Both boots are copied unmirrored from the same skeleton archer, the original red cloak and bow remain intact, the upper 149 rows and baseline match walk A, and the 256 px, 96 px and 6 fps views were reviewed. Bone golem walk B exchanges its own exposed bone knees and feet beneath the unchanged skull and blue drape. The large near foot trails left and the smaller far foot leads right, with right-facing toes, connected limbs and no stray cutout fragments. Its upper 166 rows and ground baseline match walk A, and the 256 px, 96 px and 6 fps views were reviewed. Zombie walk B uses the zombie’s own idle-cell opposite stance below the hips: the grey near leg trails left and the wrapped far leg leads right. The pants join is blended across four pixels, the weapon and upper 155 rows are preserved, and both feet face right at the same baseline. It was checked at 256 px, 96 px and 6 fps. Gravewarden walk B transfers the gravewarden’s own idle-cell lower stance under the unchanged walk upper: its armoured near leg trails left and the other leg leads right, with right-facing toes. The apron covers a four-pixel hip blend; the upper 169 rows and exact frame bounds match walk A. It was inspected at 256 px, 96 px and 6 fps. Drafts that repeated the same leading leg or broke the boots were rejected before import. The arbalest remains on `walk: [0]`. The 8 defects above add to, rather than replace, the manifest entries still using idle as their walk.

## Acceptance gate for each new or repaired sheet

1. Trace both thighs from hip to knee to boot in each frame. Walk A must lead with one anatomical leg, walk B with the other. A higher knee on the same leg fails.
2. Check at actual game size that both silhouettes, knee bends, boot placements, and thigh overlap make the reversal visible. Boot-color markers alone do not prove this: generated drafts swapped ribbon colors while preserving leg geometry.
3. For flying units, verify a true alternate wing pose at the wing roots, with complete consistent silhouettes.
4. Confirm equal scale, ground baseline, right-facing direction, character identity, transparent background, and no cell spill. Preserve idle, attack, and death art.
5. Only after visual approval update the manifest to five cells and `walk: [1, 2]`. Run typecheck, Vitest, `art:test:painted`, `art:test:links`, and `art:test:regions` before every art push; verify the remote branch ref.

This is an audit of existing assets and does not itself alter runtime art.