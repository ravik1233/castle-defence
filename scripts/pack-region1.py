"""Pack Region 1's cut poses and walk frames into runtime sprite sheets.

The generator gives one large image per pose, at whatever size it felt like,
each with the character standing somewhere in the frame. The runtime wants a
fixed grid of equal cells sharing a ground line, so a unit does not grow,
shrink or hop between frames.

So per unit: one scale for every frame, chosen from the tallest of them;
every frame bottom-aligned on the same ground line; and each centred on the
x-centroid of its own feet rather than its bounding box, because a raised
weapon shifts a bounding box sideways and would make the character slide
across the cell when it swings.

    python3 scripts/pack-region1.py            # every unit
    python3 scripts/pack-region1.py militia    # one
"""
from pathlib import Path
import json
import sys

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
POSES = ROOT / 'art/region1/poses'
ANIMS = ROOT / 'art/region1/animations'
OUT = ROOT / 'public/assets/painted'

CELL = 256
#: Transparent pixels kept below the feet, so a unit is not flush to the edge.
GROUND = 10
#: Clear pixels at each side of a cell, so no frame bleeds into its neighbour.
GUTTER = 6
#: The tallest frame fills this much of the cell above the ground line.
FILL = 0.88


def bbox(a: np.ndarray) -> tuple[int, int, int, int] | None:
    ys, xs = np.nonzero(a[..., 3] > 12)
    if not len(ys):
        return None
    return xs.min(), ys.min(), xs.max() + 1, ys.max() + 1


