import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native shell configuration.
 *
 * The game is a static web build, so Capacitor simply hosts `dist/` inside a
 * WebView. Portrait is locked in the platform manifests (see docs/STORE.md);
 * everything else the game needs is set here.
 */
const config: CapacitorConfig = {
  appId: 'com.lastgate.game',
  appName: 'The Last Gate',
  webDir: 'dist',
  backgroundColor: '#140f1e',
  android: {
    backgroundColor: '#140f1e',
    // The game draws its own UI; a scrollable WebView would fight the canvas.
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    backgroundColor: '#140f1e',
    contentInset: 'never',
    scrollEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: '#140f1e',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#140f1e',
      overlaysWebView: true,
    },
  },
};

export default config;
