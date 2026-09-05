import { chromium } from 'playwright';
const url = process.argv[2];
// Outbound traffic in this environment goes through the agent proxy.
const proxy = process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY;
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  ...(proxy ? { proxy: { server: proxy } } : {}),
  args: ['--ignore-certificate-errors'],
});
const page = await browser.newPage({ viewport: { width: 720, height: 1280 }, isMobile: true, hasTouch: true });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
const t0 = Date.now();
await page.goto(url, { waitUntil: 'load' });
await page
  .waitForFunction(() => globalThis.__game?.scene.getScenes(true)[0]?.scene.key !== 'Preload', { timeout: 120000 })
  .catch(() => {});
const bootMs = Date.now() - t0;
await page.waitForTimeout(2500);
const s = await page.evaluate(() => ({
  scene: globalThis.__game?.scene.getScenes(true)[0]?.scene.key,
  textures: Object.keys(globalThis.__game?.textures.list ?? {}).length,
}));
console.log('boot(ms):', bootMs, JSON.stringify(s), 'pageerrors:', errs.length, errs.slice(0, 3).join(' | '));
await page.screenshot({ path: 'screenshots/live.png' });
await browser.close();
