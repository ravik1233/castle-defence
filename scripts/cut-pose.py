"""Cut a studio-background character pose out onto transparency.

The first cutter thresholded every pixel against the backdrop colour and
removed whatever matched. That works until the character itself is pale: a
grey wolf, silver plate, a linen sleeve all sit inside the tolerance, so the
mask ate the character and left a handful of shadow fragments. Thirteen of
Region 1's fifty-one poses came out that way - an inverted cutout.

This one only removes backdrop that is *connected to the border*, then fills
the holes that leaves. A pale sleeve enclosed by the character's outline is
an interior hole and survives; the backdrop behind it does not touch the
border either, so it goes. The tolerance is chosen per image rather than
fixed: it sweeps upward and keeps the first mask whose coverage looks like a
character rather than a speck or the whole frame.

    python3 scripts/cut-pose.py in.png out.png
"""
from pathlib import Path
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

# What fraction of the frame a real character occupies. Below the floor the
# mask has eaten the subject; above the ceiling it has kept the backdrop.
MIN_COVER, MAX_COVER = 0.05, 0.72


def cut(rgb: np.ndarray, tol: float) -> np.ndarray:
    """Mask of the subject at this backdrop tolerance."""
    border = np.concatenate((
        rgb[:8].reshape(-1, 3), rgb[-8:].reshape(-1, 3),
        rgb[:, :8].reshape(-1, 3), rgb[:, -8:].reshape(-1, 3),
    ))
    bg = np.median(border, axis=0)
    near = np.sqrt(((rgb - bg) ** 2).sum(axis=2)) < tol

    # Backdrop is only what reaches the edge of the frame.
    labels, _ = ndi.label(near)
    edge = np.unique(np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1])))
    backdrop = np.isin(labels, edge[edge != 0])

    # Backdrop also shows through gaps that never reach the border: inside a
    # drawn bow, or the daylight between an arm and a body. Those are large
    # and backdrop-coloured, so drop them too - leaving them in turned the
    # archer's bow into a solid white paddle. Pinholes from anti-aliasing are
    # small, and get kept so the silhouette does not come out speckled.
    enclosed = near & ~backdrop
    parts, n = ndi.label(enclosed)
    if n:
        sizes = np.bincount(parts.ravel())
        big = np.flatnonzero(sizes > 0.0016 * near.size)
        backdrop = backdrop | np.isin(parts, big[big != 0])

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
            # Keep widening: a bigger tolerance removes more backdrop haze,
            # and coverage stays in band while it is only eating backdrop.
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
