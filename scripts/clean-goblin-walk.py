"""Remove alpha-edge contamination and pack the four authored walk poses."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

root = Path(__file__).resolve().parents[1]
out = root / 'art/region1/animations/goblin'
source = Image.open(out / 'candidates/walk-four-alpha.png').convert('RGBA')
w, h = source.size
frames = []
for i in range(4):
    x, y = i % 2, i // 2
    cell = source.crop((round(x*w/2), round(y*h/2), round((x+1)*w/2), round((y+1)*h/2)))
    pixels = np.array(cell)
    mask = pixels[:, :, 3] > 32
    # Keep the character; discard detached colored specks in transparent gutters.
    labels, count = ndi.label(mask)
    sizes = np.bincount(labels.ravel()); sizes[0] = 0
    mask = labels == sizes.argmax()
    # The generated fringe hugs the silhouette; opening removes narrow spikes.
    mask = ndi.binary_opening(mask, iterations=2)
    mask = ndi.binary_erosion(mask, iterations=2)
    # Reconstruct boundary RGB from the nearest interior pixel; this removes
    # matte colors without deleting legitimate red scarf material in the core.
    core = ndi.binary_erosion(mask, iterations=5)
    _, nearest = ndi.distance_transform_edt(~core, return_indices=True)
    edge = ~core
    pixels[edge, :3] = pixels[nearest[0][edge], nearest[1][edge], :3]
    alpha = Image.fromarray((mask*255).astype('uint8')).filter(ImageFilter.GaussianBlur(.55))
    pixels[:, :, 3] = np.minimum(pixels[:, :, 3], np.array(alpha))
    cleaned = Image.fromarray(pixels)
    # All poses use the same source-cell scale, never independent bbox scaling.
    cleaned.thumbnail((244,244), Image.Resampling.LANCZOS)
    frame = Image.new('RGBA',(256,256))
    frame.alpha_composite(cleaned, ((256-cleaned.width)//2, (256-cleaned.height)//2))
    frames.append(frame)

sheet = Image.new('RGBA',(1024,256))
for i, frame in enumerate(frames):
    sheet.alpha_composite(frame,(i*256,0))
sheet.save(out/'walk.png', optimize=True)
preview = []
for frame in frames:
    bg=Image.new('RGBA',frame.size,'#344936')
    bg.alpha_composite(frame)
    preview.append(bg.convert('RGB'))
preview[0].save(out/'walk-clean.gif',save_all=True,append_images=preview[1:],duration=140,loop=0)
(out/'walk.json').write_text(json.dumps({'sheet':'walk.png','width':256,'height':256,'count':4,'animations':{'walk':{'frames':[0,1,2,3],'fps':7.14}},'facing':'right','status':'cleaned art; not integrated'},indent=2)+'\n')
print('Saved transparent walk.png, walk.json and walk-clean.gif')
