# Walk-cycle visual QA — 2026-09-26

The manifest's `walk: [1, 2]` metadata alone does not prove alternate legs. Inspect the actual silhouettes and trace each leg from hip to boot (or each wing from its root to tip) before accepting a cycle.

## Confirmed defects

| Sheet | Finding |
| --- | --- |
| `unit.militia.walk.png` | Both walk cells keep the image-right leg leading; the second raises that same leg. |
| `unit.archer.walk.png` | Both walk cells keep the image-right leg leading; the second raises that same leg. |
| `unit.guardian.walk.png` | Both walk cells keep the image-right leg leading; the second raises that same leg. |
| `unit.dwarf_warrior.region2.walk.png` | The same leg appears ahead in both walk cells. |
| `unit.skeleton.region2.walk.png` | The same leg appears ahead in both walk cells. |
| `unit.ghoul.region2.walk.png` | The leading leg does not alternate in the two walk cells. |
| `unit.vampire.region2.walk.png` | The same leg appears ahead in both walk cells. |

The other Region 2 sheets and all remaining existing walk sheets still require the same visual review. A proposed arbalest two-pose draft also repeated the lead leg and was rejected before import.

## Acceptance gate for each new or repaired sheet

1. Identify the anatomical left and right leg in both frames, tracing the thigh from the hip through knee to boot. Do not infer identity from a boot ribbon alone: image generation can swap colors between identical poses.
2. Walk A must lead with one anatomical leg; walk B must lead with the other. Compare the knee bend, boot placement, occlusion at the thighs, and overall silhouette at actual game size.
3. Confirm equal scale, ground baseline, right-facing direction, character identity, transparent background, and no cell spill.
4. Preserve idle, attack, and death art. Only update the manifest to `count: 5`, five frame names, and `walk: [1, 2]` after the image passes visual review.
5. Run typecheck, Vitest, and `art:test:painted`, `art:test:links`, `art:test:regions` before every art push. Verify the remote branch ref after the checkpoint.

Do not count the seven defective sheets as completed walk cycles until repaired.
