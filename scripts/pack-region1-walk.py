"""Pack an exactly-two-panel Region 1 walk sheet into fixed-size frames."""
from pathlib import Path
import json
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

unit, source_path = sys.argv[1], Path(sys.argv[2])
root = Path(__file__).resolve().parents[1]
out = root / 'art/region1/animations' / unit
out.mkdir(parents=True, exist_ok=True)
source = Image.open(source_path).convert('RGB')
w, h = source.size
frames = []
for i, leg in enumerate(('left-forward', 'right-forward')):
    a = np.array(source.crop((i*w//2, 0, (i+1)*w//2, h))).astype(np.int16)
    border = np.concatenate((a[:12].reshape(-1,3), a[-12:].reshape(-1,3), a[:,:12].reshape(-1,3), a[:,-12:].reshape(-1,3)))
    bg = np.median(border, axis=0)
    foreground = np.sqrt(((a-bg)**2).sum(axis=2)) > 24
    labels, _ = ndi.label(~foreground)
    edge = np.unique(np.concatenate((labels[0], labels[-1], labels[:,0], labels[:,-1])))
    mask = ~np.isin(labels, edge)
    mask = ndi.binary_opening(mask, iterations=1)
    mask = ndi.binary_closing(mask, iterations=2)
    alpha = Image.fromarray((mask*255).astype('uint8')).filter(ImageFilter.GaussianBlur(.7))
    im = Image.fromarray(a.clip(0,255).astype('uint8')).convert('RGBA')
    im.putalpha(alpha)
    im.thumbnail((244,244), Image.Resampling.LANCZOS)
    frame = Image.new('RGBA',(256,256)); frame.alpha_composite(im,((256-im.width)//2,(256-im.height)//2))
    frame.save(out/f'{leg}.png', optimize=True)
    frames.append(frame)
sheet = Image.new('RGBA',(512,256))
for i, frame in enumerate(frames): sheet.alpha_composite(frame,(i*256,0))
sheet.save(out/'walk.png', optimize=True)
preview=[]
for frame in frames:
    bg=Image.new('RGBA',frame.size,'#344936'); bg.alpha_composite(frame); preview.append(bg.convert('RGB'))
preview[0].save(out/'walk.gif',save_all=True,append_images=preview[1:],duration=180,loop=0)
(out/'walk.json').write_text(json.dumps({'sheet':'walk.png','width':256,'height':256,'count':2,'animations':{'walk':{'frames':[0,1],'fps':5.55}},'frames':[{'file':'left-forward.png','leg':'left-forward'},{'file':'right-forward.png','leg':'right-forward'}],'status':'art-only review; not integrated'},indent=2)+'\n')
