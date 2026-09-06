/** Settings, credits and the progress reset. */
import Phaser from 'phaser';
import { DESIGN } from '../core/layout';
import { profile } from '../systems/profile';
import { audio } from '../systems/audio';
import { COLORS, TextButton, showDialog, textStyle } from '../ui/kit';
import { fullscreenSupported, isFullscreen, isInstalled, toggleFullscreen } from '../systems/install';
import { quality } from '../systems/quality';

export class SettingsScene extends Phaser.Scene {
  private rows: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Settings');
  }

  create(): void {
    const w = DESIGN.width;
    this.add.rectangle(w / 2, DESIGN.height / 2, w, DESIGN.height, 0x1b1626);
    this.add.image(w / 2, DESIGN.height / 2, 'bg.menu').setDisplaySize(w, DESIGN.height).setAlpha(0.2);
    this.add.text(w / 2, 90, 'SETTINGS', textStyle('title', COLORS.gold)).setOrigin(0.5);
    new TextButton(this, w - 92, 90, '<', {
      width: 120,
      height: 92,
      tone: 'stone',
      onClick: () => this.scene.start('MainMenu'),
    });
    this.draw();
  }

  private draw(): void {
    for (const r of this.rows) r.destroy();
    this.rows = [];
    const w = DESIGN.width;
    const s = profile.settings;
    const toggles: Array<[string, boolean, () => void]> = [
      ['Sound effects', s.sfx, () => profile.updateSettings({ sfx: !s.sfx })],
      ['Music', s.music, () => profile.updateSettings({ music: !s.music })],
      ['Haptics', s.haptics, () => profile.updateSettings({ haptics: !s.haptics })],
    ];
    toggles.forEach(([label, on, toggle], i) => {
      const y = 280 + i * 150;
      this.rows.push(this.add.text(120, y, label, textStyle('body')).setOrigin(0, 0.5));
      this.rows.push(
        new TextButton(this, w - 220, y, on ? 'ON' : 'OFF', {
          width: 220,
          height: 92,
          tone: on ? 'green' : 'stone',
          onClick: () => {
            toggle();
            audio.applySettings();
            this.draw();
          },
        }),
      );
    });

    const cycle: Array<'auto' | 'high' | 'low'> = ['auto', 'high', 'low'];
    this.rows.push(this.add.text(120, 730, 'Graphics', textStyle('body')).setOrigin(0, 0.5));
    this.rows.push(
      new TextButton(this, w - 220, 730, quality.describe(), {
        width: 300,
        height: 92,
        size: 'small',
        tone: 'blue',
        onClick: () => {
          const next = cycle[(cycle.indexOf(profile.settings.quality ?? 'auto') + 1) % cycle.length]!;
          profile.updateSettings({ quality: next });
          quality.reset();
          this.draw();
        },
      }),
    );

    if (!isInstalled() && fullscreenSupported()) {
      this.rows.push(this.add.text(120, 880, 'Fullscreen', textStyle('body')).setOrigin(0, 0.5));
      this.rows.push(
        new TextButton(this, w - 220, 880, isFullscreen() ? 'ON' : 'OFF', {
          width: 220,
          height: 92,
          tone: isFullscreen() ? 'green' : 'stone',
          onClick: () => {
            void toggleFullscreen().then(() => this.draw());
          },
        }),
      );
    }

    const y0 = 1010;
    this.rows.push(
      this.add
        .text(w / 2, y0, `${profile.raw.stats.kills} slain  ·  ${profile.raw.stats.victories} gates held`, textStyle('small', COLORS.muted))
        .setOrigin(0.5),
    );

    this.rows.push(
      new TextButton(this, w / 2, y0 + 120, 'RESET CAMPAIGN', {
        width: 520,
        tone: 'red',
        onClick: () =>
          showDialog(this, {
            title: 'Reset campaign?',
            body: 'Levels, gold and upgrades are wiped. Purchases are kept.',
            height: 460,
            buttons: [
              { text: 'CANCEL', tone: 'stone' },
              {
                text: 'RESET',
                tone: 'red',
                onClick: () => {
                  profile.resetProgress();
                  this.scene.start('MainMenu');
                },
              },
            ],
          }),
      }),
    );

    this.rows.push(
      this.add
        .text(
          w / 2,
          DESIGN.height - 220,
          'THE LAST GATE\nA castle defence against the Demon King.\nArt, code and sound generated in-engine.',
          { ...textStyle('tiny', COLORS.muted), align: 'center' },
        )
        .setOrigin(0.5),
    );

    if (import.meta.env.DEV) {
      this.rows.push(
        new TextButton(this, w / 2, DESIGN.height - 110, profile.hasCrownPack ? 'DEV: DROP PACK' : 'DEV: GRANT PACK', {
          width: 460,
          height: 84,
          size: 'small',
          tone: 'blue',
          onClick: () => {
            if (profile.hasCrownPack) profile.revokeCrownPack();
            else profile.grantCrownPack();
            this.draw();
          },
        }),
      );
    }
  }
}
