"""Bake the parapet the wall needs out of the painted wall art we have.

The painted wall is a front-facing castle facade, 420x1536, with a red banner
hanging down the top two thirds of it. It was authored as a backdrop for a
230-wide strip nobody could stand in.

The wall is two tiles of the grid now and units are posted on it, so that
image cannot be used as it is: stretched to 400x750 it squashes a 1:3.7
drawing into 1:1.9, which is what put the banner across the middle of the
wall looking like a flag planted on top of it.

Rows 1024 and below are clean stonework - no banner, no lantern - so this
takes that band, repeats it vertically at its own aspect ratio so nothing is
squashed, and writes a parapet the right shape for the wall. The stone is the
painted stone; only the framing changes.

    python3 scripts/bake-parapet.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PAINTED = ROOT / 'public/assets/painted'

#: First row of banner-free stonework in the source.
CLEAN_TOP = 1024
#: Size the wall is drawn at: two grid columns by five lanes.
OUT_W, OUT_H = 400, 750
#: Rows of the source holding the merlons, and the height they are drawn at.
CAP_ROWS, CAP_H = 150, 88


def main() -> None:
    src = Image.open(PAINTED / 'wall.stone.v2.png').convert('RGBA')
    band = src.crop((0, CLEAN_TOP, src.width, src.height))

    # Scale the band to the wall's width, keeping its own proportions so the
    # masonry stays the shape it was drawn.
    scale = OUT_W / band.width
    tile = band.resize((OUT_W, max(1, round(band.height * scale))), Image.LANCZOS)

    # Repeat upward from the bottom, so the course at the foot of the wall is
    # always a whole one and any part-tile is hidden up at the skyline. Each
    # copy after the first is feathered along its top edge, because a hard
    # repeat leaves a ruled line across the stonework where copies meet.
    blend = max(8, min(64, tile.height // 5))
    # White at the top of the band, black at the bottom: opaque where the
    # copy is solid, clear where it meets the one underneath.
    ramp = Image.linear_gradient('L').transpose(Image.FLIP_TOP_BOTTOM).resize((OUT_W, blend))

    def feathered() -> Image.Image:
        """The tile with its bottom `blend` rows fading out.

        The bottom, not the top: copies are laid from the floor upward and
        each one is drawn over the one below it, so the edge that shows is
        the one nearest the ground.
        """
        piece = tile.copy()
        alpha = piece.getchannel('A')
        foot = alpha.crop((0, tile.height - blend, OUT_W, tile.height))
        alpha.paste(Image.composite(foot, Image.new('L', foot.size, 0), ramp), (0, tile.height - blend))
        piece.putalpha(alpha)
        return piece

    soft = feathered()
    out = Image.new('RGBA', (OUT_W, OUT_H), (0, 0, 0, 0))
    y = OUT_H - tile.height
    out.alpha_composite(tile, (0, max(0, y)))
    while y > 0:
        y -= tile.height - blend
        out.alpha_composite(soft, (0, max(0, y)))

    out.save(PAINTED / 'wall.stone.parapet.png', optimize=True)
    print(f'wall.stone.parapet.png  {OUT_W}x{OUT_H} from {tile.height}px of painted stone')

    # The skyline above the lanes gets the real battlements off the top of the
    # source, where the merlons and the lantern are, rather than a flat block.
    cap = src.crop((0, 0, src.width, CAP_ROWS)).resize((OUT_W, CAP_H), Image.LANCZOS)
    cap.save(PAINTED / 'wall.stone.cap.png', optimize=True)
    print(f'wall.stone.cap.png      {OUT_W}x{CAP_H} from the battlements')


if __name__ == '__main__':
    main()
