/** Verify regional lighting, visible bases, placement rules and contact cleanup.
 * Start Vite and run: node scripts/grounding-test.mjs http://localhost:5173
 */
import assert from 'node:assert/strict';
import { launchBrowser } from './browser.mjs';
const base=process.argv[2]??'http://localhost:5173';
const browser=await launchBrowser();
try {
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(let chapter=1;chapter<=7;chapter++){
  await page.goto(`${base}/?scene=Battle&level=c${chapter}l4&unlock=1&nomodal=1`);
  await page.waitForFunction(()=>!!globalThis.__battle,undefined,{timeout:180000});
  await page.evaluate(async()=>{const scene=globalThis.__game.scene.getScene('Battle');scene.paused=true;globalThis.__battle.addGold(10000);const{ensureUnitArt}=await import('/src/art/registry.ts'),{castForLevel}=await import('/src/systems/textures.ts'),{profile}=await import('/src/systems/profile.ts');profile.setDeck(['gatebreaker','barricade','bombard','tithe','ballista','brazier']);if(!castForLevel(scene.levelDef.id).includes('gatebreaker'))throw Error('Gatebreaker omitted from deck preload');await ensureUnitArt(scene,['gatebreaker']);for(const id of ['barricade','bombard','tithe','ballista','brazier','gatebreaker']){let placed=false;for(let row=0;row<5&&!placed;row++)for(let col=2;col<8&&!placed;col++){if(globalThis.__battle.whyNot(row,col,id)==='ok'){if(!globalThis.__battle.place(id,row,col))throw Error('Failed structure placement: '+id);placed=true;}}if(!placed)throw Error('No legal cell for '+id);}});
  await page.waitForTimeout(350);
  const result=await page.evaluate(async()=>{
   const scene=globalThis.__game.scene.getScene('Battle'),{visibleArtBounds,groundPatch}=await import('/src/art/grounding.ts'),{ENVIRONMENT_MATERIAL}=await import('/src/art/environment.ts'),{canStandOn}=await import('/src/data/tiles.ts'),{GRID,laneGroundY}=await import('/src/core/layout.ts');
   const material=ENVIRONMENT_MATERIAL[scene.biome];
   const structures=scene.defenders.filter(d=>d.def.art.kind==='build').map(d=>{
    const image=d.sprite,bounds=visibleArtBounds(scene,image.texture.key,image.frame.name);
    const bottom=image.y+(bounds.y+bounds.height-image.originY*image.height)*image.scaleY;
    return{id:d.def.id,footError:Math.abs(bottom-laneGroundY(d.row)),topError:Math.abs(d.topY-(laneGroundY(d.row)-bounds.height*image.scaleY)),width:bounds.width*image.scaleX,height:bounds.height*image.scaleY,light:image.tintTopLeft===material.light&&image.tintBottomLeft===material.baseLight,contacts:d.buildingGround.images.length};
   });
   const rules=scene.tiles.every((row,r)=>row.every((tile,c)=>scene.canPlaceAt(r,c,'barricade')===(!scene.occupancy.has(`${r},${c}`)&&!scene.levelDef.modifiers?.blockedCells?.some(([rr,cc])=>rr===r&&cc===c)&&canStandOn(tile,false))));
   const feathered=['earth','stone','shadow','edge'].every(kind=>{const key=groundPatch(scene,scene.biome,kind),c=scene.textures.get(key).getSourceImage(),ctx=c.getContext('2d'),d=ctx.getImageData(0,0,c.width,c.height).data;for(let x=0;x<c.width;x++)if(d[x*4+3]||d[((c.height-1)*c.width+x)*4+3])return false;for(let y=0;y<c.height;y++)if(d[y*c.width*4+3]||d[(y*c.width+c.width-1)*4+3])return false;return true});
   const repeat=groundPatch(scene,scene.biome,'earth')===groundPatch(scene,scene.biome,'earth');
   const d=scene.defenders.find(d=>d.def.id==='barricade');d.takeDamage(1);globalThis.groundingTarget=d;
   return{biome:scene.biome,tints:[material.light,material.baseLight],structures,rules,feathered,repeat,limits:[GRID.cellW*.86,GRID.cellH*.86]};
  });
  assert.equal(result.structures.length,6);
  for(const d of result.structures){assert.ok(d.footError<0.01,d.id+': transparent padding lifts base');assert.ok(d.topError<0.01,d.id+': health-bar anchor');assert.ok(d.width<=result.limits[0]+0.01&&d.height<=result.limits[1]+0.01,d.id+': lane overflow');assert.equal(d.light,true);assert.equal(d.contacts,3);}
  assert.equal(result.rules,true,result.biome+': changed placement rules');assert.equal(result.feathered,true,result.biome+': hard contact edge');assert.equal(result.repeat,true);
  await page.waitForFunction(([top,bottom])=>globalThis.groundingTarget.sprite.tintTopLeft===top&&globalThis.groundingTarget.sprite.tintBottomLeft===bottom,result.tints,{timeout:8000});
  assert.equal(await page.evaluate(async()=>{const{ENVIRONMENT_MATERIAL}=await import('/src/art/environment.ts'),d=globalThis.groundingTarget,m=ENVIRONMENT_MATERIAL[globalThis.__game.scene.getScene('Battle').biome];return d.sprite.tintTopLeft===m.light&&d.sprite.tintBottomLeft===m.baseLight;}),true,result.biome+': hit flash erased ambient light');
  await page.evaluate(()=>{globalThis.groundingContacts=globalThis.groundingTarget.buildingGround.images;globalThis.__battle.felled(globalThis.groundingTarget.row,globalThis.groundingTarget.col);});
  await page.waitForFunction(()=>globalThis.groundingContacts.every(image=>!image.scene),undefined,{timeout:8000});
  assert.equal(await page.evaluate(()=>globalThis.groundingContacts.every(image=>!image.scene)),true,result.biome+': stale foundation after destruction');
  console.log(result.biome+': visible bases, lighting, feathered contact, placement rules and cleanup passed');
 }
 assert.deepEqual(errors,[]);
 console.log('GROUNDING OK: all seven regions');
} finally {await browser.close();}
