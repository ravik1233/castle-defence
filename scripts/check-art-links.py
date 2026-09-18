"""Fail CI when a character's dedicated painted art is left orphaned."""

from __future__ import annotations

import json
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "public/assets/painted/manifest.json"
DATA_FILES = (ROOT / "src/data/heroes.ts", ROOT / "src/data/enemies.ts")
ENTRY = re.compile(
    r"\bid:\s*'(?P<id>[^']+)'(?:(?!\n\s*}).)*?\bart:\s*'(?P<art>[^']+)'",
    re.DOTALL,
)
ART_SUFFIXES = ("frames", "rig", "full")


def dedicated_art_exists(manifest: dict[str, object], character_id: str) -> bool:
    return any(f"unit.{character_id}.{suffix}" in manifest for suffix in ART_SUFFIXES)


def main() -> None:
    manifest = json.loads(MANIFEST.read_text())
    errors: list[str] = []
    checked = 0

    for data_file in DATA_FILES:
        source = data_file.read_text()
        for match in ENTRY.finditer(source):
            character_id = match.group("id")
            art_id = match.group("art")
            checked += 1
            if dedicated_art_exists(manifest, character_id) and art_id != character_id:
                errors.append(
                    f"{data_file.relative_to(ROOT)}: {character_id!r} has dedicated painted art "
                    f"but points at {art_id!r}"
                )
            if not any(f"unit.{art_id}.{suffix}" in manifest for suffix in ART_SUFFIXES):
                errors.append(
                    f"{data_file.relative_to(ROOT)}: {character_id!r} points at missing art {art_id!r}"
                )

    if errors:
        raise SystemExit("\n".join(errors))
    print(f"Character art links verified for {checked} data entries")


if __name__ == "__main__":
    main()
