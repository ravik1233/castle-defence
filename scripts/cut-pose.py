"""Cut a studio-background character pose out onto transparency.

Used on the handful of poses whose shipped cut came out inverted - the mask
ate the subject and left a few fragments of shadow. Everything else keeps the
cut it already has, which is good, and this tool should not be pointed at it.

The rule here is deliberately timid: remove only backdrop that is connected
to the border of the frame, and never remove anything enclosed by the
character. An earlier version of this file was cleverer - it also dropped
large enclosed pockets matching the backdrop colour, so the daylight inside a
drawn bow came out transparent - and that cleverness punched holes straight
through helmets, chest plates and faces, because bare steel and lit skin sit
well inside the tolerance a grey wolf needs. A little backdrop left inside a
bow is a far smaller fault than a hole in someone's face.

    python3 scripts/cut-pose.py in.png out.png
"""
from pathlib import Path
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

#: What fraction of the frame a real character occupies. Below the floor the
#: mask has eaten the subject; above the ceiling it has kept the backdrop.
MIN_COVER, MAX_COVER = 0.05, 0.72


def cut(rgb: np.ndarray, tol: float) -> np.ndarray:
    """Mask of the subject at this backdrop tolerance."""
    border = np.concatenate((
        rgb[:8].reshape(-1, 3), rgb[-8:].reshape(-1, 3),
        rgb[:, :8].reshape(-1, 3), rgb[:, -8:].reshape(-1, 3),
    ))
    bg = np.median(border, axis=0)
    near = np.sqrt(((rgb - bg) ** 2).sum(axis=2)) < tol

    # Backdrop is only what reaches the edge of the frame. Anything the
    # character encloses stays, whatever colour it is.
    labels, _ = ndi.label(near)
    edge = np.unique(np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1])))
    backdrop = np.isin(labels, edge[edge != 0])

    mask = ndi.binary_opening(~backdrop, iterations=2)
    if not mask.any():
        return mask
    # Keep the biggest piece; drop the shadow blobs lying beside the feet.
    parts, _ = ndi.label(mask)
    sizes = np.bincount(parts.ravel())
    sizes[0] = 0
    return parts == sizes.argmax()


def main() -> None:
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    rgb = np.array(Image.open(src).convert('RGB')).astype(np.int16)

    best = None
    for tol in (16, 22, 28, 34, 40, 48, 56, 66, 78, 92):
        mask = cut(rgb, tol)
        cover = mask.mean()
        if MIN_COVER <= cover <= MAX_COVER:
            best = mask
            # Keep widening while coverage stays plausible: a larger tolerance
            # clears more of the backdrop haze around the silhouette.
            continue
        if best is not None and cover < MIN_COVER:
            break
    if best is None:
        raise SystemExit(f'{src}: no tolerance produced a plausible subject')

    alpha = Image.fromarray((best * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.6))
    out = Image.fromarray(rgb.clip(0, 255).astype('uint8')).convert('RGBA')
    out.putalpha(alpha)
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst, optimize=True)
    print(f'{src.parent.parent.name}/{src.stem}: {best.mean() * 100:.1f}% opaque')


if __name__ == '__main__':
    main()
