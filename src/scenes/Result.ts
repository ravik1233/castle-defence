/**
 * Post-battle summary: stars, gold, the optional rewarded video, and the
 * single interstitial slot the game allows itself.
 */
import Phaser from 'phaser';
import { DESIGN } from '../core/layout';
import { ALL_LEVELS, level as levelById } from '../data/levels';
import { defender } from '../data/defenders';
import { profile } from '../systems/profile';
import { ensureBattleTextures } from '../systems/textures';
import { ads } from '../systems/ads';
import { audio } from '../systems/audio';
import { COLORS, TextButton, floatText, showDialog, starRow, textStyle } from '../ui/kit';

interface ResultData {
  levelId: string;
  victory: boolean;
  stars: number;
  wave: number;
  kills: number;
  wallHp: number;
  wallMax: number;
  reward: number;
  levelNo: number;
  unlockedBefore: number;
}

export class ResultScene extends Phaser.Scene {
  private result!: ResultData;
  private payout = 0;
  private doubled = false;

  constructor() {
    super('Result');
  }

  init(data: ResultData): void {
    this.result = data;
    this.doubled = false;
    this.payout = 0;
  }

  create(): void {
    const w = DESIGN.width;
    const h = DESIGN.height;
    const { victory } = this.result;

    this.add.image(w / 2, h / 2, 'bg.menu').setDisplaySize(w, h);
    this.add.rectangle(w / 2, h / 2, w, h, victory ? 0x14261e : 0x2a1018, 0.72);

    this.add
      .text(w / 2, 130, victory ? 'THE GATE HELD' : 'THE GATE FELL', textStyle('huge', victory ? COLORS.gold : COLORS.danger))
      .setOrigin(0.5);

    const lvl = levelById(this.result.levelId);
    this.add.text(w / 2, 208, lvl.name, textStyle('body', COLORS.parchment)).setOrigin(0.5);

    if (victory) {
      const stars = starRow(this, w / 2, 320, this.result.stars, 110);
      stars.each((s: Phaser.GameObjects.GameObject, i: number) => {
        const img = s as Phaser.GameObjects.Image;
        img.setScale(0);
        this.tweens.add({
          targets: img,
          scaleX: 110 / img.width,
          scaleY: 110 / img.height,
          duration: 320,
          delay: 220 + i * 240,
          ease: 'Back.easeOut',
        });
      });
      this.payout = profile.recordVictory(lvl.id, this.result.stars, this.result.wave, lvl.reward);
    } else {
      profile.recordDefeat(lvl.id, this.result.wave);
      this.add
        .text(w / 2, 320, `You held to wave ${this.result.wave} of ${lvl.waves}.`, textStyle('body', COLORS.parchment))
        .setOrigin(0.5);
    }

    const stats = [
      `${this.result.kills} slain`,
      victory ? `gate at ${Math.round((this.result.wallHp / this.result.wallMax) * 100)}%` : 'gate destroyed',
      victory ? `+${this.payout} gold` : 'no reward',
    ];
    // The three stats read as a row across, not a stack down.
    stats.forEach((line, i) => {
      this.add
        .text(w / 2 + (i - 1) * 380, 430, line, textStyle('small', COLORS.muted))
        .setOrigin(0.5);
    });

    // New cards unlocked by this victory.
    if (victory) {
      const unlocks = profile.cardsUnlockedAt(profile.campaignProgress);
      if (unlocks.length) {
        this.time.delayedCall(700, () => this.showUnlocks(unlocks));
      }
    }

    let by = 560;
    if (victory && profile.showAds && !this.doubled) {
      new TextButton(this, w / 2, by, `WATCH AD FOR +${this.payout} GOLD`, {
        width: 620,
        height: 96,
        size: 'small',
        tone: 'gold',
        onClick: () => void this.watchForGold(),
      });
      by += 118;
    }

    const next = this.nextLevelId();
    if (victory && next) {
      new TextButton(this, w / 2, by, 'NEXT BATTLE', {
        width: 520,
        height: 104,
        tone: 'green',
        size: 'title',
        onClick: () => void this.goToBattle(next),
      });
      by += 124;
    } else {
      new TextButton(this, w / 2, by, victory ? 'RETURN' : 'TRY AGAIN', {
        width: 520,
        height: 104,
        tone: victory ? 'green' : 'red',
        size: 'title',
        onClick: () =>
          victory ? void this.leave(() => this.scene.start('Map')) : void this.goToBattle(lvl.id),
      });
      by += 124;
    }

    new TextButton(this, w / 2, by, 'THE MAP', {
      width: 380,
      height: 84,
      size: 'small',
      tone: 'stone',
      onClick: () => void this.leave(() => this.scene.start('Map')),
    });

    audio.setTension(0);
    ads.noteBattleFinished();
  }

  private showUnlocks(ids: string[]): void {
    const names = ids.map((id) => defender(id).name).join(', ');
    showDialog(this, {
      title: 'New defenders',
      body: `${names} joined the muster.\nAdd them in the Armoury.`,
      height: 460,
      buttons: [{ text: 'GOOD', tone: 'green' }],
    });
  }

  private async watchForGold(): Promise<void> {
    if (this.doubled) return;
    const watched = await ads.rewarded();
    if (!watched) return;
    this.doubled = true;
    profile.addGold(this.payout);
    audio.play('coin');
    floatText(this, DESIGN.width / 2, 700, `+${this.payout} gold`, COLORS.gold, 'title');
    this.scene.restart({ ...this.result, victory: false, stars: 0, reward: 0 });
  }

  /** The one place an interstitial may appear. */
  private async leave(go: () => void): Promise<void> {
    await ads.maybeInterstitial(this.result.victory ? 'level_complete' : 'level_failed');
    go();
  }

  private async goToBattle(levelId: string): Promise<void> {
    await ensureBattleTextures(this, levelById(levelId).biome, profile.activeSkin);
    await this.leave(() => this.scene.start('Battle', { levelId }));
  }

  private nextLevelId(): string | undefined {
    const idx = ALL_LEVELS.findIndex((l) => l.id === this.result.levelId);
    const next = ALL_LEVELS[idx + 1];
    if (!next) return undefined;
    if (next.premium && !profile.hasCrownPack) return undefined;
    return next.id;
  }
}
