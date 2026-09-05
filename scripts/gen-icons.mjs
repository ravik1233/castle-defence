/**
 * Renders the store artwork in src/art/icons.ts to PNG files.
 * Requires the dev server on :5199.
 *   node scripts/gen-icons.mjs
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

mkdirSync('resources', { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
await page.goto('http://localhost:5199/iconsheet.html', { waitUntil: 'load' });
await page.waitForTimeout(1500);

const targets = [
  ['icon', 'resources/icon.png'],
  ['icon-foreground', 'resources/icon-foreground.png'],
  ['icon-background', 'resources/icon-background.png'],
  ['splash', 'resources/splash.png'],
  ['favicon', 'public/apple-touch-icon.png'],
];
for (const [id, path] of targets) {
  await page.locator(`#${id}`).screenshot({ path });
  console.log('wrote', path);
}
await browser.close();
