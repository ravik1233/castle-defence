/**
 * Verifies that a tap lands where the finger is, and that the canvas is
 * actually centred.
 *
 * Two failures this guards against, both of which shipped once:
 *   - the container is sized from the layout viewport (which includes the
 *     strip behind a mobile URL bar), so the canvas overflows the screen and
 *     taps land short;
 *   - the canvas is centred twice, by CSS and again by Phaser, which shifts
 *     the picture half a letterbox away from its own hit areas.
 */
import { launchBrowser } from './browser.mjs';

const base = process.argv[2] ?? 'http://localhost:5199';
const browser = await launchBrowser();
let failed = false;
const fail = (m) => {
  console.error('FAIL:', m);
  failed = true;
};

const DEVICES = [
  { name: 'phone portrait  ', width: 412, height: 915, dpr: 2.6, mobile: true },
  { name: 'iPhone-ish      ', width: 390, height: 844, dpr: 3, mobile: true },
  { name: 'small phone     ', width: 360, height: 780, dpr: 2, mobile: true },
  { name: 'Pad 6 portrait  ', width: 720, height: 1152, dpr: 2.5, mobile: true },
  { name: 'Pad 6 landscape ', width: 1152, height: 720, dpr: 2.5, mobile: true },
  { name: 'laptop          ', width: 1440, height: 820, dpr: 1, mobile: false },
  { name: 'laptop hidpi    ', width: 1512, height: 850, dpr: 2, mobile: false },
];

for (const device of DEVICES) {
  const page = await browser.newPage({
    viewport: { width: device.width, height: device.height },
    deviceScaleFactor: device.dpr,
    isMobile: device.mobile,
    hasTouch: device.mobile,
  });
  await page.goto(`${base}/`, { waitUntil: 'load' });
  await page.waitForFunction(
    () => globalThis.__game?.scene.getScenes(true)[0]?.scene.key === 'MainMenu',
    { timeout: 180000 },
  );
  await page.waitForTimeout(1200);

  const geom = await page.evaluate(() => {
    const g = globalThis.__game;
    const r = g.canvas.getBoundingClientRect();
    const b = g.scale.canvasBounds;
    return {
      rect: { x: r.x, y: r.y, w: r.width, h: r.height },
      bounds: { x: b.x, y: b.y, w: b.width, h: b.height },
      viewport: {
        w: window.visualViewport?.width ?? innerWidth,
        h: window.visualViewport?.height ?? innerHeight,
      },
    };
  });

  // Centred: the gap on each side must match.
  const leftGap = geom.rect.x;
  const rightGap = geom.viewport.w - (geom.rect.x + geom.rect.w);
  const topGap = geom.rect.y;
  const bottomGap = geom.viewport.h - (geom.rect.y + geom.rect.h);
  if (Math.abs(leftGap - rightGap) > 2) {
    fail(`${device.name}: canvas not centred horizontally (${Math.round(leftGap)} left vs ${Math.round(rightGap)} right)`);
  }
  if (Math.abs(topGap - bottomGap) > 2) {
    fail(`${device.name}: canvas not centred vertically (${Math.round(topGap)} top vs ${Math.round(bottomGap)} bottom)`);
  }

  // Fits: never larger than the visible area.
  if (geom.rect.w > geom.viewport.w + 1.5 || geom.rect.h > geom.viewport.h + 1.5) {
    fail(`${device.name}: canvas ${Math.round(geom.rect.w)}x${Math.round(geom.rect.h)} exceeds viewport`);
  }

  // Phaser's cached rect must agree with the live one, or input is offset.
  const drift = Math.max(
    Math.abs(geom.rect.x - geom.bounds.x),
    Math.abs(geom.rect.y - geom.bounds.y),
    Math.abs(geom.rect.w - geom.bounds.w),
    Math.abs(geom.rect.h - geom.bounds.h),
  );
  if (drift > 1) fail(`${device.name}: Phaser's cached canvas rect drifted by ${Math.round(drift)}px`);

  // Round trip: design point -> screen pixels -> back through Phaser.
  for (const [dx, dy] of [
    [540, 960],
    [540, 1450],
    [200, 300],
    [900, 1700],
    [60, 60],
    [1020, 1860],
  ]) {
    const screen = await page.evaluate(
      ([x, y]) => {
        const r = globalThis.__game.canvas.getBoundingClientRect();
        return {
          x: r.left + (x / globalThis.__game.scale.width) * r.width,
          y: r.top + (y / globalThis.__game.scale.height) * r.height,
        };
      },
      [dx, dy],
    );
    await page.mouse.click(screen.x, screen.y);
    const got = await page.evaluate(() => {
      const p = globalThis.__game.scene.getScenes(true)[0].input.activePointer;
      return { x: p.worldX, y: p.worldY };
    });
    const err = Math.hypot(got.x - dx, got.y - dy);
    if (err > 6) {
      fail(
        `${device.name}: tap at design ${dx},${dy} registered as ` +
          `${Math.round(got.x)},${Math.round(got.y)} (off by ${Math.round(err)}px)`,
      );
    }
  }

  // End to end: press the DEFEND button by its on-screen position.
  const btn = await page.evaluate(() => {
    const r = globalThis.__game.canvas.getBoundingClientRect();
    return {
      x: r.left + (540 / globalThis.__game.scale.width) * r.width,
      y: r.top + (1056 / globalThis.__game.scale.height) * r.height,
    };
  });
  await page.mouse.click(btn.x, btn.y);
  await page.waitForTimeout(900);
  const scene = await page.evaluate(() => globalThis.__game.scene.getScenes(true)[0].scene.key);
  if (scene !== 'Map') fail(`${device.name}: tapping DEFEND left us on ${scene}`);
  else {
    console.log(
      `${device.name} canvas ${Math.round(geom.rect.w)}x${Math.round(geom.rect.h)} ` +
        `at ${Math.round(geom.rect.x)},${Math.round(geom.rect.y)} - centred, taps true, DEFEND works`,
    );
  }
  await page.close();
}

await browser.close();
if (failed) process.exitCode = 1;
else console.log('TOUCH OK');
