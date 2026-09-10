"""Pack the original and crossed-thigh contacts as a two-frame walk."""
from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

out=Path(__file__).resolve().parents[1]/'art/region1/animations/goblin'
frames=[]
for name in ['contact_a.png','contact-crossed.png']:
    im=Image.open(out/'candidates'/name).convert('RGB')
    a=np.array(im)
    white=(a.min(axis=2)>228)&(a.max(axis=2).astype(int)-a.min(axis=2)<25)
    labels,_=ndi.label(white)
    borders=np.unique(np.concatenate([labels[0],labels[-1],labels[:,0],labels[:,-1]]))
    background=np.isin(labels,borders[borders!=0])
    mask=ndi.binary_erosion(~background,iterations=1)
    alpha=Image.fromarray((mask*255).astype('uint8')).filter(ImageFilter.GaussianBlur(.5))
    im.putalpha(alpha)
    im=im.resize((250,250),Image.Resampling.LANCZOS)
    frame=Image.new('RGBA',(256,256));frame.alpha_composite(im,(3,3))
    frames.append(frame)
sheet=Image.new('RGBA',(512,256))
for i,f in enumerate(frames):sheet.alpha_composite(f,(i*256,0))
sheet.save(out/'walk.png',optimize=True)
preview=[]
for f in frames:
    bg=Image.new('RGBA',(256,256),'#344936');bg.alpha_composite(f);preview.append(bg.convert('RGB'))
preview[0].save(out/'walk-clean.gif',save_all=True,append_images=preview[1:],duration=220,loop=0)
(out/'walk.json').write_text(json.dumps({'sheet':'walk.png','width':256,'height':256,'count':2,'animations':{'walk':{'frames':[0,1],'fps':4.5}},'facing':'right','status':'two contact poses; not deployed'},indent=2)+'\n')
