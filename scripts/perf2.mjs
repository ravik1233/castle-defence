import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const routes = process.argv.slice(2);
for (const route of routes) {
  const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
  await page.goto(`http://localhost:5199${route}`, { waitUntil: 'load' });
  await page.waitForFunction(() => globalThis.__game?.scene.getScenes(true)[0]?.scene.key !== 'Preload', { timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(8000);
  const s = await page.evaluate(() => {
    const g = globalThis.__game;
    if (!g) return { boot: false };
    const sc = g.scene.getScenes(true)[0];
    return {
      scene: sc?.scene.key,
      fps: Math.round(g.loop.actualFps),
      children: sc ? sc.children.list.length : 0,
      textures: Object.keys(g.textures.list).length,
    };
  });
  console.log(route, JSON.stringify(s));
  await page.close();
}
await browser.close();
