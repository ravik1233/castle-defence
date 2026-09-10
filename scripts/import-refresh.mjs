// Pack a transparent 4x4 source with one shared scale and grounded feet.
// Refuses occupied gutters instead of silently cutting weapons or limbs.
import {execFileSync as run} from 'node:child_process';
import {readFileSync, writeFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const [input,id,...flags]=process.argv.slice(2);
const activate=flags.includes('--activate');
if(!input || !/^[a-z_]+$/.test(id)) throw Error('Usage: node scripts/import-refresh.mjs input.png art_id');
const [w,h]=run('identify',['-format','%w %h',input],{encoding:'utf8'}).split(' ').map(Number);
const alpha=run('convert',[input,'-alpha','extract','-depth','8','gray:-'],{maxBuffer:w*h*2});
const ink=(x,y)=>alpha[y*w+x]>16;
function split(expected,radius,counts){
 let best=-1,score=Infinity;
 for(let n=Math.max(1,Math.floor(expected-radius));n<Math.min(counts.length-1,expected+radius);n++){
  const s=counts[n]*10000+Math.abs(n-expected);
  if(s<score){score=s;best=n;}
 }
 if(counts[best]>2)throw Error(`No transparent gutter near ${expected}: ${counts[best]} occupied pixels`);
 return best;
}
const rowInk=Array.from({length:h},(_,y)=>{let n=0;for(let x=0;x<w;x++)n+=ink(x,y);return n;});
const ys=[0,...[1,2,3].map(n=>split(h*n/4,h*.065,rowInk)),h];
const boxes=[];
for(let row=0;row<4;row++){
 const counts=Array.from({length:w},(_,x)=>{let n=0;for(let y=ys[row];y<ys[row+1];y++)n+=ink(x,y);return n;});
 const xs=[0,...[1,2,3].map(n=>split(w*n/4,w*.065,counts)),w];
 for(let col=0;col<4;col++){
  let x0=w,y0=h,x1=-1,y1=-1;
  for(let y=ys[row];y<ys[row+1];y++)for(let x=xs[col];x<xs[col+1];x++)if(ink(x,y)){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  if(x1<0)throw Error('Empty frame');
  boxes.push({x:x0,y:y0,w:x1-x0+1,h:y1-y0+1});
 }
}
const scale=Math.min(224/Math.max(...boxes.map(b=>b.w)),224/Math.max(...boxes.map(b=>b.h)));
const temp=mkdtempSync(join(tmpdir(),'castle-art-'));
try{
 const frames=boxes.map((b,i)=>{
  const out=join(temp,`${i}.png`),dw=Math.round(b.w*scale),dh=Math.round(b.h*scale);
  run('convert',[input,'-crop',`${b.w}x${b.h}+${b.x}+${b.y}`,'+repage','-resize',`${dw}x${dh}!`,'-background','none','-gravity','south','-splice','0x8','-extent','256x256',out]);
  return out;
 });
 const filename=`unit.${id}.refresh.png`,output=activate?`public/assets/painted/${filename}`:`docs/art-refresh/${filename}`;
 run('montage',[...frames,'-tile','4x4','-geometry','256x256+0+0','-background','none',output]);
 const path='public/assets/painted/manifest.json',manifest=JSON.parse(readFileSync(path,'utf8'));
 for(let n=0;n<64;n++)delete manifest[`unit.${id}.frame${n}`];
 manifest[`unit.${id}.frames`]={sheet:filename,count:16,width:256,height:256,names:[],groundOffset:8,animations:{idle:{frames:[0,1,2,3],fps:4},walk:{frames:[4,5,6,7],fps:8},attack:{frames:[8,9,10,11],fps:10},cast:{frames:[8,9,10,11],fps:8},hurt:{frames:[12],fps:5},spawn:{frames:[13,0],fps:7},die:{frames:[14,15],fps:5}}};
 if(activate)writeFileSync(path,JSON.stringify(manifest,null,2)+'\n');
 const report={id,sourceDimensions:[w,h],scale,boxes,output,review:'Imported; motion review required'};
 writeFileSync(`docs/art-refresh/${id}.json`,JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
}finally{rmSync(temp,{recursive:true,force:true});}
