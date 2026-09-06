/**
 * Smoke test: boots the game, plays a real battle through the scene's test
 * hooks, and asserts the simulation progresses to a victory.
 *
 *   node scripts/smoke.mjs [baseUrl]
 *
 * Waits are condition-based, not fixed: CI containers have no GPU, so the
 * game clock there runs a fraction of real time.
 */
import { launchBrowser } from './browser.mjs';

const base = process.argv[2] ?? 'http://localhost:5199';
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [];
// Network noise from the optional web font / favicon is not a game failure.
const IGNORE = /favicon|fonts\.googleapis|fonts\.gstatic|ERR_CONNECTION_RESET|Failed to load resource/;
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(m.text());
});

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
};
const state = () => page.evaluate(() => globalThis.__battle.state());
/**
 * Polls from node rather than page.waitForFunction: an in-page polling loop
 * competes with the game's own requestAnimationFrame on a software renderer,
 * and can starve the very simulation it is waiting on.
 */
const until = async (fn, what, timeoutMs = 420000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await page.evaluate(fn)) return true;
    await page.waitForTimeout(2000);
  }
  fail(`timed out waiting for ${what}`);
  return false;
};

await page.goto(`${base}/?scene=Battle&level=c1l4&unlock=1&nomodal=1`, { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__battle !== undefined, { timeout: 180000 });
console.log('battle scene booted');

await page.evaluate(() => globalThis.__battle.addGold(5000));
for (let row = 0; row < 5; row += 1) {
  const ok = await page.evaluate(
    ([r]) => globalThis.__battle.place('militia', r, 1) && globalThis.__battle.place('archer', r, 0),
    [row],
  );
  if (!ok) fail(`could not place defenders in row ${row}`);
}
if (await page.evaluate(() => globalThis.__battle.place('militia', 0, 1))) {
  fail('placed two defenders in the same cell');
}

const placed = await state();
if (placed.defenders !== 10) fail(`expected 10 defenders, got ${placed.defenders}`);
console.log('placed defenders:', placed.defenders);

await page.evaluate(() => {
  for (let r = 0; r < 5; r += 1) {
    globalThis.__battle.spawn('goblin', r);
    globalThis.__battle.spawn('goblin_runner', r);
  }
});
if ((await state()).enemies !== 10) fail('enemies did not spawn');
console.log('spawned enemies: 10');

await until(() => globalThis.__battle.state().kills >= 5, 'the defenders to kill half the wave');
const mid = await state();
console.log('mid-combat:', JSON.stringify({ kills: mid.kills, gold: mid.gold, wallHp: mid.wallHp }));
if (mid.gold <= placed.gold - 5000) fail('kills paid no gold');
if (mid.wallHp !== 1000) fail('the wall took damage it should not have');
await page.screenshot({ path: 'screenshots/smoke-battle.png' });

await page.evaluate(() => globalThis.__battle.castAt(0, 700, 700));

// Victory path: jump to the final wave and let the field clear.
await page.evaluate(() => globalThis.__battle.endWaves());
await until(() => globalThis.__battle.state().finished, 'the battle to resolve');
await until(
  () => globalThis.__game.scene.getScenes(true).some((s) => s.scene.key === 'Result'),
  'the results screen',
);
const scenes = await page.evaluate(() => globalThis.__game.scene.getScenes(true).map((s) => s.scene.key));
console.log('after victory, scenes:', scenes.join(','));

await page.waitForTimeout(2500);
await page.screenshot({ path: 'screenshots/smoke-result.png' });


/* ---------------------------------------------------------------------------
 * The fail state is the whole premise of the game, so it gets tested too:
 * an undefended gate must take damage and end the run.
 * ------------------------------------------------------------------------- */
// One game at a time: two Phaser instances share the GPU (or, in CI, the
// software renderer) and both crawl.
await page.close();
const lose = await browser.newPage({ viewport: { width: 1280, height: 720 } });
lose.on('pageerror', (e) => errors.push(String(e)));
await lose.goto(`${base}/?scene=Battle&level=c1l4&unlock=1&nomodal=1`, { waitUntil: 'load' });
await lose.waitForFunction(() => globalThis.__battle !== undefined, { timeout: 180000 });
await lose.evaluate(() => {
  globalThis.__battle.endWaves();
  // Spawned near the wall on purpose: this test is about the gate falling,
  // not about how long a berserker takes to cross a lane.
  for (let r = 0; r < 5; r += 1) globalThis.__battle.spawn('orc_berserker', r, 520);
});

const untilOn = async (target, fn, what, timeoutMs = 300000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await target.evaluate(fn)) return true;
    await target.waitForTimeout(2000);
  }
  fail(`timed out waiting for ${what}`);
  return false;
};

await untilOn(lose, () => globalThis.__battle.state().wallHp < 1000, 'the gate to take damage');
console.log('gate under attack:', JSON.stringify(await lose.evaluate(() => globalThis.__battle.state().wallHp)));
await untilOn(
  lose,
  () => globalThis.__game.scene.getScenes(true).some((s) => s.scene.key === 'Result'),
  'the defeat screen',
);
await lose.waitForTimeout(2000);
await lose.screenshot({ path: 'screenshots/smoke-defeat.png' });
console.log('defeat path reached the results screen');

if (errors.length) fail(`page errors:\n${errors.join('\n')}`);
await browser.close();
if (!process.exitCode) console.log('SMOKE OK');
