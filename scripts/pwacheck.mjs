/**
 * Checks the things Chrome on Android requires before it will offer to
 * install the game, plus that the service worker actually takes control.
 */
import { launchBrowser } from './browser.mjs';

const base = process.argv[2] ?? 'http://localhost:5199';
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
let failed = false;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` - ${detail}` : ''}`);
  if (!ok) failed = true;
};

await page.goto(`${base}/`, { waitUntil: 'load' });
// A service worker claiming the page can abort requests already in flight, so
// let it settle before probing anything.
await page
  .waitForFunction(() => navigator.serviceWorker?.controller !== null, { timeout: 15000 })
  .catch(() => undefined);
await page.waitForTimeout(1000);

const manifestHref = await page.evaluate(
  () => document.querySelector('link[rel=manifest]')?.getAttribute('href') ?? null,
);
check(Boolean(manifestHref), 'manifest link present', manifestHref ?? '');

const manifest = await page.evaluate(async (href) => {
  const res = await fetch(href);
  if (!res.ok) return { error: res.status };
  return res.json();
}, manifestHref ?? './manifest.webmanifest');

check(!manifest.error, 'manifest fetches', manifest.error ? `HTTP ${manifest.error}` : '');
check(Boolean(manifest.name && manifest.short_name), 'name and short_name');
check(['standalone', 'fullscreen'].includes(manifest.display), 'display is app-like', manifest.display);
check(manifest.orientation === 'portrait', 'locked to portrait', manifest.orientation);
check(Boolean(manifest.start_url), 'start_url', manifest.start_url);
check(Boolean(manifest.background_color && manifest.theme_color), 'background and theme colours');

const icons = manifest.icons ?? [];
check(icons.some((i) => i.sizes === '192x192'), 'has a 192px icon');
check(icons.some((i) => i.sizes === '512x512'), 'has a 512px icon');
check(icons.some((i) => (i.purpose ?? '').includes('maskable')), 'has a maskable icon');

for (const icon of icons) {
  const status = await page.evaluate(async (src) => (await fetch(src)).status, icon.src);
  check(status === 200, `icon reachable: ${icon.src}`, `HTTP ${status}`);
}

const sw = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? 'registered' : 'none';
});
check(sw === 'registered', 'service worker registered', sw);

await browser.close();
if (failed) process.exitCode = 1;
else console.log('\nPWA OK - Chrome on Android will offer to install this.');
