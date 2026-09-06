/**
 * Proves the input safety net works.
 *
 * The reported failure was a device where the coordinates were right, the
 * scene was drawn, and `hitTestPointer` still returned nothing - so no button
 * ever fired. That cannot be reproduced by resizing, so this test induces it
 * directly: it empties the scene's input list, which is the one piece of state
 * Phaser's own hit test reads, and then presses buttons for real.
 *
 * Without src/systems/inputfallback.ts every press below does nothing.
 */
import { launchBrowser } from './browser.mjs';

const base = process.argv[2] ?? 'http://localhost:5199';
const browser = await launchBrowser();
let failed = false;
const fail = (m) => {
  console.error('FAIL:', m);
  failed = true;
};

const page = await browser.newPage({
  viewport: { width: 1466, height: 716 },
  deviceScaleFactor: 1.25,
});
await page.goto(`${base}/`, { waitUntil: 'load' });
await page.waitForFunction(
  () => globalThis.__game?.scene.getScenes(true)[0]?.scene.key === 'MainMenu',
  { timeout: 180000 },
);
await page.waitForTimeout(1200);

/** Screen position of a button, found by its label; the topmost one wins. */
const locate = (label) =>
  page.evaluate((text) => {
    const g = globalThis.__game;
    const scene = g.scene.getScenes(true)[0];
    const found = scene.children.list
      .filter((o) => o.type === 'Container' && o.list?.some((c) => c.type === 'Text' && c.text === text))
      .sort((a, b) => a.y - b.y)[0];
    if (!found) return null;
    const r = g.canvas.getBoundingClientRect();
    return {
      x: r.left + (found.x / g.scale.width) * r.width,
      y: r.top + (found.y / g.scale.height) * r.height,
    };
  }, label);

/** Reproduces the fault: Phaser's hit test now sees nothing, ever. */
const breakInput = () =>
  page.evaluate(() => {
    for (const scene of globalThis.__game.scene.scenes) {
      const ip = scene.input;
      if (!ip) continue;
      ip._list = [];
      ip._pendingInsertion = [];
      // Any object added from here on must not sneak back into the list.
      ip.queueForInsertion = () => ip;
    }
  });

await breakInput();

const blind = await page.evaluate(() => {
  const scene = globalThis.__game.scene.getScenes(true)[0];
  const p = scene.input.activePointer;
  return scene.input.hitTestPointer(p).length;
});
if (blind !== 0) fail(`could not induce the fault - hit test still returns ${blind} objects`);

const defend = await locate('DEFEND');
if (!defend) {
  fail('could not find the DEFEND button');
} else {
  await page.mouse.click(defend.x, defend.y);
  await page.waitForTimeout(900);
  const key = await page.evaluate(() => globalThis.__game.scene.getScenes(true)[0].scene.key);
  if (key !== 'Map') fail(`with input broken, DEFEND left us on ${key}`);
  else console.log('blind hit test: DEFEND still opens the map');
}

// The net has to survive a scene change, since the listeners it installs are
// torn down with the scene that owned them.
await breakInput();
const back = await locate('<');
if (!back) {
  fail('could not find the back button on the map');
} else {
  await page.mouse.click(back.x, back.y);
  await page.waitForTimeout(900);
  const key = await page.evaluate(() => globalThis.__game.scene.getScenes(true)[0].scene.key);
  if (key !== 'MainMenu') fail(`with input broken, back left us on ${key}`);
  else console.log('blind hit test: back still returns to the menu');
}

await page.close();
await browser.close();
if (failed) process.exitCode = 1;
else console.log('input safety net: OK');
