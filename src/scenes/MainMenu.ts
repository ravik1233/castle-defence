/** Title screen. */
import Phaser from 'phaser';
import { DESIGN } from '../core/layout';
import { profile } from '../systems/profile';
import { audio } from '../systems/audio';
import { ALL_LEVELS } from '../data/levels';
import { COLORS, Counter, TextButton, textStyle } from '../ui/kit';

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

    this.add
      .text(w / 2, h - 40, 'v0.1.0', textStyle('tiny', COLORS.muted))
      .setOrigin(0.5)
      .setAlpha(0.6);

    audio.unlock();
    audio.startMusic();
    audio.setTension(0.15);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => audio.stopMusic());
  }
}
