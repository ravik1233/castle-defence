/**
 * Installing and going fullscreen on Android.
 *
 * Played in a browser tab the game loses its top and bottom edges to browser
 * chrome, and the URL bar collapsing mid-game moves everything. Installed to
 * the home screen from Chrome it runs fullscreen with none of that, which is
 * the experience the game is designed for - so it asks, once, at a sensible
 * moment.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | undefined;
const DISMISS_KEY = 'lastgate.installPromptDismissed';

export function initInstall(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    // Chrome shows its own mini-infobar otherwise, at a moment of its choosing.
    e.preventDefault();
    deferred = e as InstallPromptEvent;
  });
  window.addEventListener('appinstalled', () => {
    deferred = undefined;
  });

  // Browsers treat localhost as a secure origin, so this works in dev too.
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if ('serviceWorker' in navigator && secure) {
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register('./sw.js').catch(() => undefined);
    });
  }
}

/** True when the game is running as an installed app rather than in a tab. */
export function isInstalled(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function canInstall(): boolean {
  return deferred !== undefined && !isInstalled();
}

export function installDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissInstall(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* private mode */
  }
}

/** Shows Chrome's install sheet. Resolves true if the player installed it. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const event = deferred;
  deferred = undefined;
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome === 'accepted';
  } catch {
    return false;
  }
}

/* --------------------------------------------------------------- fullscreen */

export function fullscreenSupported(): boolean {
  return typeof document.documentElement.requestFullscreen === 'function';
}

export function isFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

/**
 * Must be called from a user gesture. Also locks to portrait where the
 * browser allows it, which Chrome on Android does once fullscreen.
 */
export async function enterFullscreen(): Promise<boolean> {
  if (!fullscreenSupported() || isFullscreen()) return isFullscreen();
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    const orientation = screen.orientation as unknown as { lock?: (o: string) => Promise<void> };
    await orientation?.lock?.('portrait').catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

export async function exitFullscreen(): Promise<void> {
  if (isFullscreen()) await document.exitFullscreen().catch(() => undefined);
}

export async function toggleFullscreen(): Promise<boolean> {
  if (isFullscreen()) {
    await exitFullscreen();
    return false;
  }
  return enterFullscreen();
}
