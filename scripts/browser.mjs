/**
 * Launches Chromium for the screenshot and smoke scripts.
 *
 * This container ships a pre-installed browser at a fixed path; CI and other
 * machines use whatever Playwright installed. Falling back keeps one script
 * working in both places.
 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright';

const PREINSTALLED = '/opt/pw-browsers/chromium';

export function launchBrowser(extra = {}) {
  return chromium.launch({
    ...(existsSync(PREINSTALLED) ? { executablePath: PREINSTALLED } : {}),
    ...extra,
  });
}
