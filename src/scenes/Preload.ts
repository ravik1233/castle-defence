/**
 * Boot scene: rasterises what the first screen needs, showing a progress bar
 * drawn with primitives (no textures exist yet).
 *
 * The cast is deliberately not part of that. Its drawn poses are the heaviest
 * thing the game owns and no menu draws one, so they stream in afterwards -
 * see `streamCast` below.
 */
import Phaser from 'phaser';
import { BACKDROP_SCALE, addTexture, buildTextures, drawnUnitIds, ensureBiome, ensureUnitArt } from '../art/registry';
import { mapBackdrop, menuBackdrop } from '../art/scenery';
import { DESIGN, FIELD, GRID } from '../core/layout';
import { level } from '../data/levels';
import { profile } from '../systems/profile';
import { ensureBattleTextures, ensureCastleSkin } from '../systems/textures';
import { FONT } from '../ui/kit';
import { audio } from '../systems/audio';
import { reachRegionForTesting, unlockEverythingForTesting } from '../systems/devtools';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  create(): void {
    const { width, height } = this.scale.gameSize;
    this.cameras.main.setBackgroundColor('#140f1e');

    const title = this.add
      .text(width / 2, height * 0.38, 'THE LAST GATE', {
        fontFamily: FONT,
        fontSize: '84px',
        color: '#f5c542',
        fontStyle: '700',
        stroke: '#140f1e',
        strokeThickness: 10,
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height * 0.44, 'if the castle falls, so does everything', {
        fontFamily: FONT,
        fontSize: '30px',
        color: '#a99cc4',
      })
      .setOrigin(0.5);

    const barW = width * 0.62;
    const barX = (width - barW) / 2;
    const barY = height * 0.56;
    const back = this.add.rectangle(width / 2, barY, barW, 26, 0x2a2338).setStrokeStyle(4, 0x554a72);
    const fill = this.add.rectangle(barX + 3, barY, 0, 18, 0xf5c542).setOrigin(0, 0.5);
    const pct = this.add
      .text(width / 2, barY + 46, 'forging the realm...', {
        fontFamily: FONT,
        fontSize: '26px',
        color: '#c8b28a',
      })
      .setOrigin(0.5);

    this.tweens.add({ targets: title, scaleX: 1.03, scaleY: 1.03, duration: 1600, yoyo: true, repeat: -1 });

    void this.buildAll((done, total) => {
      const f = done / total;
      fill.width = (barW - 6) * f;
      pct.setText(`forging the realm... ${Math.round(f * 100)}%`);
      back.setAlpha(1);
    });
  }

  private async buildAll(onProgress: (done: number, total: number) => void): Promise<void> {
    await buildTextures(this, [], { onProgress });

    // Only what the first screen needs; biomes and skins stream in later.
    await addTexture(this, 'bg.menu', menuBackdrop(DESIGN.width, DESIGN.height), BACKDROP_SCALE);
    await addTexture(this, 'bg.map', mapBackdrop(DESIGN.width, DESIGN.height), BACKDROP_SCALE);
    await ensureCastleSkin(this, profile.activeSkin);
    await ensureBiome(this, 'fields', DESIGN.width, FIELD.height + FIELD.horizon, GRID.rows, FIELD.horizon);

    audio.unlock();

    // Deep link for testing: ?scene=Battle&level=c2l4&unlock=1
    const params = new URLSearchParams(globalThis.location?.search ?? '');
    if (params.get('unlock') === '1' && (import.meta.env.DEV || __QA_BUILD__)) {
      unlockEverythingForTesting();
    }
    // ?reach=3 stops the campaign at that region, which is how the region
    // commanders and musters get tested one at a time.
    const reach = Number(params.get('reach'));
    if (reach >= 1 && (import.meta.env.DEV || __QA_BUILD__)) reachRegionForTesting(reach);
    const target = params.get('scene');
    if (target) {
      const levelId = params.get('level') ?? 'c1l1';
      if (target === 'Battle') {
        await ensureBattleTextures(this, level(levelId).biome, profile.activeSkin, levelId);
      }
      this.scene.start(target, { levelId, skipBriefing: params.get('nomodal') === '1' });
      this.streamCast();
      return;
    }
    this.scene.start('MainMenu');
    this.streamCast();
  }

  /**
   * Fetches the drawn poses for the whole cast behind the menu.
   *
   * The sheets are by far the heaviest thing the game owns and nothing before
   * the first fort draws one, so waiting on them was the boot. Started here
   * instead, they arrive while the player is reading a menu, and whatever has
   * not landed by the time a fort begins is waited for there - and only the
   * handful that fort actually fields.
   */
  private streamCast(): void {
    void ensureUnitArt(this, drawnUnitIds()).catch(() => {
      // Nothing to do: each fort awaits its own cast before it starts.
    });
  }
}
