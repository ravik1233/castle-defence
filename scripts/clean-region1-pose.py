from pathlib import Path
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
a = np.array(Image.open(src).convert('RGB')).astype(np.int16)
h, w = a.shape[:2]
border = np.concatenate((a[:12].reshape(-1, 3), a[-12:].reshape(-1, 3), a[:, :12].reshape(-1, 3), a[:, -12:].reshape(-1, 3)))
bg = np.median(border, axis=0)
dist = np.sqrt(((a - bg) ** 2).sum(axis=2))
foreground = dist > 24
# Only remove background-connected pixels. This keeps pale armor and skin.
background = ~foreground
labels, _ = ndi.label(background)
edge = np.unique(np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1])))
remove = np.isin(labels, edge)
mask = ~remove
mask = ndi.binary_opening(mask, iterations=1)
mask = ndi.binary_closing(mask, iterations=2)
alpha = Image.fromarray((mask * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(0.7))
out = Image.fromarray(a.clip(0, 255).astype('uint8')).convert('RGBA')
out.putalpha(alpha)
dst.parent.mkdir(parents=True, exist_ok=True)
out.save(dst, optimize=True)
