/** Screenshots the meta screens at the design aspect. */
import { launchBrowser } from './browser.mjs';
const b = await launchBrowser();
for (const [scene, name] of [
  ['MainMenu', 'menu'],
  ['Map', 'map'],
  ['Armory', 'armory'],
  ['Store', 'store'],
  ['Settings', 'settings'],
]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, isMobile: true, hasTouch: true });
  await p.goto(`http://localhost:5199/?scene=${scene}&unlock=1`, { waitUntil: 'load' });
  await p.waitForFunction((s) => globalThis.__game?.scene.getScenes(true)[0]?.scene.key === s, scene, { timeout: 180000 }).catch(() => {});
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `screenshots/ls-${name}.png` });
  await p.close();
}
await b.close();
console.log('screens done');
