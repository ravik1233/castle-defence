/**
 * Screenshot helper. Expects a dev server already running on :5199
 * (`npm run dev -- --port 5199`).
 *   node scripts/shot.mjs /preview.html art.png [width] [height] [waitMs] [--viewport]
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const [route = '/', out = 'shot.png', w = '900', h = '1400', wait = '1200'] = args.filter(
  (a) => !a.startsWith('--'),
);
mkdirSync('screenshots', { recursive: true });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({
  viewport: { width: Number(w), height: Number(h) },
  deviceScaleFactor: Number(process.env.DSF ?? 1),
  isMobile: flags.has('--mobile'),
  hasTouch: flags.has('--mobile'),
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text());
});
await page.goto(`http://localhost:5199${route}`, { waitUntil: 'load' });
await page.waitForTimeout(Number(wait));

// --tap=x,y;x,y  clicks points (in viewport coords) with a pause between.
const tapArg = args.find((a) => a.startsWith('--tap='));
if (tapArg) {
  for (const pair of tapArg.slice(6).split(';')) {
    const [tx, ty] = pair.split(',').map(Number);
    await page.mouse.click(tx, ty);
    await page.waitForTimeout(600);
  }
}
const afterArg = args.find((a) => a.startsWith('--after='));
if (afterArg) await page.waitForTimeout(Number(afterArg.slice(8)));
const stats = await page
  .evaluate(() => {
    const g = window.__game;
    if (!g) return null;
    return { fps: Math.round(g.loop.actualFps), scene: g.scene.getScenes(true).map((s) => s.scene.key) };
  })
  .catch(() => null);
if (stats) console.log('fps', stats.fps, 'scenes', stats.scene.join(','));
await page.screenshot({ path: `screenshots/${out}`, fullPage: !flags.has('--viewport') });
await browser.close();
if (errors.length) {
  console.error('PAGE ERRORS:\n' + errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`saved screenshots/${out}`);
}
