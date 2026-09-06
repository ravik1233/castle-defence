import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Native shell configuration.
 *
 * The game is a static web build, so Capacitor simply hosts `dist/` inside an
 * Android WebView. Android only - see docs/PLAY_STORE.md. Portrait is locked
 * in AndroidManifest.xml; everything else the game needs is set here.
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
  // Android 13+ predictive back is handled by the app itself.
  server: {
    androidScheme: 'https',
  },
};

export default config;