def feet_x(a: np.ndarray, box: tuple[int, int, int, int]) -> float:
    """Horizontal centre of the bottom fifth of the silhouette."""
    x0, y0, x1, y1 = box
    cut = y1 - max(1, (y1 - y0) // 5)
    ys, xs = np.nonzero(a[cut:y1, :, 3] > 12)
    return float(xs.mean()) if len(xs) else (x0 + x1) / 2


def load_frames(unit: str) -> tuple[list[Image.Image], list[str]]:
    """Idle, the two walk contacts if they exist, attack, then death."""
    frames: list[Image.Image] = []
    names: list[str] = []

    idle = POSES / unit / 'idle.png'
    if idle.exists():
        frames.append(Image.open(idle).convert('RGBA'))
        names.append('idle')

    walk = ANIMS / unit / 'walk.png'
    if walk.exists():
        sheet = Image.open(walk).convert('RGBA')
        half = sheet.width // 2
        for i, side in enumerate(('walk_a', 'walk_b')):
            frames.append(sheet.crop((i * half, 0, (i + 1) * half, sheet.height)))
            names.append(side)

    for pose in ('attack', 'death'):
        p = POSES / unit / f'{pose}.png'
        if p.exists():
            frames.append(Image.open(p).convert('RGBA'))
            names.append(pose)
    return frames, names


def pack(unit: str) -> dict | None:
    frames, names = load_frames(unit)
    if not frames:
        return None

    arrays = [np.array(f) for f in frames]
    boxes = [bbox(a) for a in arrays]
    keep = [(f, a, b, n) for f, a, b, n in zip(frames, arrays, boxes, names) if b]
    if not keep:
        return None

    # Scale so the character stands the same height in every cell, which is
    # not the same as one scale factor everywhere: the poses are ~1300px
    # renders and the walk contacts are 256px sheet cells, so a single factor
    # sized for the poses shrank every walk frame to a speck. Each source
    # group gets the factor that puts its *standing* figure at the target
    # height, and the prone death rides on the pose group's factor rather
    # than being blown up to fill the cell on its own.
    def group_scale(names: set[str]) -> float:
        upright = [b for _, _, b, n in keep if n in names]
        if not upright:
            return 1.0
        tall = max(b[3] - b[1] for b in upright)
        wide = max(b[2] - b[0] for b in upright)
        return min((CELL * FILL) / tall, (CELL * 0.94) / wide)

    pose_scale = group_scale({'idle', 'attack'})
    walk_scale = group_scale({'walk_a', 'walk_b'})

    sheet = Image.new('RGBA', (CELL * len(keep), CELL), (0, 0, 0, 0))
    for i, (frame, arr, box, name) in enumerate(keep):
        scale = walk_scale if name.startswith('walk') else pose_scale
        x0, y0, x1, y1 = box
        inner = CELL - 2 * GUTTER

        def sized(s: float) -> tuple[int, int]:
            return max(1, int(round((x1 - x0) * s))), max(1, int(round((y1 - y0) * s)))

        w, h = sized(scale)
        # A death sprawls wider than it is tall; shrink it to fit rather than
        # let it run over its neighbour.
        if w > inner:
            scale *= inner / w
            w, h = sized(scale)
        if h > CELL - GROUND - GUTTER:
            scale *= (CELL - GROUND - GUTTER) / h
            w, h = sized(scale)

        cropped = frame.crop(box).resize((w, h), Image.LANCZOS)
        anchor = (feet_x(arr, box) - x0) * scale
        left = int(round(CELL / 2 - anchor))
        # Centred on the feet, but never outside its own cell. Without this a
        # prone death - whose feet are at one end of a sprawl - was pushed far
        # enough sideways that its head was cut off at the cell edge and the
        # frame beside it picked up the remains.
        left = max(GUTTER, min(CELL - GUTTER - w, left))
        sheet.paste(cropped, (i * CELL + left, CELL - GROUND - h), cropped)

    # Nothing may touch a cell edge. A frame that does bleeds into the one
    # beside it and comes back cut: the militia shipped with its face sliced
    # off at the seam because a sprawled death ran over the boundary.
    packed = np.array(sheet)
    for i, (_, _, _, name) in enumerate(keep):
        cell = packed[:, i * CELL:(i + 1) * CELL, 3] > 12
        if not cell.any():
            raise SystemExit(f'{unit}/{name}: packed to nothing')
        xs = np.nonzero(cell.any(axis=0))[0]
        ys = np.nonzero(cell.any(axis=1))[0]
        if xs.min() < 1 or xs.max() > CELL - 2 or ys.min() < 1:
            raise SystemExit(
                f'{unit}/{name}: touches its cell edge '
                f'(x {xs.min()}-{xs.max()}, top {ys.min()}) - it would bleed into its neighbour'
            )

    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f'unit.{unit}.region1.png', optimize=True)

    idx = {n: i for i, (_, _, _, n) in enumerate(keep)}
    walk = [idx[n] for n in ('walk_a', 'walk_b') if n in idx] or [idx.get('idle', 0)]
    hit = idx.get('attack', idx.get('idle', 0))
    down = idx.get('death', hit)
    still = idx.get('idle', 0)
    return {
        'sheet': f'unit.{unit}.region1.png',
        'count': len(keep),
        'width': CELL,
        'height': CELL,
        'groundOffset': GROUND,
        'names': [n for _, _, _, n in keep],
        'animations': {
            'idle': {'frames': [still], 'fps': 3},
            'walk': {'frames': walk, 'fps': 6},
            # Swing, then back to the ready pose, so a two-image attack reads
            # as a blow landing rather than a held position.
            'attack': {'frames': [hit, still], 'fps': 7},
            'cast': {'frames': [hit, still], 'fps': 7},
            'hurt': {'frames': [still], 'fps': 4},
            'spawn': {'frames': [still], 'fps': 4},
            'die': {'frames': [down], 'fps': 3},
        },
    }


def main() -> None:
    wanted = sys.argv[1:] or sorted(p.name for p in POSES.iterdir() if p.is_dir())
    entries = {}
    for unit in wanted:
        spec = pack(unit)
        if spec:
            entries[f'unit.{unit}.frames'] = spec
            print(f'{unit}: {spec["count"]} frames ({", ".join(spec["names"])})')
        else:
            print(f'{unit}: no usable poses, skipped')

    manifest_path = OUT / 'manifest.json'
    manifest = json.loads(manifest_path.read_text())
    manifest.update(entries)
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'\n{len(entries)} units written into {manifest_path.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
