/**
 * Entry point. Phaser is configured for a fixed portrait design resolution
 * that is letterboxed to fit whatever phone it lands on.
 */
import Phaser from 'phaser';
import { DESIGN } from './core/layout';
import { PreloadScene } from './scenes/Preload';
import { MainMenuScene } from './scenes/MainMenu';
import { MapScene } from './scenes/Map';
import { BattleScene } from './scenes/Battle';
import { ArmoryScene } from './scenes/Armory';
import { StoreScene } from './scenes/Store';
import { SettingsScene } from './scenes/Settings';
import { ResultScene } from './scenes/Result';
import { audio } from './systems/audio';
import { ads } from './systems/ads';
import { initNativeShell } from './systems/native';
import { installTouchDebug, installViewportFit } from './systems/viewport';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#140f1e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: DESIGN.width,
    height: DESIGN.height,
    // The container is sized from the visual viewport by installViewportFit;
    // letting Phaser listen to window resize as well would fight it.
    parent: 'game',
    expandParent: false,
  },
  render: {
    antialias: true,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  fps: { target: 60, min: 30 },
  scene: [
    PreloadScene,
    MainMenuScene,
    MapScene,
    BattleScene,
    ArmoryScene,
    StoreScene,
    SettingsScene,
    ResultScene,
  ],
};

export const game = new Phaser.Game(config);

// Exposed for automated smoke tests and profiling.
(globalThis as unknown as { __game?: Phaser.Game }).__game = game;

// Must come before anything measures the canvas: mobile browsers report a
// viewport that includes the space behind their own chrome.
installViewportFit(game);
if (new URLSearchParams(location.search).get('touchdebug') === '1') installTouchDebug(game);

// Audio contexts need a gesture on mobile; the first touch anywhere unlocks it.
const unlock = (): void => {
  audio.unlock();
  audio.applySettings();
};
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });

void ads.init();

// On device: hide the splash, own the status bar, and make the Android back
// button walk back through screens rather than quitting mid-battle.
void initNativeShell(() => {
  const active = game.scene.getScenes(true)[0];
  const key = active?.scene.key;
  if (!key || key === 'MainMenu') return false;
  active.scene.start(key === 'Battle' || key === 'Result' ? 'Map' : 'MainMenu');
  return true;
});

// Hand the screen over from the HTML splash once Phaser has a canvas up.
game.events.once('ready', () => {
  document.getElementById('boot')?.classList.add('hide');
});

// Pause the world when the app goes to the background so battles never run
// on unfocused. Phaser handles most of this; the music bed does not.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.stopMusic();
});
