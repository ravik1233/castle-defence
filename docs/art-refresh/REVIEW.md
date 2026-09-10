# Full-game refresh checkpoint

This refresh is unfinished and has not been deployed. Existing production art remains active.

Coverage: 103 unique character IDs, seven environments, five structure types, and four castle skins. `coverage.json` records current runtime assets; `inventory.json` preserves the original production plan.

Four candidate sheets are retained here: Guardian, Arbalest, Dwarf Engineer, and Goblin Bomber. Their transparent gutters passed the packer. This does not establish animation quality. Guardian still repeats the leading leg during walking and has colored edge contamination; a further generated correction did not resolve these defects. The other candidates require equivalent motion and edge review. Frostmage was rejected for overlapping glow and is not included.

Candidates were generated with the built-in image generation tool using this prompt pattern: a premium stylized, expressive, right-facing character; transparent 4×4 sheet; four idle poses, four alternating contact/passing walk poses, four weapon attack poses, recoil, neutral spawn, falling and prone death; consistent scale and generous clear gutters. The Guardian correction explicitly requested opposite leading legs in the contact poses and removal of colored edge contamination.

`node --experimental-strip-types scripts/art-catalog.mjs` refreshes coverage.
`node scripts/import-refresh.mjs source.png character_id` packs a candidate here using shared scale and bottom alignment. It rejects occupied gutters. The optional `--activate` writes to production and updates the manifest; use only after visual review. Bounding-box centering still needs body-anchor calibration for weapon extension, so activation alone is not a production-quality gate.

Remaining: correct and review real walk cycles and stable body anchors, complete missing character/structure/environment/UI art, inspect at phone scale, measure texture memory, validate the build, then publish and verify GitHub Pages. No claim of full-game completion is warranted by this checkpoint.
