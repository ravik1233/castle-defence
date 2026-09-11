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
/*
 * Every lane, and the centre one especially.
 *
 * The commander stands in the centre lane and lives in the same list as the
 * lane defenders. The first version of this test cut a unit down in row 4,
 * passed, and never noticed that the check for "is this lane still held?"
 * was counting the commander - so row 2, the one he is in, could never have
 * been sent anyone.
 *
 * Lanes 0 and 1 are skipped here because the parapet section above left an
 * archer and a spearman in them, and a lane with someone still in it is not
 * supposed to call anyone up. That rule gets its own check below.
 */
for (const row of [4, 2, 3]) {
  const before = await keep();
  const filled = await page.evaluate(async (r) => {
    const b = globalThis.__battle;
    b.addGold(500);
    b.place('militia', r, 5);
    b.felled(r, 5);
    await new Promise((res) => setTimeout(res, 900));
    return b.state().defenderDump.some((d) => d.row === r && !d.commander && d.id === 'militia');
  }, row);
  const after = await keep();
  if (!filled) fail(`no reserve stepped into lane ${row} when it emptied`);
  else console.log(`lane ${row}: a reserve stepped in`);
  if (after.reserves !== before.reserves - 1) {
    fail(`lane ${row}: the pool went ${before.reserves} -> ${after.reserves}, expected one spent`);
  } else {
    console.log(`lane ${row}: the pool spent exactly one, ${before.reserves} -> ${after.reserves}`);
  }
}

/*
 * A lane that still has someone in it does not get a reserve. They are for a
 * line that broke, not a top-up, and there are far too few to spend
 * otherwise. Lane 0 still holds the archer posted on the parapet earlier.
 */
const heldBefore = await keep();
await page.evaluate(async () => {
  const b = globalThis.__battle;
  b.addGold(500);
  b.place('militia', 0, 5);
  b.felled(0, 5);
  await new Promise((res) => setTimeout(res, 900));
});
const heldAfter = await keep();
if (heldAfter.reserves !== heldBefore.reserves) {
  fail(`a lane that was still held spent a reserve anyway (${heldBefore.reserves} -> ${heldAfter.reserves})`);
} else {
  console.log('a lane that is still held calls nobody up');
}

/*
 * And when the pool is empty, nothing steps up and nothing goes negative.
 *
 * The whole lane has to be cleared each time, not just one cell: the earlier
 * rounds left reserves standing in these lanes, and a lane with someone in
 * it is not supposed to call anyone up.
 */
const left = (await keep()).reserves;
for (let i = 0; i < left + 2; i += 1) {
  await page.evaluate(async () => {
    const b = globalThis.__battle;
    for (const d of b.state().defenderDump) {
      if (!d.commander) b.felled(d.row, d.col);
    }
    await new Promise((res) => setTimeout(res, 900));
  });
}
const drained = await keep();
if (drained.reserves !== 0) fail(`the pool should be spent, it reads ${drained.reserves}`);
else console.log('the pool runs out rather than going negative');

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
