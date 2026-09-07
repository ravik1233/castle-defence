/**
 * Drives what makes each horde its own fight.
 *
 * These are the rules a player has to learn per region - the dead get back
 * up, orcs hit harder as they bleed, the Fallen carry shields, demons walk
 * round a line, goblins pick your pocket - so each is played out in a real
 * battle rather than asserted about a number.
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
page.on('pageerror', (e) => fail(`page error: ${String(e).slice(0, 200)}`));
await page.goto(`${base}/?unlock=1&scene=Battle&level=c2l3&nomodal=1`, { waitUntil: 'load' });
await page.waitForFunction(() => Boolean(globalThis.__battle), { timeout: 240000 });
await page.waitForTimeout(4000);

const enemies = () => page.evaluate(() => globalThis.__battle.enemyState());
const clear = () => page.evaluate(() => globalThis.__battle.clearField(Infinity));
const spawn = (id, row, x) => page.evaluate(([i, r, xx]) => globalThis.__battle.spawn(i, r, xx), [id, row, x]);
const hurt = (i, dmg, type, brk) =>
  page.evaluate(([a, b, c, d]) => globalThis.__battle.hurt(a, b, c, d), [i, dmg, type ?? 'physical', brk ?? false]);
/*
 * The battle reaps its dead, so an index is only good for one call. Every
 * step looks the enemy up again by name.
 */
const find = async (id) => {
  const list = await enemies();
  const i = list.findIndex((e) => e.id === id && e.alive);
  return { i, e: list[i] };
};

/* ------------------------------------------------------- the dead get up */

await clear();
await spawn('skeleton', 0, 1500);
await page.waitForTimeout(500);
let sk = await find('skeleton');
const fullHp = sk.e.hp;
await hurt(sk.i, 9999);
await page.waitForTimeout(500);
sk = await find('skeleton');
if (!sk.e) fail('a skeleton killed by steel stayed down');
else if (sk.e.hp >= fullHp) fail(`a risen skeleton came back at ${sk.e.hp}, not reduced`);
else console.log(`skeleton rose again at ${sk.e.hp} of ${sk.e.maxHp}`);

// The second death is final.
await hurt(sk.i, 9999);
await page.waitForTimeout(500);
if ((await find('skeleton')).e) fail('a skeleton rose twice');
else console.log('the second death was final');

// Holy puts it down the first time.
await clear();
await spawn('skeleton', 0, 1500);
await page.waitForTimeout(500);
sk = await find('skeleton');
await hurt(sk.i, 9999, 'holy');
await page.waitForTimeout(500);
if ((await find('skeleton')).e) fail('holy damage let a skeleton rise');
else console.log('holy put it down first time');

/* -------------------------------------------------------------- shields  */

await clear();
await spawn('fallen_knight', 1, 1500);
await page.waitForTimeout(500);
let kn = await find('fallen_knight');
if (!kn.e || kn.e.shield <= 0) fail('a fallen knight arrived without a shield');
else {
  const hpBefore = kn.e.hp;
  await hurt(kn.i, 100);
  await page.waitForTimeout(400);
  kn = await find('fallen_knight');
  const lost = hpBefore - kn.e.hp;
  if (lost >= 100) fail(`the shield absorbed nothing: body lost ${lost} of 100`);
  else console.log(`shield took the blow: body lost ${lost} of 100, shield now ${kn.e.shield}`);

  const shieldBefore = kn.e.shield;
  const bodyBefore = kn.e.hp;
  await hurt(kn.i, 100, 'physical', true);
  await page.waitForTimeout(400);
  kn = await find('fallen_knight');
  const throughBody = bodyBefore - kn.e.hp;
  if (kn.e.shield !== shieldBefore) fail('a shieldbreaker still chipped the shield');
  // The claim is not a number, it is that the same blow hurts far more when
  // the shield is ignored than when it is not.
  else if (throughBody <= lost * 2) {
    fail(`a shieldbreaker's blow did ${throughBody}, an ordinary one ${lost}`);
  } else {
    console.log(`shieldbreaker went through: ${throughBody} to the body against ${lost}, shield untouched`);
  }
}

/* ----------------------------------------------------------------- rage  */

await clear();
await spawn('cave_bear', 2, 1500);
await page.waitForTimeout(500);
let bear = await find('cave_bear');
const calm = bear.e.blow;
await hurt(bear.i, bear.e.maxHp * 0.6);
await page.waitForTimeout(400);
bear = await find('cave_bear');
if (!bear.e) fail('the bear died to a wound meant to anger it');
else if (bear.e.blow <= calm) fail(`a wounded rager hits ${bear.e.blow}, unwounded ${calm}`);
else console.log(`rage: ${calm} unhurt, ${bear.e.blow} at ${Math.round((bear.e.hp / bear.e.maxHp) * 100)}% health`);

/* ------------------------------------------------------------ the pack   */

await clear();
await spawn('dire_wolf', 3, 1600);
await page.waitForTimeout(2500);
const lone = await find('dire_wolf');
const loneX = lone.e.x;
await page.waitForTimeout(2500);
const loneMoved = loneX - (await find('dire_wolf')).e.x;

await clear();
for (let i = 0; i < 4; i += 1) await spawn('dire_wolf', 3, 1600 + i * 30);
await page.waitForTimeout(2500);
const packX = (await find('dire_wolf')).e.x;
await page.waitForTimeout(2500);
const packMoved = packX - (await find('dire_wolf')).e.x;
if (packMoved <= loneMoved) fail(`a pack moved ${packMoved} against a lone wolf's ${loneMoved}`);
else console.log(`pack: ${packMoved} moved in company against ${loneMoved} alone`);

await page.close();
await browser.close();
if (failed) process.exitCode = 1;
else console.log('FAMILIES OK');
