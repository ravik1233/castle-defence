"""Verify every runtime-painted asset declared by the manifest is intact."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAINTED = ROOT / "public/assets/painted"
MANIFEST = PAINTED / "manifest.json"


def declared_files(manifest: dict[str, object]) -> set[str]:
    files: set[str] = set()
    for key, value in manifest.items():
        if key.startswith("_"):
            continue
        if isinstance(value, str):
            files.add(value)
        elif key.endswith(".frames") and isinstance(value, dict):
            sheet = value.get("sheet")
            if isinstance(sheet, str):
                files.add(sheet)
    return files


def image_error(path: Path) -> str | None:
    size = path.stat().st_size
    if size == 0:
        return "is empty"
    with path.open("rb") as handle:
        header = handle.read(12)
        handle.seek(max(0, size - 12))
        footer = handle.read()
    suffix = path.suffix.lower()
    if suffix == ".png":
        if not header.startswith(b"\x89PNG\r\n\x1a\n"):
            return "has an invalid PNG header"
        if footer != b"\x00\x00\x00\x00IEND\xaeB`\x82":
            return "is a truncated PNG"
    elif suffix == ".webp":
        if header[:4] != b"RIFF" or header[8:12] != b"WEBP":
            return "has an invalid WebP header"
        if int.from_bytes(header[4:8], "little") + 8 != size:
            return "is a truncated WebP"
    return None


def main() -> None:
    manifest = json.loads(MANIFEST.read_text())
    errors: list[str] = []
    files = declared_files(manifest)
    for filename in sorted(files):
        path = PAINTED / filename
        if not path.is_file():
            errors.append(f"{filename}: missing")
            continue
        error = image_error(path)
        if error:
            errors.append(f"{filename}: {error}")
    if errors:
        raise SystemExit("\n".join(errors))
    print(f"Painted manifest verified for {len(files)} image files")


if __name__ == "__main__":
    main()
