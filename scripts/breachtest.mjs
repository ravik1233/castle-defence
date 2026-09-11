/**
 * Drives a breach end to end.
 *
 * The mechanic is only worth anything if enemies actually come through a
 * fallen section and the keep actually takes the damage, so this plays it
 * rather than asserting on the scoring function: knock a section out, put an
 * enemy in that lane, and watch where it walks and what it hits.
 */
import { launchBrowser } from './browser.mjs';

const base = process.argv[2] ?? 'http://localhost:5199';
const browser = await launchBrowser();
let failed = false;
const fail = (m) => {
  console.error('FAIL:', m);
  failed = true;
};

/**
 * Anything left of the wall face has come through rather than stopped at it.
 *
 * Read from the battle rather than written down here: the wall moved when it
 * became two tiles of the grid, and a driver holding its own copy of the
 * geometry starts lying the moment the layout changes.
 */
let WALL_FACE = 0;
/** Where to put an enemy so it is just outside the wall, not inside it. */
let CLOSE_X = 0;

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => fail(`page error: ${String(e).slice(0, 160)}`));
await page.goto(`${base}/`, { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__game?.scene.getScenes(true)[0]?.scene.key === 'MainMenu', {
  timeout: 180000,
});

// Straight into a battle through the test hooks the smoke run uses.
await page.evaluate(() => {
  const g = globalThis.__game;
  g.scene.getScenes(true)[0].scene.start('Battle', { levelId: 'c1l1' });
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

({ wallFaceX: WALL_FACE } = await state());
/*
 * Stop here rather than run on a missing number. When this was read from the
 * wrong hook and came back undefined, every `e.x < WALL_FACE` was false and
 * the run reported five separate failures - a breach nothing walked through,
 * a keep that took no damage, a flanker that never turned - none of which
 * was true. A driver that cannot locate the wall has nothing to say.
 */
if (typeof WALL_FACE !== 'number' || !Number.isFinite(WALL_FACE)) {
  console.error(`FAIL: the battle did not report where its wall is (${WALL_FACE})`);
  await browser.close();
  process.exit(1);
}
CLOSE_X = WALL_FACE + 160;

const start = await state();
if (start.breached !== 0) fail(`a fresh battle starts with ${start.breached} breached sections`);
if (start.heartHp <= 0) fail('the keep starts with no heart');

// Open lane 2 and send something through it.
await page.evaluate(() => globalThis.__battle.breach(2));
const opened = await state();
if (opened.breached !== 1) fail(`breaching one lane reported ${opened.breached} breached`);

/*
 * Spawned close to the wall on purpose. A headless container has no GPU, so
 * the game clock runs at a fraction of real time and marching the full width
 * of the field would take minutes.
 */
await page.evaluate((x) => globalThis.__battle.spawn('orc', 2, x), CLOSE_X);
// Past the wall face means it went through the gap rather than stopping at it.
const through = await until(
  (s) => s.enemyDump.some((e) => e.row === 2 && e.x < WALL_FACE),
  240000,
  'an enemy to walk through the breach',
);
if (through) console.log('enemy came through the breach');

/*
 * A second one, put down already inside.
 *
 * The courtyard got a lot deeper when the wall became two tiles: the face is
 * at ~594 and the commander stands at 100, so a body that comes through has
 * four hundred pixels to walk before it can swing at him. At the fraction of
 * real time this container runs the clock at, that walk alone outlasted the
 * wait - the keep was struck, just after the driver had given up on it, and
 * the run reported a failure for something that had happened.
 */
// Clear the one that walked in first: the point below is whether the keep
// can put down a body that gets inside, and leaving two in there tests
// whether the commander can fight a crowd single-handed, which is a
// different question and not one this file is asking.
await page.evaluate(() => globalThis.__battle.clearField(Infinity));
await page.waitForTimeout(500);
await page.evaluate((x) => globalThis.__battle.spawn('orc', 2, x), Math.round(WALL_FACE * 0.45));
if (await until((s) => s.heartHp < opened.heartHp, 300000, 'the keep to take damage')) {
  console.log('the keep took damage from inside');
}

/*
 * The point of a breach is that it is survivable. An enemy that gets inside
 * has to be killable, or one breach plus one enemy is a certain loss on a
 * timer and none of the rest of this matters.
 */
if (
  await until(
    (s) => !s.enemyDump.some((e) => e.row === 2 && e.x < WALL_FACE),
    300000,
    'the keep to kill what came through',
  )
) {
  console.log('the garrison cleared the breach');
}
const survived = await state();
if (survived.heartHp <= 0) fail('the keep died to a single enemy coming through');
else console.log(`keep survived one breach with ${survived.heartHp} left`);

// And a lane that is still standing must still stop things.
await page.evaluate((x) => globalThis.__battle.spawn('orc', 0, x), CLOSE_X);
await until((s) => s.enemyDump.some((e) => e.row === 0 && e.x < WALL_FACE + 60), 240000, 'an enemy to reach lane 0');
await page.waitForTimeout(8000);
const held = await state();
if (held.enemyDump.some((e) => e.row === 0 && e.x < WALL_FACE)) {
  fail('an enemy walked through a section that had not fallen');
} else {
  console.log('an intact section still holds the line');
}

// Rebuilding closes it again.
await page.evaluate(() => {
  globalThis.__battle.addGold(500);
  globalThis.__battle.repair(2);
});
const repaired = await state();
// Lane 2 specifically: the level's own waves are still arriving and may well
// have opened other lanes while this test was walking one orc across.
if ((repaired.sections[2] ?? 0) <= 0) fail('rebuilding lane 2 left it breached');
else console.log(`a rebuilt section closes the breach (lane 2 back to ${repaired.sections[2]})`);

/*
 * The flanker. It should come through the breach and then turn into a lane
 * that is still held, rather than queueing at the heart - and it has to stay
 * killable there, or it is the unkillable-inside bug wearing a new hat.
 */
await page.evaluate((x) => {
  globalThis.__battle.addGold(900);
  globalThis.__battle.breach(4);
  // Something for it to hunt, in the lane next door. Placed out in the field
  // rather than on the parapet, so the flanker has to come to them.
  globalThis.__battle.place('militia', 3, 3);
  globalThis.__battle.place('archer', 3, 4);
  globalThis.__battle.spawn('cutthroat', 4, x);
}, CLOSE_X);
const turned = await until(
  (s) => s.enemyDump.some((e) => e.id === 'cutthroat' && e.row === 3),
  240000,
  'the flanker to turn into a held lane',
);
if (turned) console.log('the flanker turned into a defended lane');
if (
  await until(
    (s) => !s.enemyDump.some((e) => e.id === 'cutthroat'),
    240000,
    'the defenders to kill the flanker',
  )
) {
  console.log('defenders cut down the flanker from behind');
}

await page.close();
await browser.close();
if (failed) process.exitCode = 1;
else console.log('BREACH OK');
