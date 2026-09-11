/**
 * Drives a sortie: a unit leaves the wall, marches up its own lane, fights
 * what it meets out there, and comes home when it is called.
 *
 * The point of the mechanic is that a defender can stop being a turret, so
 * this watches the thing that proves it - the unit's own position - rather
 * than the button that started it.
 */
import { launchBrowser } from './browser.mjs';

const base = process.argv[2] ?? 'http://localhost:5199';
const browser = await launchBrowser();
let failed = false;
const fail = (m) => {
  console.error('FAIL:', m);
  failed = true;
};

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => fail(`page error: ${String(e).slice(0, 160)}`));
await page.goto(`${base}/`, { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__game?.scene.getScenes(true)[0]?.scene.key === 'MainMenu', {
  timeout: 180000,
});
await page.evaluate(() => {
  globalThis.__game.scene.getScenes(true)[0].scene.start('Battle', { levelId: 'c1l1' });
});
await page.waitForFunction(() => Boolean(globalThis.__battle), { timeout: 180000 });
await page.waitForTimeout(1500);

const state = () => page.evaluate(() => globalThis.__battle.state());
const unitAt = async (row) => {
  const s = await state();
  return s.defenderDump.find((d) => d.row === row && !d.commander) ?? null;
};
const until = async (fn, ms, what) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fn(await state())) return true;
    await page.waitForTimeout(250);
  }
  fail(`timed out waiting for ${what}`);
  return false;
};

await page.evaluate(() => globalThis.__battle.addGold(2000));
const placed = await page.evaluate(() => globalThis.__battle.place('militia', 2, 0));
if (!placed) fail('could not place the militia that is meant to march');

const before = await unitAt(2);
if (!before) fail('no militia on the field to send out');
else if (before.sortie !== 'held') fail(`a freshly placed unit reports sortie ${before.sortie}`);

/* ------------------------------------------------------------- going out */

const sent = await page.evaluate(() => globalThis.__battle.sortie(2, 0));
if (sent !== 'out') fail(`sending a militia out reported ${sent}`);

const marched = await until(
  (s) => {
    const d = s.defenderDump.find((u) => u.row === 2 && !u.commander && u.sortie === 'out');
    return Boolean(d && d.x > d.home + 60);
  },
  120000,
  'the unit to march out past its own cell',
);
if (marched) {
  const out = (await state()).defenderDump.find((u) => u.row === 2 && !u.commander);
  console.log(`the militia marched from ${out.home} to ${out.x}`);
}

/* -------------------------------------------------- a building cannot go */

const built = await page.evaluate(() => globalThis.__battle.place('barricade', 1, 0));
if (built) {
  const wall = await page.evaluate(() => globalThis.__battle.sortie(1, 0));
  if (wall !== 'refused') fail(`a barricade was allowed to sortie (${wall})`);
} else {
  console.log('no barricade to test with - skipped the building check');
}

/* ------------------------------------------------------- calling it home */

const back = await page.evaluate(() => globalThis.__battle.sortie(2, 0));
if (back !== 'returning') fail(`calling the unit home reported ${back}`);
const home = await until(
  (s) => {
    const d = s.defenderDump.find((u) => u.row === 2 && !u.commander && u.id === 'militia');
    return Boolean(d && d.sortie === 'held' && Math.abs(d.x - d.home) < 2);
  },
  180000,
  'the unit to walk back to its own cell',
);
if (home) console.log('the militia came home and holds its cell again');

/* --------------------------------------------- salvage out in the field */

const goldBefore = (await state()).gold;
// A body killed far out is worth half again; one at the wall is not.
await page.evaluate(() => globalThis.__battle.spawn('goblin', 4, 1400));
await page.waitForTimeout(600);
await page.evaluate(() => globalThis.__battle.clearField(Infinity));
await page.waitForTimeout(600);
const farPaid = (await state()).gold - goldBefore;

const goldMid = (await state()).gold;
// Just outside the wall face, read from the battle: x=400 used to be open
// ground and is now inside the parapet itself.
await page.evaluate(
  (x) => globalThis.__battle.spawn('goblin', 4, x),
  (await state()).wallFaceX + 80,
);
await page.waitForTimeout(600);
await page.evaluate(() => globalThis.__battle.clearField(Infinity));
await page.waitForTimeout(600);
const nearPaid = (await state()).gold - goldMid;

if (farPaid <= nearPaid) {
  fail(`a kill in the field paid ${farPaid} and one at the wall ${nearPaid}`);
} else {
  console.log(`salvage: ${farPaid} out in the field against ${nearPaid} at the wall`);
}

await page.close();
await browser.close();
if (failed) process.exitCode = 1;
else console.log('SORTIE OK');
