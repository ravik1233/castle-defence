/**
 * Drives the workshop loop: salvage in, gear out, and gear changing a fight.
 *
 * The interesting claim is the last one - that what the player bought between
 * battles is doing something inside the next one - so this fits equipment and
 * then reads the fort it produces.
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
await page.goto(`${base}/?unlock=1`, { waitUntil: 'load' });
await page.waitForFunction(() => globalThis.__game?.scene.getScenes(true)[0]?.scene.key === 'MainMenu', {
  timeout: 180000,
});

const battle = async (levelId) => {
  await page.evaluate((id) => {
    const g = globalThis.__game;
    for (const s of g.scene.getScenes(true)) g.scene.stop(s.scene.key);
    g.scene.start('Battle', { levelId: id, skipBriefing: true });
  }, levelId);
  await page.waitForFunction(() => Boolean(globalThis.__battle), { timeout: 180000 });
  await page.waitForTimeout(1200);
  return page.evaluate(() => globalThis.__battle.state());
};

/* ------------------------------------------------- a fort with nothing on */

const bare = await battle('c1l2');
console.log(`bare fort: ${bare.wallHp} of wall, ${bare.gold} gold`);

/* ------------------------------------------------------ buy and fit gear  */

const bought = await page.evaluate(() => {
  const p = globalThis.__profile;
  if (!p) return 'no profile hook';
  p.addSalvage(400);
  const ok = p.buyEquipment('reinforced') && p.buyEquipment('cellars');
  return ok && p.toggleEquipped('reinforced') && p.toggleEquipped('cellars') ? 'fitted' : 'refused';
});
if (bought !== 'fitted') fail(`could not buy and fit equipment: ${bought}`);

const salvageLeft = await page.evaluate(() => globalThis.__profile.salvage);
if (salvageLeft >= 400) fail(`buying two pieces did not spend salvage (${salvageLeft} left)`);

/* ------------------------------------------------ the same fort, equipped */

const armed = await battle('c1l2');
console.log(`fitted fort: ${armed.wallHp} of wall, ${armed.gold} gold`);
if (armed.wallHp <= bare.wallHp) fail(`reinforced gates gave ${armed.wallHp} against a bare ${bare.wallHp}`);
if (armed.gold <= bare.gold) fail(`deep cellars gave ${armed.gold} gold against a bare ${bare.gold}`);

/* ---------------------------------------------------- stock, made and spent */

const made = await page.evaluate(() => {
  const p = globalThis.__profile;
  p.addSalvage(200);
  return p.craft('repairkit') && p.stockOf('repairkit') > 0;
});
if (!made) fail('the workshop would not make a repair kit');

const fixed = await battle('c1l2');
await page.evaluate(() => globalThis.__battle.breach(1));
const breached = await page.evaluate(() => globalThis.__battle.state());
if (breached.breached !== 1) fail('could not open a lane to test the repair kit');
const usedOk = await page.evaluate(() => globalThis.__battle.useItem('repairkit'));
if (!usedOk) fail('the repair kit refused to be used on a breached lane');
const mended = await page.evaluate(() => globalThis.__battle.state());
if (mended.breached !== 0) fail(`a repair kit left ${mended.breached} lanes open`);
if (mended.gold !== fixed.gold) fail('a repair kit charged gold; it is meant to be free');
const stockLeft = await page.evaluate(() => globalThis.__profile.stockOf('repairkit'));
if (stockLeft !== 0) fail(`a spent repair kit is still in the pack (${stockLeft})`);
console.log('a repair kit closed the breach and was spent doing it');

await page.close();
await browser.close();
if (failed) process.exitCode = 1;
else console.log('WORKSHOP OK');
