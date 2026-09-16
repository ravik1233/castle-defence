"""Fail CI when a completed regional action checkpoint loses coverage."""

from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
PAINTED = ROOT / "public/assets/painted"
REGION_2 = [
    "dwarf_warrior", "runesmith", "gravewarden", "bran",
    "skeleton", "skeleton_archer", "zombie", "ghoul", "grave_raven",
    "vampire", "bone_golem", "lich", "necromancer",
]

manifest = json.loads((PAINTED / "manifest.json").read_text())
errors = []
for art_id in REGION_2:
    spec = manifest.get(f"unit.{art_id}.frames")
    if not isinstance(spec, dict):
        errors.append(f"{art_id}: missing frame manifest")
        continue
    expected = ["idle", "attack", "death"]
    if spec.get("names") != expected or spec.get("count") != 3:
        errors.append(f"{art_id}: expected three named poses {expected}")
    sheet = PAINTED / str(spec.get("sheet", ""))
    if not sheet.is_file() or sheet.stat().st_size == 0:
        errors.append(f"{art_id}: missing or empty sheet {sheet.name}")
    animations = spec.get("animations", {})
    if animations.get("walk", {}).get("frames") != [0]:
        errors.append(f"{art_id}: walking must remain on the approved idle pose")
    if animations.get("die", {}).get("frames") != [2]:
        errors.append(f"{art_id}: death must use the fallen pose")

if errors:
    print("\n".join(errors), file=sys.stderr)
    raise SystemExit(1)
print(f"Region 2 action coverage verified for {len(REGION_2)} characters")
