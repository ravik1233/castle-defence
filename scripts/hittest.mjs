/**
 * Checks that every button responds exactly where it is drawn.
 *
 * This shipped broken: Phaser adds a Container's display origin (half its
 * size) to the local point before testing the hit area, so a hit area given as
 * a centred rectangle gets the origin applied twice and the whole responsive
 * region slides up and left by half a button. Nothing looks wrong - the button
 * draws in the right place - and the earlier test missed it entirely because
 * it clicked the mathematical centre, which sits on the boundary and passes.
 *
 * So this probes the *edges*: just inside each corner must respond, just
 * outside each edge must not, and then it clicks a real button well off centre
 * and checks the game actually went somewhere.
 */
import { launchBrowser } from './browser.mjs';

const base = process.argv[2] ?? 'http://localhost:5199';
const browser = await launchBrowser();
let failed = false;
const fail = (m) => {
  console.error('FAIL:', m);
  failed = true;
};

const page = await browser.newPage({ viewport: { width: 1466, height: 716 }, deviceScaleFactor: 1.25 });
await page.goto(`${base}/`, { waitUntil: 'load' });
await page.waitForFunction(
  () => globalThis.__game?.scene.getScenes(true)[0]?.scene.key === 'MainMenu',
  { timeout: 180000 },
);
await page.waitForTimeout(1200);

/**
 * For every interactive object in the live scene, probe the hit area at the
 * points that matter and report any whose responsive region does not line up
 * with its footprint.
 */
const audit = () =>
  page.evaluate(() => {
    const scene = globalThis.__game.scene.getScenes(true)[0];
    const walk = (list, out = []) => {
      for (const o of list) {
        if (o.input && o.visible) out.push(o);
        if (Array.isArray(o.list)) walk(o.list, out);
      }
      return out;
    };
    return walk(scene.children.list)
      .filter((o) => o.width > 0 && o.height > 0)
      .map((o) => {
        const label = o.list?.find((c) => c.type === 'Text')?.text ?? o.type;
        // Exactly how Phaser decides, for a point offset from the object.
        const at = (dx, dy) =>
          !!o.input.hitAreaCallback(o.input.hitArea, dx + o.displayOriginX, dy + o.displayOriginY, o);
        const hw = o.width / 2;
        const hh = o.height / 2;
        const inside = [
          ['centre', 0, 0],
          ['top-left', -hw + 2, -hh + 2],
          ['top-right', hw - 2, -hh + 2],
          ['bottom-left', -hw + 2, hh - 2],
          ['bottom-right', hw - 2, hh - 2],
        ].filter(([, dx, dy]) => !at(dx, dy));
        const outside = [
          ['left of', -hw - 3, 0],
          ['right of', hw + 3, 0],
          ['above', 0, -hh - 3],
          ['below', 0, hh + 3],
        ].filter(([, dx, dy]) => at(dx, dy));
        return {
          label,
          size: [o.width, o.height],
          dead: inside.map(([n]) => n),
          leaking: outside.map(([n]) => n),
        };
      })
      .filter((r) => r.dead.length || r.leaking.length);
  });

const SCREENS = ['MainMenu', 'Armory', 'Map'];

/** Clicks a button by label, well off centre - where a thumb actually lands. */
const clickOffCentre = async (label) => {
  const at = await page.evaluate((text) => {
    const g = globalThis.__game;
    const scene = g.scene.getScenes(true)[0];
    const found = scene.children.list
      .filter((o) => o.type === 'Container' && o.list?.some((c) => c.type === 'Text' && c.text === text))
      .sort((a, b) => a.y - b.y)[0];
    if (!found) return null;
    const r = g.canvas.getBoundingClientRect();
    // 70% of the way to the right edge and 60% down: nowhere near the centre.
    const gx = found.x + found.width * 0.35;
    const gy = found.y + found.height * 0.3;
    return {
      x: r.left + (gx / g.scale.width) * r.width,
      y: r.top + (gy / g.scale.height) * r.height,
    };
  }, label);
  if (!at) return false;
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(900);
  return true;
};

const sceneKey = () => page.evaluate(() => globalThis.__game.scene.getScenes(true)[0].scene.key);

for (const screen of SCREENS) {
  const broken = await audit();
  const here = await sceneKey();
  if (broken.length) {
    for (const b of broken) {
      fail(
        `${here}: "${b.label}" ${b.size[0]}x${b.size[1]} - ` +
          `${b.dead.length ? `dead at ${b.dead.join(', ')}` : ''}` +
          `${b.dead.length && b.leaking.length ? '; ' : ''}` +
          `${b.leaking.length ? `responds ${b.leaking.join(', ')} itself` : ''}`,
      );
    }
  } else {
    console.log(`${here}: every button responds across its own footprint`);
  }

  // Move on, pressing off centre so navigation is tested the way a thumb does it.
  if (screen === 'MainMenu') {
    if (!(await clickOffCentre('ARMOURY'))) fail('no ARMOURY button');
    if ((await sceneKey()) !== 'Armory') fail('an off-centre press on ARMOURY did nothing');
  } else if (screen === 'Armory') {
    if (!(await clickOffCentre('<'))) fail('no back button in the armoury');
    if (!(await clickOffCentre('DEFEND'))) fail('no DEFEND button');
    if ((await sceneKey()) !== 'Map') fail('an off-centre press on DEFEND did nothing');
  }
}

await page.close();
await browser.close();
if (failed) process.exitCode = 1;
else console.log('HIT AREAS OK');
