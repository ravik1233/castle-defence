/**
 * Drives the phase loop: muster, starting the assault early, and a siege
 * wave battering the wall from out of reach.
 *
 * It checks that neither waiting nor starting early creates Ember, then that
 * a siege damages the wall with nothing touching it.
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
  const g = globalThis.__game;
  // A goblin fort on purpose: the undead get back up, so a region that
  // rises would be measuring the wrong thing when clearing the field.
  g.scene.getScenes(true)[0].scene.start('Battle', { levelId: 'c1l6' });
});
await page.waitForFunction(() => Boolean(globalThis.__battle), { timeout: 180000 });
await page.waitForTimeout(1500);

const state = () => page.evaluate(() => globalThis.__battle.state());
const until = async (fn, ms, what) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (fn(await state())) return true;
    await page.waitForTimeout(250);
  }
  fail(`timed out waiting for ${what}`);
  return false;
};

/* ------------------------------------------------------- the first muster */

const start = await state();
if (start.phase !== 'muster') fail(`a battle opens in phase ${start.phase}, not muster`);
if (start.musterLeft <= 0) fail('the opening muster has no time in it');

/* ------------------------------------------ calling the assault on early */

const before = await state();
const paid = await page.evaluate(() => globalThis.__battle.call());
const after = await state();

if (paid !== 0) fail(`starting the assault paid ${paid} Ember`);
if (after.gold !== before.gold) fail(`starting the assault moved the purse by ${after.gold - before.gold}`);
if (after.phase === 'muster') fail('calling the assault on left the fight in muster');
console.log(`started the assault with ${before.musterLeft}s left and no payout`);

// Calling twice must not pay twice: the muster is over.
const twice = await page.evaluate(() => globalThis.__battle.call());
if (twice !== 0) fail(`calling on during an assault paid ${twice}`);

/* -------------------------------------------------- the muster comes back */

// Clear the field and the unpaid lull returns.
// A wave keeps spawning for its whole duration, so clearing the field means
// killing what is there again and again until the queue is finally empty.
let mustered = false;
for (let i = 0; i < 400 && !mustered; i += 1) {
  await page.evaluate(() => globalThis.__battle.clearField(Infinity));
  await page.waitForTimeout(250);
  mustered = (await state()).phase === 'muster';
}
if (!mustered) {
  fail('the muster never returned once the field was clear');
} else {
  const rested = await state();
  if (rested.musterLeft <= 0) fail('the returned muster has no time in it');
  else console.log(`the unpaid muster returned with ${rested.musterLeft}s`);
}

/* --------------------------------------------------------------- a siege */

const preSiege = await state();
// Run waves on until one of them is a siege wave.
let sieged = false;
for (let i = 0; i < 12 && !sieged; i += 1) {
  await page.evaluate(() => globalThis.__battle.nextWave());
  await page.waitForTimeout(400);
  sieged = (await state()).phase === 'siege';
}
if (!sieged) {
  fail('no siege wave in twelve waves of a goblin fort');
} else {
  const wallBefore = (await state()).wallHp;
  /*
   * The point of a siege is damage the player cannot answer by killing what
   * is in front of them, so this keeps the field occupied but empty-handed:
   * anything that gets near the wall dies, and a body is kept far out so the
   * wave never counts as cleared. Whatever the wall loses came from the
   * engines.
   */
  let fell = false;
  for (let i = 0; i < 240 && !fell; i += 1) {
    // Kill anything that gets near the wall, and keep a body far out so the
    // wave never counts as cleared.
    await page.evaluate(() => {
      globalThis.__battle.clearField(500);
      if (globalThis.__battle.state().enemies === 0) globalThis.__battle.spawn('goblin', 0);
    });
    await page.waitForTimeout(250);
    const now = await state();
    if (now.phase !== 'siege') break;
    if (now.wallHp < wallBefore) {
      fell = true;
      console.log(`siege engines took the wall from ${wallBefore} to ${now.wallHp} with nothing at it`);
    }
  }
  if (!fell) fail('a siege wave never damaged the wall from range');
  if (preSiege.phase === 'siege') fail('the fight was already in siege before a siege wave');
}

await page.close();
await browser.close();
if (failed) process.exitCode = 1;
else console.log('SIEGE PHASES OK');
