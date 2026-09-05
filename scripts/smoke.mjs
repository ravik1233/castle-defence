/**
 * Smoke test: boots the game, plays a real battle through the scene's test
 * hooks, and asserts the simulation actually progresses.
 *   node scripts/smoke.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5199';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
// Network noise from the optional web font / favicon is not a game failure.
const IGNORE = /favicon|fonts\.googleapis|fonts\.gstatic|ERR_CONNECTION_RESET|Failed to load resource/;
page.on('console', (m) => {
  if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(m.text());
});

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
};

await page.goto(`${base}/?scene=Battle&level=c1l4&unlock=1&nomodal=1`, { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__battle !== undefined, { timeout: 120000 });
console.log('battle scene booted');

const place = (id, row, col) => page.evaluate(([i, r, c]) => globalThis.__battle.place(i, r, c), [id, row, col]);
const state = () => page.evaluate(() => globalThis.__battle.state());

await page.evaluate(() => globalThis.__battle.addGold(5000));
for (let row = 0; row < 5; row += 1) {
  if (!(await place('militia', row, 1))) fail(`could not place militia in row ${row}`);
  if (!(await place('archer', row, 0))) fail(`could not place archer in row ${row}`);
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
const spawned = await state();
if (spawned.enemies < 10) fail(`expected 10 enemies, got ${spawned.enemies}`);
console.log('spawned enemies:', spawned.enemies);

// Let the fight run. The container has no GPU, so give it plenty of wall time.
await page.waitForTimeout(45000);
const after = await state();
console.log('after combat:', JSON.stringify(after));
if (after.kills === 0) fail('no enemies died in 45s of combat');
if (after.gold <= placed.gold - 5000) fail('no gold was earned');

await page.evaluate(() => globalThis.__battle.castAt(0, 700, 700));
await page.waitForTimeout(2000);

await page.screenshot({ path: 'screenshots/smoke-battle.png' });

if (errors.length) fail(`page errors:\n${errors.join('\n')}`);
await browser.close();
if (!process.exitCode) console.log('SMOKE OK');
