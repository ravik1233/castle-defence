from pathlib import Path
import json
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

root=Path(__file__).resolve().parents[1]/'art/region1/animations/goblin'
out=root/'actions'
clips={}
for name,source,keep,scale in [('idle','idle',range(4),.36),('attack','attack',range(4),.40),('death','reactions',[2,3],.36)]:
    a=np.array(Image.open(root/'candidates'/f'{source}-source.png').convert('RGB'))
    white=(a.min(2)>226)&(a.max(2).astype(int)-a.min(2)<28)
    # Connected silhouettes allow the attack blade to cross the nominal grid
    # midpoint without slicing it off. Retain the four large character bodies.
    labels,n=ndi.label(~white)
    sizes=np.bincount(labels.ravel());sizes[0]=0
    ids=np.argsort(sizes)[-4:]
    bodies=[]
    for k in ids:
        yy,xx=np.where(labels==k)
        bodies.append((int(yy.min()),int(xx.min()),int(yy.max()+1),int(xx.max()+1),int(k)))
    bodies.sort(key=lambda b:b[0])
    bodies=sorted(bodies[:2],key=lambda b:b[1])+sorted(bodies[2:],key=lambda b:b[1])
    frames=[]
    for i in keep:
        y0,x0,y1,x1,k=bodies[i]
        mask=ndi.binary_closing(labels[y0:y1,x0:x1]==k,iterations=2)
        mask=ndi.binary_erosion(mask,iterations=1)
        # White gaps between limbs remain transparent; preserve enclosed metal highlights.
        alpha=Image.fromarray((mask*255).astype('uint8')).filter(ImageFilter.GaussianBlur(.45))
        rgb=a[y0:y1,x0:x1].copy()
        core=ndi.binary_erosion(mask,iterations=2)
        _,nearest=ndi.distance_transform_edt(~core,return_indices=True)
        rgb[~core]=rgb[nearest[0][~core],nearest[1][~core]]
        im=Image.fromarray(rgb).convert('RGBA');im.putalpha(alpha)
        im=im.resize((round(im.width*scale),round(im.height*scale)),Image.Resampling.LANCZOS)
        if im.width>304 or im.height>304:raise ValueError(f'{name} frame too large')
        frame=Image.new('RGBA',(320,320))
        frame.alpha_composite(im,((320-im.width)//2,304-im.height))
        frame.save(out/f'{name}-{len(frames)}.png');frames.append(frame)
    sheet=Image.new('RGBA',(320*len(frames),320))
    previews=[]
    for i,f in enumerate(frames):
        sheet.alpha_composite(f,(320*i,0))
        bg=Image.new('RGBA',f.size,'#344936');bg.alpha_composite(f);previews.append(bg.convert('RGB'))
    sheet.save(out/f'{name}.png',optimize=True)
    durations={'idle':[650,180,110,400],'attack':[150,100,130,260],'death':[220,1100]}[name]
    previews[0].save(out/f'{name}.gif',save_all=True,append_images=previews[1:],duration=durations,loop=0)
    clips[name]={'sheet':f'{name}.png','count':len(frames),'width':320,'height':320,'durationMs':durations}
(out/'clips.json').write_text(json.dumps({'clips':clips,'walking':'deferred by user','deployment':'not integrated'},indent=2)+'\n')
print('Packed idle (4), attack (4), death (2)')
