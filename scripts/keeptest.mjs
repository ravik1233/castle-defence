/**
 * Drives the keep: the parapet, the reserves and the commander.
 *
 * The three things that replaced the ember core have to be played rather
 * than asserted on, so this puts units on the wall, cuts a lane down to see
 * whether the keep answers, and finally kills the commander to check that is
 * what ends the fort.
 *
 *   node scripts/keeptest.mjs [baseUrl]
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
await page.goto(`${base}/?scene=Battle&level=c1l4&nomodal=1&unlock=1`, { waitUntil: 'load' });
await page.waitForFunction(() => Boolean(globalThis.__battle), { timeout: 240000 });
await page.waitForTimeout(1500);

const keep = () => page.evaluate(() => globalThis.__battle.keep());
const state = () => page.evaluate(() => globalThis.__battle.state());

/* ------------------------------------------------------ the commander -- */

const start = await keep();
if (!start.commanderAlive) fail('the fort opens with no commander');
else console.log(`the commander holds the keep with ${start.commander}`);
if (start.reserves <= 0) fail('the fort opens with no reserves');
else console.log(`${start.reserves} in reserve behind him`);

/* --------------------------------------------------------- the parapet - */

// Columns 0 and 1 are the wall. Anything that can be played in the field has
// to be playable up there too, or the two tiles bought nothing.
const onWall = await page.evaluate(() => {
  const b = globalThis.__battle;
  b.addGold(4000);
  return [b.place('archer', 0, 0), b.place('militia', 1, 1)].every(Boolean);
});
if (!onWall) fail('nothing could be posted on the parapet');
else console.log('the parapet takes a shooter and a spearman');

// An economy building on a wall is not a thing, and the rule should say so.
const minedTheWall = await page.evaluate(() => globalThis.__battle.place('tithe', 2, 0));
if (minedTheWall) fail('an economy building was raised on the parapet');
else console.log('the parapet refuses an economy building');

/* -------------------------------------------------------- the reserves - */

// Hold one lane with a single unit, then cut it down: the keep should send a
// militia up to fill the hole, and the pool should drop by exactly one.
const before = await keep();
const filled = await page.evaluate(async () => {
  const b = globalThis.__battle;
  b.place('militia', 4, 4);
  b.felled(4, 4);
  await new Promise((r) => setTimeout(r, 400));
  return b.state().defenderDump.some((d) => d.row === 4 && d.id === 'militia');
});
const after = await keep();
if (!filled) fail('no reserve stepped into the lane that emptied');
else console.log('a reserve stepped into the empty lane');
if (after.reserves !== before.reserves - 1) {
  fail(`the pool went ${before.reserves} -> ${after.reserves}, expected one spent`);
} else {
  console.log(`the pool spent exactly one: ${before.reserves} -> ${after.reserves}`);
}

/* ------------------------------------------------------- losing the day - */

const alive = await state();
if (alive.heartHp <= 0) fail('the commander was already down before he was struck');

await page.evaluate(() => globalThis.__battle.strikeCommander(99999));
// The results screen is reached on a scene timer, and a container with no
// GPU runs the game clock at a fraction of real time, so poll rather than
// guessing at a delay.
for (let i = 0; i < 60; i += 1) {
  const at = await page.evaluate(() =>
    globalThis.__game.scene.getScenes(true).map((s) => s.scene.key).join(','),
  );
  if (at.includes('Result')) break;
  await page.waitForTimeout(1000);
}
const dead = await keep();
if (dead.commanderAlive) fail('the commander survived a fatal blow');
else console.log('cutting the commander down ends the fort');

const scene = await page.evaluate(() =>
  globalThis.__game.scene.getScenes(true).map((s) => s.scene.key).join(','),
);
if (!scene.includes('Result')) fail(`losing the commander left us on ${scene}`);
else console.log('and the loss reaches the results screen');

console.log(failed ? 'KEEP FAILED' : 'KEEP OK');
process.exitCode = failed ? 1 : 0;
await browser.close();
