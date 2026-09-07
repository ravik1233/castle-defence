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

    // Title on the left, the way in on the right: a landscape screen wants
    // two columns, not one tall stack.
    const left = w * 0.32;
    this.add
      .text(left, h * 0.34, 'THE LAST GATE', textStyle('huge', COLORS.gold))
      .setOrigin(0.5)
      .setScale(0.92);
    this.add
      .text(left, h * 0.45, 'hold the wall, or lose everything behind it', textStyle('small', COLORS.parchment))
      .setOrigin(0.5)
      .setAlpha(0.85);

    const gold = new Counter(this, 40, 48, 'icon.coin', profile.gold, 'body');
    gold.setDepth(10);

    const cleared = ALL_LEVELS.filter((l) => profile.levelRecord(l.id)).length;
    this.add
      .text(w - 40, 48, `${cleared} / ${ALL_LEVELS.length} held`, textStyle('small', COLORS.muted))
      .setOrigin(1, 0.5);

    const bx = w * 0.74;
    const buttons: Array<[string, 'green' | 'blue' | 'gold' | 'stone', () => void]> = [
      ['DEFEND', 'green', () => this.scene.start('Map')],
      ['ARMOURY', 'blue', () => this.scene.start('Armory')],
      ['WAR LEDGER', 'stone', () => this.scene.start('Ledger')],
    ];
    if (!profile.hasCrownPack) buttons.push(['THE CROWN PACK', 'gold', () => this.scene.start('Store')]);
    buttons.push(['SETTINGS', 'stone', () => this.scene.start('Settings')]);

    const gap = 116;
    const startY = h / 2 - ((buttons.length - 1) * gap) / 2;
    buttons.forEach(([label, tone, go], i) => {
      new TextButton(this, bx, startY + i * gap, label, {
        width: 460,
        height: i === 0 ? 108 : 96,
        tone,
        size: i === 0 ? 'title' : 'body',
        onClick: go,
      });
    });

    this.buildInstallRow(w, h);

    this.add
      .text(w - 40, h - 28, 'v0.1.0', textStyle('tiny', COLORS.muted))
      .setOrigin(1, 0.5)
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
    const y = h - 92;

    if (canInstall() && !installDismissed()) {
      const row = this.add.container(w * 0.32, y);
      const plate = this.add.image(0, 0, 'ui.panel.small').setDisplaySize(880, 118);
      const text = this.add
        .text(-330, -4, 'Install for fullscreen play', textStyle('small'))
        .setOrigin(0, 0.5);
      row.add([plate, text]);
      row.add(
        new TextButton(this, 232, 0, 'INSTALL', {
          width: 240,
          height: 84,
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
          height: 84,
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
      new TextButton(this, w * 0.32, y, 'PLAY FULLSCREEN', {
        width: 460,
        height: 84,
        size: 'small',
        tone: 'stone',
        onClick: () => void toggleFullscreen(),
      });
    }
  }
}
