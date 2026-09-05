/**
 * Native shell integration.
 *
 * All of it is optional: every call is guarded so the identical bundle runs in
 * a browser, where none of these plugins exist.
 */
import { audio } from './audio';

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, Record<string, (...args: never[]) => Promise<unknown>>>;
}

function cap(): CapacitorGlobal | undefined {
  return (globalThis as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export function isNative(): boolean {
  return Boolean(cap()?.isNativePlatform?.());
}

/**
 * Wires up the platform bits a phone game needs:
 *  - hide the splash once the first frame is up
 *  - immersive status bar over the canvas
 *  - stop the music when the app is backgrounded, so it does not keep playing
 *    over whatever the player switched to
 *  - Android back button leaves the current screen instead of killing the app
 */
export async function initNativeShell(onBack?: () => boolean): Promise<void> {
  if (!isNative()) return;
  const plugins = cap()?.Plugins ?? {};
  try {
    await plugins.SplashScreen?.hide?.();
  } catch {
    /* not installed */
  }
  try {
    await plugins.StatusBar?.setOverlaysWebView?.({ overlay: true } as never);
    await plugins.StatusBar?.setStyle?.({ style: 'DARK' } as never);
  } catch {
    /* not installed */
  }
  try {
    const app = plugins.App as unknown as
      | { addListener?: (event: string, cb: (info: unknown) => void) => void; exitApp?: () => void }
      | undefined;
    app?.addListener?.('appStateChange', (info) => {
      const active = (info as { isActive?: boolean }).isActive;
      if (active) audio.applySettings();
      else audio.stopMusic();
    });
    app?.addListener?.('backButton', () => {
      // onBack returns false when there is nowhere left to go back to.
      if (!onBack || !onBack()) app.exitApp?.();
    });
  } catch {
    /* not installed */
  }
}
