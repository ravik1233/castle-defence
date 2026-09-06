/** Title screen. */
import Phaser from 'phaser';
import { DESIGN } from '../core/layout';
import { profile } from '../systems/profile';
import { audio } from '../systems/audio';
import { ALL_LEVELS } from '../data/levels';
import { COLORS, Counter, TextButton, textStyle } from '../ui/kit';
import {
  canInstall,
  dismissInstall,
  fullscreenSupported,
  installDismissed,
  isFullscreen,
  isInstalled,
  promptInstall,
  toggleFullscreen,
} from '../systems/install';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenu');
  }

  create(): void {
    const w = DESIGN.width;
    const h = DESIGN.height;
    this.add.image(w / 2, h / 2, 'bg.menu').setDisplaySize(w, h);

    this.add
      .text(w / 2, h * 0.15, 'THE LAST GATE', textStyle('huge', COLORS.gold))
      .setOrigin(0.5)
      .setScale(0.98);
    this.add
      .text(w / 2, h * 0.215, 'hold the wall, or lose everything behind it', textStyle('small', COLORS.parchment))
      .setOrigin(0.5)
      .setAlpha(0.85);

    const gold = new Counter(this, 48, 60, 'icon.coin', profile.gold, 'body');
    gold.setDepth(10);

    const cleared = ALL_LEVELS.filter((l) => profile.levelRecord(l.id)).length;
    this.add
      .text(w - 48, 60, `${cleared} / ${ALL_LEVELS.length} held`, textStyle('small', COLORS.muted))
      .setOrigin(1, 0.5);

    const bx = w / 2;
    let by = h * 0.55;
    const gap = 130;

    new TextButton(this, bx, by, 'DEFEND', {
      width: 480,
      height: 120,
      tone: 'green',
      size: 'title',
      onClick: () => this.scene.start('Map'),
    });
    by += gap;

    new TextButton(this, bx, by, 'ARMOURY', {
      width: 480,
      height: 108,
      tone: 'blue',
      onClick: () => this.scene.start('Armory'),
    });
    by += gap;

    if (!profile.hasCrownPack) {
      new TextButton(this, bx, by, 'THE CROWN PACK', {
        width: 480,
        height: 108,
        tone: 'gold',
        onClick: () => this.scene.start('Store'),
      });
      by += gap;
    }

    new TextButton(this, bx, by, 'SETTINGS', {
      width: 480,
      height: 108,
      tone: 'stone',
      onClick: () => this.scene.start('Settings'),
    });

    this.buildInstallRow(w, h);

    this.add
      .text(w / 2, h - 40, 'v0.1.0', textStyle('tiny', COLORS.muted))
      .setOrigin(0.5)
      .setAlpha(0.6);

    audio.unlock();
    audio.startMusic();
    audio.setTension(0.15);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audio.stopMusic());
  }

  /**
   * In a browser tab the game loses its edges to browser chrome and the URL
   * bar shifts everything when it collapses. Installed from Chrome it runs
   * fullscreen with neither problem, so the menu offers it - once.
   */
  private buildInstallRow(w: number, h: number): void {
    const y = h - 150;

    if (canInstall() && !installDismissed()) {
      const row = this.add.container(w / 2, y);
      const plate = this.add.image(0, 0, 'ui.panel.small').setDisplaySize(880, 150);
      const text = this.add
        .text(-330, -6, 'Install for fullscreen play', textStyle('small'))
        .setOrigin(0, 0.5);
      row.add([plate, text]);
      row.add(
        new TextButton(this, 232, 0, 'INSTALL', {
          width: 240,
          height: 92,
          size: 'small',
          tone: 'green',
          onClick: () => {
            void promptInstall().then((accepted) => {
              if (accepted) row.destroy();
            });
          },
        }),
      );
      row.add(
        new TextButton(this, 390, 0, 'X', {
          width: 76,
          height: 92,
          size: 'small',
          tone: 'stone',
          onClick: () => {
            dismissInstall();
            row.destroy();
          },
        }),
      );
      return;
    }

    // Already installed, or the browser will not offer it: fullscreen is the
    // next best thing and needs a tap to be allowed at all.
    if (!isInstalled() && fullscreenSupported() && !isFullscreen()) {
      new TextButton(this, w / 2, y, 'PLAY FULLSCREEN', {
        width: 480,
        height: 92,
        size: 'small',
        tone: 'stone',
        onClick: () => void toggleFullscreen(),
      });
    }
  }
}
