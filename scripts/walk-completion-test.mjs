/** Check final packed pixels and real Rig playback for all 67 new cycles.
 * Start Vite, then run: node scripts/walk-completion-test.mjs http://localhost:5173
 * Visual gait review is separate: pixel differences cannot prove anatomy.
 */
import assert from 'node:assert/strict';
import {readFileSync, mkdirSync} from 'node:fs';
import {launchBrowser} from './browser.mjs';
const base=process.argv[2]??'http://localhost:5173';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(readFileSync(new URL('public/assets/painted/manifest.json',root)));
const {records}=JSON.parse(readFileSync(new URL('docs/art-refresh/walk-completion/coverage.json',root)));
assert.equal(records.length,67);
const browser=await launchBrowser();
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/?scene=Battle&level=c1l4&unlock=1&nomodal=1`);
 await page.waitForFunction(()=>!!globalThis.__battle,undefined,{timeout:180000});
 for(const record of records){
  const spec=manifest[`unit.${record.id}.frames`];
  assert.deepEqual(spec.animations.walk,{frames:[1,2],fps:6},record.id);
  const src=name=>'data:image/png;base64,'+readFileSync(new URL('public/assets/painted/'+name,root)).toString('base64');
  const pixels=await page.evaluate(async({a,b,retained,upper})=>{
   const load=async url=>{const im=new Image();im.src=url;await im.decode();const c=Object.assign(document.createElement('canvas'),{width:im.width,height:im.height}),ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);return{im,ctx};};
   const before=await load(a),after=await load(b),cell=(ctx,i)=>ctx.getImageData(i*256,0,256,256).data;
   const equal=(x,y)=>x.length===y.length&&x.every((v,i)=>v===y[i]);
   const cells=Array.from({length:5},(_,i)=>cell(after.ctx,i));
   const coverage=cells.map(d=>{let ink=0,edge=0,bottom=0;for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(d[(y*256+x)*4+3]>32){ink++;bottom=Math.max(bottom,y);if(x===0||y===0||x===255||y===255)edge++;}return{ink,edge,bottom};});
   return{size:[after.im.width,after.im.height],retained:retained.every(([old,newIndex])=>equal(cell(before.ctx,old),cells[newIndex])),upper:upper===null||equal(cells[1].slice(0,upper*1024),cells[2].slice(0,upper*1024)),different:!equal(cells[1],cells[2]),coverage};
  },{a:src(record.original),b:src(record.sheet),retained:record.retained,upper:record.preservedUpper});
  assert.deepEqual(pixels.size,[1280,256],record.id+': dimensions');
  assert.equal(pixels.retained,true,record.id+': changed retained action cells');
  assert.equal(pixels.upper,true,record.id+': unstable upper body');
  assert.equal(pixels.different,true,record.id+': duplicated movement');
  for(const i of [1,2]){assert.ok(pixels.coverage[i].ink>2000,record.id+': blank movement');assert.equal(pixels.coverage[i].edge,0,record.id+': cell spill');}
  assert.ok(Math.abs(pixels.coverage[1].bottom-pixels.coverage[2].bottom)<=1,record.id+': movement baseline');
  const playback=await page.evaluate(async id=>{
   const {Rig}=await import('/src/objects/Rig.ts'),{characterArt}=await import('/src/art/compose.ts'),{ALL_CHARACTER_ART}=await import('/src/art/cast.ts');
   const scene=globalThis.__game.scene.getScene('Battle'),rig=new Rig(scene,100,100,characterArt(ALL_CHARACTER_ART[id]),{phase:0}),image=rig.list.find(o=>o.type==='Image'),frames=new Set();
   rig.play('walk');for(let i=0;i<12;i++){rig.update(0,84);frames.add(Number(image.frame.name));}
   const result={texture:image.texture.key,frames:[...frames].sort()};for(const action of ['idle','attack','die']){rig.play(action);rig.update(0,0);result[action]=Number(image.frame.name);}rig.destroy();return result;
  },record.id);
  assert.deepEqual(playback,{texture:`unit.${record.id}.sheet`,frames:[1,2],idle:0,attack:3,die:4},record.id+': Rig playback');
  console.log(record.id+': pixels, retained actions and Rig playback passed');
 }
 assert.deepEqual(errors,[]);
 mkdirSync('screenshots/walk-completion',{recursive:true});await page.screenshot({path:'screenshots/walk-completion/battle.png'});
 console.log('WALK COMPLETION OK: 67 new cycles');
} finally {await browser.close();}
