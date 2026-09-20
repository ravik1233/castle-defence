"""Fail CI when a completed regional action checkpoint loses coverage."""

from pathlib import Path
import json
import sys

ROOT = Path(__file__).resolve().parents[1]
PAINTED = ROOT / "public/assets/painted"
REGIONS = {
    2: [
        "dwarf_warrior", "runesmith", "gravewarden", "bran",
        "skeleton", "skeleton_archer", "zombie", "ghoul", "grave_raven",
        "vampire", "bone_golem", "lich", "necromancer",
    ],
    3: [
        "elf_ranger", "elf_spellweaver", "moonblade", "faelith",
        "treesinger", "hawkkeeper", "orc_shaman", "wyvern_rider",
        "orc_axethrower", "orc_powderkeg", "orc_berserker", "orc_ironback",
        "orc", "troll", "orc_warlord", "gatebreaker",
    ],
    4: [
        "warden", "netcaster", "houndmaster", "seraphina",
        "dire_wolf", "boar", "harpy", "giant_spider", "cave_bear",
        "beastlord", "thornback", "packmother", "spitting_lizard",
    ],
    5: [
        "harpooner", "tidecaller", "deepwatch", "nerion",
        "drowned_sailor", "reef_crawler", "siren", "tide_raider",
        "deep_serpent", "tide_witch", "barnacle_hulk", "abyss_wisp",
        "kelp_thrall",
    ],
    6: [
        "templar", "pavise", "shieldbreaker", "garrick", "confessor",
        "fallen_crossbow", "fallen_knight", "black_guard", "cultist",
        "inquisitor", "betrayer", "sworn_lance", "spearwall",
        "watchman", "bell_chanter", "black_hawk", "martyr",
    ],
    7: [
        "warleader", "kingsguard", "maerwyn", "hellhound",
        "portal_fiend", "succubus", "balor", "demon_prince",
        "hell_bombardier", "brimstone_ogre", "soul_harvester",
    ],
}

# Gatebreaker is siege art rather than a humanoid rig, but its idle, firing,
# and destroyed poses are authored and validated with the Region 3 roster.

CLIMAX_ACTIONS = {
    "demon_king": "unit.demon_king.region7.actions.png",
    "shadow_fiend": "unit.shadow_fiend.region7.actions.png",
    "plague_bat": "unit.plague_bat.region2.actions.png",
}

manifest = json.loads((PAINTED / "manifest.json").read_text())
errors = []
if "_art_aliases" in manifest:
    errors.append("legacy art aliases must not replace authored regional artwork")
verified = 0
for region, art_ids in REGIONS.items():
 for art_id in art_ids:
        spec = manifest.get(f"unit.{art_id}.frames")
        if not isinstance(spec, dict):
            errors.append(f"region {region}/{art_id}: missing frame manifest")
            continue
        expected = ["idle", "attack", "death"]
        names = spec.get("names", [])
        authored = (
            isinstance(names, list)
            and "idle" in names
            and "attack" in names
            and ("death" in names or "die" in names)
        )
        compact = names == expected and spec.get("count") == 3
        if not compact and not authored:
            errors.append(f"region {region}/{art_id}: missing idle, attack, or death presentation pose")
        sheet_name = spec.get("sheet")
        if isinstance(sheet_name, str):
            sheet = PAINTED / sheet_name
            if not sheet.is_file() or sheet.stat().st_size == 0:
                errors.append(f"region {region}/{art_id}: missing or empty sheet {sheet.name}")
        elif authored:
            frame_name = manifest.get(f"unit.{art_id}.frame0")
            frame = PAINTED / str(frame_name or "")
            if not frame.is_file() or frame.stat().st_size == 0:
                errors.append(f"region {region}/{art_id}: authored frame files are missing")
        else:
            errors.append(f"region {region}/{art_id}: no sheet file declared")
        animations = spec.get("animations", {})
        if compact and animations.get("walk", {}).get("frames") != [0]:
            errors.append(f"region {region}/{art_id}: walking must remain on the approved idle pose")
        if compact and animations.get("die", {}).get("frames") != [2]:
            errors.append(f"region {region}/{art_id}: death must use the fallen pose")
        verified += 1

for art_id, expected_sheet in CLIMAX_ACTIONS.items():
    spec = manifest.get(f"unit.{art_id}.frames")
    if not isinstance(spec, dict):
        errors.append(f"climax/{art_id}: missing frame manifest")
        continue
    if spec.get("sheet") != expected_sheet:
        errors.append(f"climax/{art_id}: expected action sheet {expected_sheet}")
    if spec.get("names") != ["idle", "attack", "death"]:
        errors.append(f"climax/{art_id}: expected idle, attack, and death poses")
    sheet = PAINTED / expected_sheet
    if not sheet.is_file() or sheet.stat().st_size == 0:
        errors.append(f"climax/{art_id}: missing or empty sheet {expected_sheet}")
    verified += 1

if errors:
    print("\n".join(errors), file=sys.stderr)
    raise SystemExit(1)
print(f"Regional action coverage verified for {verified} characters")
