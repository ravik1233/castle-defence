"""Build compact three-pose sheets from the approved regional paintings.

The regional source boards provide one polished full-body pose per character.
Until bespoke walk cycles are commissioned, the game uses that pose for idle
and walking. This tool adds readable presentation states without inventing new
character designs: a forward impact pose for attack/cast and a grounded fallen
pose for death.

Run one campaign region at a time so each output batch can be tested and pushed
as an independent checkpoint::

    python3 scripts/pack-region-actions.py 2
"""

from __future__ import annotations

from pathlib import Path
import json
import sys

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
PAINTED = ROOT / "public/assets/painted"
CELL = 256

REGIONS = {
    2: [
        "dwarf_warrior", "runesmith", "gravewarden", "bran",
        "skeleton", "skeleton_archer", "zombie", "ghoul",
        "grave_raven", "vampire", "bone_golem", "lich", "necromancer",
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
        "gatebreaker",
    ],
}


def alpha_bbox(image: Image.Image):
    return image.getchannel("A").getbbox()


def fitted(image: Image.Image, max_w: int, max_h: int) -> Image.Image:
    box = alpha_bbox(image)
    if not box:
        raise ValueError("source has no visible pixels")
    crop = image.crop(box)
    scale = min(max_w / crop.width, max_h / crop.height)
    return crop.resize(
        (max(1, round(crop.width * scale)), max(1, round(crop.height * scale))),
        Image.Resampling.LANCZOS,
    )


def paste_grounded(cell: Image.Image, pose: Image.Image, x_bias: int = 0, ground: int = 10):
    x = (CELL - pose.width) // 2 + x_bias
    x = max(5, min(CELL - pose.width - 5, x))
    y = CELL - ground - pose.height
    cell.alpha_composite(pose, (x, y))


def make_sheet(source: Image.Image) -> Image.Image:
    source = source.convert("RGBA")
    idle = fitted(source, 224, 232)

    # A small forward lean and advance makes the impact state read clearly at
    # phone size while preserving the approved costume and silhouette.
    attack = fitted(source, 224, 226).rotate(
        -7, resample=Image.Resampling.BICUBIC, expand=True
    )
    attack = fitted(attack, 232, 226)

    # Rotate the same painting into an unmistakable grounded silhouette. The
    # wider allowance keeps long weapons and wings inside their own frame.
    death = fitted(source, 218, 218).rotate(
        84, resample=Image.Resampling.BICUBIC, expand=True
    )
    death = fitted(death, 238, 112)

    sheet = Image.new("RGBA", (CELL * 3, CELL), (0, 0, 0, 0))
    idle_cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    attack_cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    death_cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    paste_grounded(idle_cell, idle)
    paste_grounded(attack_cell, attack, x_bias=9)
    paste_grounded(death_cell, death, ground=8)
    sheet.alpha_composite(idle_cell, (0, 0))
    sheet.alpha_composite(attack_cell, (CELL, 0))
    sheet.alpha_composite(death_cell, (CELL * 2, 0))
    return sheet


def frame_spec(filename: str) -> dict:
    return {
        "sheet": filename,
        "count": 3,
        "width": CELL,
        "height": CELL,
        "groundOffset": 10,
        "names": ["idle", "attack", "death"],
        "animations": {
            "idle": {"frames": [0], "fps": 3},
            "walk": {"frames": [0], "fps": 3},
            "attack": {"frames": [1, 0], "fps": 7},
            "cast": {"frames": [1, 0], "fps": 7},
            "hurt": {"frames": [0], "fps": 4},
            "spawn": {"frames": [0], "fps": 4},
            "die": {"frames": [2], "fps": 3},
        },
    }


def main() -> None:
    if len(sys.argv) != 2 or not sys.argv[1].isdigit():
        raise SystemExit("usage: python3 scripts/pack-region-actions.py <region-number>")
    region = int(sys.argv[1])
    ids = REGIONS.get(region)
    if not ids:
        raise SystemExit(f"region {region} is not mapped yet; add it only when that checkpoint starts")

    manifest_path = PAINTED / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    written = []
    for art_id in ids:
        source_name = manifest.get(f"unit.{art_id}.full")
        if not isinstance(source_name, str):
            # Preserve superior hand-authored sheets already carrying their
            # own idle/walk/attack/death frames.
            if isinstance(manifest.get(f"unit.{art_id}.frames"), dict):
                print(f"{art_id}: kept existing authored frame sheet")
                continue
            raise SystemExit(f"unit.{art_id}.full is missing from the painted manifest")
        source_path = PAINTED / source_name
        if not source_path.is_file() or source_path.stat().st_size == 0:
            raise SystemExit(f"missing source: {source_path.relative_to(ROOT)}")
        filename = f"unit.{art_id}.region{region}.actions.png"
        make_sheet(Image.open(source_path)).save(PAINTED / filename, optimize=True)
        manifest[f"unit.{art_id}.frames"] = frame_spec(filename)
        written.append(filename)

    manifest[f"_region_{region}_actions"] = (
        "Three-pose presentation sheets: idle, impact/cast, and fallen death. "
        "Walking intentionally uses idle until bespoke walk cycles are approved."
    )
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Region {region}: wrote {len(written)} action sheets")


if __name__ == "__main__":
    main()
