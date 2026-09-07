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

/** Anything left of the wall face has come through rather than stopped at it. */
const WALL_FACE = 200;

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
await page.evaluate(() => globalThis.__battle.spawn('orc', 2, 330));
// Past the wall face means it went through the gap rather than stopping at it.
const through = await until(
  (s) => s.enemyDump.some((e) => e.row === 2 && e.x < WALL_FACE),
  240000,
  'an enemy to walk through the breach',
);
if (through) console.log('enemy came through the breach');

if (await until((s) => s.heartHp < opened.heartHp, 240000, 'the keep to take damage')) {
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
    240000,
    'the keep to kill what came through',
  )
) {
  console.log('the garrison cleared the breach');
}
const survived = await state();
if (survived.heartHp <= 0) fail('the keep died to a single enemy coming through');
else console.log(`keep survived one breach with ${survived.heartHp} left`);

// And a lane that is still standing must still stop things.
await page.evaluate(() => globalThis.__battle.spawn('orc', 0, 330));
await until((s) => s.enemyDump.some((e) => e.row === 0 && e.x < 260), 240000, 'an enemy to reach lane 0');
await page.waitForTimeout(8000);
const held = await state();
if (held.enemyDump.some((e) => e.row === 0 && e.x < 200)) {
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

await page.close();
await browser.close();
if (failed) process.exitCode = 1;
else console.log('BREACH OK');
