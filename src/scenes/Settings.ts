/** Settings, credits and the progress reset. */
import Phaser from 'phaser';
import { DESIGN } from '../core/layout';
import { profile } from '../systems/profile';
import { audio } from '../systems/audio';
import { COLORS, TextButton, showDialog, textStyle } from '../ui/kit';
import { fullscreenSupported, isFullscreen, isInstalled, toggleFullscreen } from '../systems/install';
import { quality } from '../systems/quality';
import { setTouchDebugVisible } from '../systems/viewport';

export class SettingsScene extends Phaser.Scene {
  private rows: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Settings');
  }

  create(): void {
    const w = DESIGN.width;
    this.add.rectangle(w / 2, DESIGN.height / 2, w, DESIGN.height, 0x1b1626);
    this.add.image(w / 2, DESIGN.height / 2, 'bg.menu').setDisplaySize(w, DESIGN.height).setAlpha(0.2);
    this.add.text(w / 2, 56, 'SETTINGS', textStyle('title', COLORS.gold)).setOrigin(0.5);
    new TextButton(this, w - 70, 56, '<', {
      width: 104,
      height: 76,
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
      [
        'Touch debug',
        s.touchDebug,
        () => {
          profile.updateSettings({ touchDebug: !s.touchDebug });
          setTouchDebugVisible(!s.touchDebug);
        },
      ],
    ];
    // Two columns: a landscape screen has width to spare and no height.
    const colX = [w * 0.27, w * 0.73];
    const rowY = (i: number): number => 220 + Math.floor(i / 2) * 130;
    const labelX = (i: number): number => colX[i % 2]! - 300;
    const btnX = (i: number): number => colX[i % 2]! + 190;

    toggles.forEach(([label, on, toggle], i) => {
      const y = rowY(i);
      this.rows.push(this.add.text(labelX(i), y, label, textStyle('body')).setOrigin(0, 0.5));
      this.rows.push(
        new TextButton(this, btnX(i), y, on ? 'ON' : 'OFF', {
          width: 200,
          height: 84,
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
    this.rows.push(this.add.text(labelX(3), rowY(3), 'Graphics', textStyle('body')).setOrigin(0, 0.5));
    this.rows.push(
      new TextButton(this, btnX(3), rowY(3), quality.describe(), {
        width: 280,
        height: 84,
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
      this.rows.push(this.add.text(labelX(4), rowY(4), 'Fullscreen', textStyle('body')).setOrigin(0, 0.5));
      this.rows.push(
        new TextButton(this, btnX(4), rowY(4), isFullscreen() ? 'ON' : 'OFF', {
          width: 200,
          height: 84,
          tone: isFullscreen() ? 'green' : 'stone',
          onClick: () => {
            void toggleFullscreen().then(() => this.draw());
          },
        }),
      );
    }

    const y0 = 700;
    this.rows.push(
      this.add
        .text(w / 2, y0, `${profile.raw.stats.kills} slain  ·  ${profile.raw.stats.victories} gates held`, textStyle('small', COLORS.muted))
        .setOrigin(0.5),
    );

    this.rows.push(
      new TextButton(this, w / 2, y0 + 90, 'RESET CAMPAIGN', {
        width: 480,
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
          DESIGN.height - 150,
          'THE LAST GATE\nA castle defence against the Demon King.\nArt, code and sound generated in-engine.',
          { ...textStyle('tiny', COLORS.muted), align: 'center' },
        )
        .setOrigin(0.5),
    );

    if (import.meta.env.DEV) {
      this.rows.push(
        new TextButton(this, w / 2, DESIGN.height - 56, profile.hasCrownPack ? 'DEV: DROP PACK' : 'DEV: GRANT PACK', {
          width: 420,
          height: 64,
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
