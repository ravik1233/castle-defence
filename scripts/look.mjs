/** Sets up a busy battle and screenshots it. node scripts/look.mjs [level] [out] */
import { launchBrowser } from './browser.mjs';
const level = process.argv[2] ?? 'c1l6';
const out = process.argv[3] ?? 'look.png';
const b = await launchBrowser();
const p = await b.newPage({ viewport: { width: 1280, height: 720 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await p.goto(`http://localhost:5199/?scene=Battle&level=${level}&unlock=1&nomodal=1`, { waitUntil: 'load' });
await p.waitForFunction(() => globalThis.__battle !== undefined, { timeout: 180000 });
await p.evaluate(() => {
  globalThis.__battle.addGold(9000);
  // Columns 0 and 1 are the parapet now. Rangers go up there, because that is
  // the view worth looking at; anything that earns rather than fights has to
  // stand in the field, so its column is read from the battle rather than
  // written here and quietly rejected.
  const f = globalThis.__battle.state().fieldCol0;
  for (let r = 0; r < 5; r += 1) globalThis.__battle.place('archer', r, 0);
  globalThis.__battle.place('guardian', 1, f + 1);
  globalThis.__battle.place('militia', 0, f + 1);
  globalThis.__battle.place('militia', 2, f + 1);
  globalThis.__battle.place('tithe', 3, f);
  globalThis.__battle.place('tithe', 4, f);
  globalThis.__battle.place('barricade', 4, f + 3);
  globalThis.__battle.place('bombard', 2, f);
  for (let r = 0; r < 5; r += 1) { globalThis.__battle.spawn('goblin', r); globalThis.__battle.spawn('hobgoblin', r); }
  globalThis.__battle.spawn('orc', 2);
  globalThis.__battle.spawn('imp', 1);
  globalThis.__battle.spawn('troll', 3);
});
await p.waitForTimeout(24000);
await p.screenshot({ path: `screenshots/${out}` });
await b.close();
