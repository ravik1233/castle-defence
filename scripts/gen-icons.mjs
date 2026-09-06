/**
 * Renders the store artwork in src/art/icons.ts to PNG files.
 * Requires the dev server on :5199.
 *   node scripts/gen-icons.mjs
 */
import { mkdirSync } from 'node:fs';
import { launchBrowser } from './browser.mjs';

mkdirSync('resources', { recursive: true });
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1400, height: 1400 } });
await page.goto('http://localhost:5199/iconsheet.html', { waitUntil: 'load' });
await page.waitForTimeout(1500);

mkdirSync('public/icons', { recursive: true });
const targets = [
  ['icon', 'resources/icon.png'],
  ['icon-foreground', 'resources/icon-foreground.png'],
  ['icon-background', 'resources/icon-background.png'],
  ['splash', 'resources/splash.png'],
  ['favicon', 'public/icons/icon-180.png'],
  ['pwa-192', 'public/icons/icon-192.png'],
  ['pwa-512', 'public/icons/icon-512.png'],
  ['maskable-512', 'public/icons/maskable-512.png'],
];
for (const [id, path] of targets) {
  await page.locator(`#${id}`).screenshot({ path });
  console.log('wrote', path);
}
await browser.close();
