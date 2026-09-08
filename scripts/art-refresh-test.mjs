/** Exercise packed-frame playback and legacy fallback in a real Phaser scene. */
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { launchBrowser } from './browser.mjs';

process.env.QA = '1';
const server = await createServer({ server: { host: '127.0.0.1', port: 5201 } });
await server.listen();
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5201/?scene=Battle&level=c1l1&unlock=1&nomodal=1');
  await page.waitForFunction(() => !!globalThis.__battle, { timeout: 120000 });
  const results = await page.evaluate(async () => {
    const { portraitForArt } = await import('/src/art/portraits.ts');
    const { Rig } = await import('/src/objects/Rig.ts');
    const { characterArt } = await import('/src/art/compose.ts');
    const { ALL_CHARACTER_ART } = await import('/src/art/cast.ts');
    const scene = globalThis.__game.scene.getScene('Battle');
    // Even when a full sprite exists, the animated set must be selected.
    scene.textures.addImage('unit.militia.full', scene.textures.get('unit.militia.frame0').getSourceImage());
    const rig = new Rig(scene, 100, 100, characterArt(ALL_CHARACTER_ART.militia), { phase: 0 });
    const image = rig.list.find((item) => item.type === 'Image');
    const output = { sheetWins: image.texture.key === 'unit.militia.sheet' };
    const portrait = portraitForArt(scene, 'militia');
    output.portraitUsesSheet = portrait.key === 'unit.militia.sheet' && portrait.frame === 0;
    rig.play('walk'); rig.update(0, 110);
    output.walkAdvances = image.frame.name === 2;
    let hits = 0;
    rig.play('cast', () => hits++); rig.update(0, 270);
    output.castBeforeImpact = hits === 0;
    rig.update(0, 6); output.castAtImpact = hits === 1;
    rig.update(0, 300); output.castFinishes = hits === 1 && rig.current === 'idle' && !rig.isBusy;
    rig.play('attack', () => hits++); rig.update(0, 230);
    output.attackBeforeImpact = hits === 1;
    rig.update(0, 2); output.attackAtImpact = hits === 2;
    rig.play('hurt'); rig.update(0, 250); output.hurtFinishes = rig.current === 'idle';
    rig.play('spawn'); rig.update(0, 310); output.spawnFinishes = rig.current === 'idle';
    rig.tintAll(0xff0000); output.tintApplied = image.tintTopLeft === 0xff0000;
    rig.clearTintAll(); output.tintCleared = image.tintTopLeft === 0xffffff;
    rig.destroy();
    const legacy = new Rig(scene, 200, 100, characterArt(ALL_CHARACTER_ART.archer));
    legacy.play('hurt'); legacy.update(0, 250);
    output.legacyHurtFinishes = legacy.current === 'idle';
    legacy.destroy();
    return output;
  });
  for (const [name, passed] of Object.entries(results)) assert.equal(passed, true, name);
  assert.deepEqual(errors, []);
  console.log(`Passed ${Object.keys(results).length} packed-frame and legacy runtime checks.`);
} finally {
  await browser.close();
  await server.close();
}
