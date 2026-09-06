/**
 * Verifies that a tap lands where the finger is.
 *
 * The failure this guards against: on mobile the container is sized from the
 * layout viewport (which includes the strip behind the URL bar), the canvas
 * overflows the screen, and every tap lands short of its target.
 */
import { launchBrowser } from './browser.mjs';

const base = process.argv[2] ?? 'http://localhost:5199';
const browser = await launchBrowser();
let failed = false;
const fail = (m) => {
  console.error('FAIL:', m);
  failed = true;
};

for (const device of [
  { name: 'iPhone 12', width: 390, height: 844 },
  { name: 'Pixel 7', width: 412, height: 915 },
  { name: 'tall/narrow', width: 360, height: 780 },
]) {
  const page = await browser.newPage({
    viewport: { width: device.width, height: device.height },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  await page.goto(`${base}/`, { waitUntil: 'load' });
  await page.waitForFunction(
    () => globalThis.__game?.scene.getScenes(true)[0]?.scene.key === 'MainMenu',
    { timeout: 180000 },
  );
  await page.waitForTimeout(1200);

  const geom = await page.evaluate(() => {
    const g = globalThis.__game;
    const b = g.scale.canvasBounds;
    return {
      canvas: { x: b.x, y: b.y, w: b.width, h: b.height },
      viewport: { w: window.visualViewport?.width ?? innerWidth, h: window.visualViewport?.height ?? innerHeight },
    };
  });

  // The canvas must sit inside the visible area, or taps are offset.
  const slack = 1.5;
  if (geom.canvas.y < -slack || geom.canvas.x < -slack) {
    fail(`${device.name}: canvas starts off-screen at ${geom.canvas.x},${geom.canvas.y}`);
  }
  if (geom.canvas.h > geom.viewport.h + slack || geom.canvas.w > geom.viewport.w + slack) {
    fail(
      `${device.name}: canvas ${geom.canvas.w}x${geom.canvas.h} is larger than the viewport ` +
        `${geom.viewport.w}x${geom.viewport.h}`,
    );
  }

  // Round trip: a design-space point -> screen pixels -> back through Phaser.
  const probes = [
    [540, 960],
    [540, 1450],
    [200, 300],
    [900, 1700],
  ];
  for (const [dx, dy] of probes) {
    const screen = await page.evaluate(
      ([x, y]) => {
        const b = globalThis.__game.scale.canvasBounds;
        const s = globalThis.__game.scale.displayScale;
        return { x: b.x + x / s.x, y: b.y + y / s.y };
      },
      [dx, dy],
    );
    await page.mouse.click(screen.x, screen.y);
    const got = await page.evaluate(() => {
      const p = globalThis.__game.scene.getScenes(true)[0].input.activePointer;
      return { x: p.worldX, y: p.worldY };
    });
    const err = Math.hypot(got.x - dx, got.y - dy);
    if (err > 6) fail(`${device.name}: tap at design ${dx},${dy} registered as ${Math.round(got.x)},${Math.round(got.y)} (off by ${Math.round(err)}px)`);
  }

  // And an end-to-end press of a real button.
  const btn = await page.evaluate(() => {
    const b = globalThis.__game.scale.canvasBounds;
    const s = globalThis.__game.scale.displayScale;
    return { x: b.x + 540 / s.x, y: b.y + 1056 / s.y };
  });
  await page.mouse.click(btn.x, btn.y);
  await page.waitForTimeout(900);
  const scene = await page.evaluate(() => globalThis.__game.scene.getScenes(true)[0].scene.key);
  if (scene !== 'Map') fail(`${device.name}: tapping DEFEND left us on ${scene}`);
  else console.log(`${device.name}: taps land true, DEFEND opened the map`);
  await page.close();
}

await browser.close();
if (failed) process.exitCode = 1;
else console.log('TOUCH OK');
