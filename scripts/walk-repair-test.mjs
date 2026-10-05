/** Validate the three repaired assets and their real Phaser playback.
 * Start the development server, then run:
 *   node scripts/walk-repair-test.mjs http://localhost:5173
 * Anatomical quality remains a visual review; different pixels alone cannot prove it.
 */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { launchBrowser } from './browser.mjs';

const base = process.argv[2] ?? 'http://localhost:5173';
const targets = [
  { id: 'goblin_king', old: 'unit.goblin_king.region1.png', upper: 181, retained: [1, 3] },
  { id: 'wolf_rider', old: 'unit.wolf_rider.region1.png', upper: 178, retained: [1, 4] },
  { id: 'vampire', old: 'unit.vampire.region2.walk.png', upper: 164, retained: [0, 1, 3, 4] },
];
const manifest = JSON.parse(readFileSync(new URL('../public/assets/painted/manifest.json', import.meta.url)));
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/?scene=Battle&level=c1l4&unlock=1&nomodal=1`);
  await page.waitForFunction(() => !!globalThis.__battle, undefined, { timeout: 180000 });
  for (const target of targets) {
    const spec = manifest[`unit.${target.id}.frames`];
    assert.deepEqual(spec.animations.walk.frames, [1, 2]);
    const before = readFileSync(new URL(`../public/assets/painted/${target.old}`, import.meta.url)).toString('base64');
    const after = readFileSync(new URL(`../public/assets/painted/${spec.sheet}`, import.meta.url)).toString('base64');
    const asset = await page.evaluate(async ({ before, after, upper, retained }) => {
      const decode = async (base64) => {
        const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(image, 0, 0);
        return { image, context };
      };
      const a = await decode(before), b = await decode(after);
      const cell = (c, index) => c.context.getImageData(index * 256, 0, 256, 256).data;
      const equal = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
      const cells = Array.from({ length: 5 }, (_, i) => cell(b, i));
      const coverage = cells.map((data) => {
        let ink = 0, edge = 0, bottom = 0;
        for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
          if (data[(y * 256 + x) * 4 + 3] <= 32) continue;
          ink++; bottom = Math.max(bottom, y);
          if (x === 0 || x === 255 || y === 0 || y === 255) edge++;
        }
        return { ink, edge, bottom };
      });
      return {
        size: [b.image.width, b.image.height],
        retained: retained.every((i) => equal(cell(a, i), cell(b, i))),
        upper: equal(cell(a, 1).slice(0, upper * 256 * 4), cell(b, 2).slice(0, upper * 256 * 4)),
        movementDiffers: !equal(cells[1], cells[2]), coverage,
      };
    }, { before, after, upper: target.upper, retained: target.retained });
    assert.deepEqual(asset.size, [1280, 256], `${target.id}: dimensions`);
    assert.equal(asset.retained, true, `${target.id}: unaffected cells changed`);
    assert.equal(asset.upper, true, `${target.id}: upper body changed`);
    assert.equal(asset.movementDiffers, true, `${target.id}: repeated walk cells`);
    for (const [i, cell] of asset.coverage.entries()) {
      assert.ok(cell.ink > 3000, `${target.id}/${i}: missing character cutout`);
      assert.equal(cell.edge, 0, `${target.id}/${i}: cell spill`);
    }
    assert.ok(Math.abs(asset.coverage[1].bottom - asset.coverage[2].bottom) <= 1, `${target.id}: movement baseline`);
    const playback = await page.evaluate(async ({ id }) => {
      const { Rig } = await import('/src/objects/Rig.ts');
      const { characterArt } = await import('/src/art/compose.ts');
      const { ALL_CHARACTER_ART } = await import('/src/art/cast.ts');
      const scene = globalThis.__game.scene.getScene('Battle');
      const rig = new Rig(scene, 100, 100, characterArt(ALL_CHARACTER_ART[id]), { phase: 0 });
      const image = rig.list.find((item) => item.type === 'Image');
      const frames = new Set(); rig.play('walk');
      for (let i = 0; i < 12; i++) { rig.update(0, 84); frames.add(Number(image.frame.name)); }
      const texture = image.texture.key;
      rig.play('idle'); rig.update(0, 0); const idle = Number(image.frame.name);
      rig.play('attack'); rig.update(0, 0); const attack = Number(image.frame.name);
      rig.play('die'); rig.update(0, 0); const die = Number(image.frame.name);
      rig.destroy();
      return { texture, frames: [...frames].sort(), idle, attack, die };
    }, target);
    assert.deepEqual(playback, { texture: `unit.${target.id}.sheet`, frames: [1, 2], idle: 0, attack: 3, die: 4 });
    console.log(`${target.id}: packed alpha, preserved cells, baseline, and Phaser playback passed`);
  }
  assert.deepEqual(errors, []);
  mkdirSync('screenshots/walk-repairs', { recursive: true });
  await page.evaluate(() => {
    globalThis.__battle.clearField(Infinity);
    ['goblin_king', 'wolf_rider', 'vampire'].forEach((id, row) => globalThis.__battle.spawn(id, row + 1, 1100));
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/walk-repairs/battle.png' });
  console.log('WALK REPAIRS OK');
} finally {
  await browser.close();
}
