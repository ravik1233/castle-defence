/** Campaign map: chapters of level nodes on a parchment. */
import Phaser from 'phaser';
import { DESIGN } from '../core/layout';
import { CHAPTERS, levelNumber, levelThreat } from '../data/levels';
import type { LevelDef } from '../data/types';
import { profile } from '../systems/profile';
import { ensureBattleTextures } from '../systems/textures';
import { audio } from '../systems/audio';
import { COLORS, Counter, TextButton, showDialog, textStyle } from '../ui/kit';

export class MapScene extends Phaser.Scene {
  private chapterIndex = 0;
  private nodes: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Map');
  }

  create(): void {
    const w = DESIGN.width;
    const h = DESIGN.height;
    this.add.image(w / 2, h / 2, 'bg.map').setDisplaySize(w, h);
    this.add.rectangle(w / 2, 0, w, 150, 0x1b1626, 0.92).setOrigin(0.5, 0);

    new Counter(this, 44, 74, 'icon.coin', profile.gold, 'body');
    new TextButton(this, w - 92, 74, '<', {
      width: 120,
      height: 92,
      tone: 'stone',
      onClick: () => this.scene.start('MainMenu'),
    });

    // Start on the chapter that holds the player's next fight.
    const progress = profile.campaignProgress;
    this.chapterIndex = Math.max(
      0,
      CHAPTERS.findIndex((c) => c.levels.some((l) => levelNumber(l.id) >= progress)),
    );

    this.drawChapter();
  }

  private drawChapter(): void {
    for (const n of this.nodes) n.destroy();
    this.nodes = [];
    const chapter = CHAPTERS[this.chapterIndex]!;
    const w = DESIGN.width;
    const locked = Boolean(chapter.premium) && !profile.hasCrownPack;

    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.nodes.push(o);
      return o;
    };

    add(
      this.add
        .text(w / 2, 210, chapter.name.toUpperCase(), textStyle('title', '#43301a'))
        .setOrigin(0.5),
    );
    const stars = profile.chapterStars(chapter.id);
    add(
      this.add
        .text(w / 2, 268, `${stars.earned} / ${stars.total} stars`, textStyle('small', '#6d5636'))
        .setOrigin(0.5),
    );

    if (this.chapterIndex > 0) {
      add(
        new TextButton(this, 110, 240, '<', {
          width: 110,
          height: 96,
          tone: 'stone',
          onClick: () => {
            this.chapterIndex -= 1;
            this.drawChapter();
          },
        }),
      );
    }
    if (this.chapterIndex < CHAPTERS.length - 1) {
      add(
        new TextButton(this, w - 110, 240, '>', {
          width: 110,
          height: 96,
          tone: 'stone',
          onClick: () => {
            this.chapterIndex += 1;
            this.drawChapter();
          },
        }),
      );
    }

    if (locked) {
      add(
        this.add
          .text(w / 2, 640, 'Sealed', textStyle('title', '#7a2c2c'))
          .setOrigin(0.5),
      );
      add(
        this.add
          .text(
            w / 2,
            720,
            'The Demon King withdrew to his throne.\nThe Crown Pack opens the way down.',
            { ...textStyle('small', '#6d5636'), align: 'center' },
          )
          .setOrigin(0.5),
      );
      add(
        new TextButton(this, w / 2, 900, 'SEE THE CROWN PACK', {
          width: 620,
          tone: 'gold',
          onClick: () => this.scene.start('Store'),
        }),
      );
      return;
    }

    // Nodes laid out on a winding path.
    const top = 360;
    const rowH = 132;
    chapter.levels.forEach((lvl, i) => {
      const side = i % 2 === 0 ? -1 : 1;
      const x = w / 2 + side * (110 + (i % 3) * 40);
      const y = top + i * rowH;
      const unlocked = profile.isLevelUnlocked(lvl.id);
      const record = profile.levelRecord(lvl.id);

      const node = this.add.container(x, y);
      const disc = this.add.circle(0, 0, 52, unlocked ? 0x4a3a24 : 0x5d564a).setStrokeStyle(6, 0x2b2113);
      node.add(disc);
      node.add(
        this.add
          .text(0, 0, unlocked ? String(lvl.index) : '', textStyle('title', unlocked ? COLORS.gold : COLORS.muted))
          .setOrigin(0.5),
      );
      if (!unlocked) {
        node.add(this.add.image(0, 0, 'icon.skull').setDisplaySize(46, 46).setAlpha(0.7));
      }
      if (record) {
        for (let s = 0; s < 3; s += 1) {
          const star = this.add
            .text(-36 + s * 36, 62, '*', textStyle('body', s < record.stars ? COLORS.gold : '#7a6a52'))
            .setOrigin(0.5);
          node.add(star);
        }
      }
      node.add(
        this.add
          .text(side < 0 ? 78 : -78, -4, lvl.name, textStyle('small', '#3a2a18'))
          .setOrigin(side < 0 ? 0 : 1, 0.5),
      );

      node.setSize(300, 110);
      node.setInteractive(new Phaser.Geom.Rectangle(-150, -55, 300, 110), Phaser.Geom.Rectangle.Contains);
      node.on('pointerdown', () => {
        audio.play('tap');
        if (!unlocked) {
          showDialog(this, {
            title: 'Not yet',
            body: 'Hold the previous gate first.',
            buttons: [{ text: 'BACK', tone: 'stone' }],
            height: 380,
          });
          return;
        }
        this.openLevel(lvl);
      });
      add(node);
    });
  }

  /** Streams in the biome and castle art this level needs, then fights. */
  private async startBattle(lvl: LevelDef): Promise<void> {
    const wait = this.add
      .text(DESIGN.width / 2, DESIGN.height - 120, 'mustering...', textStyle('small', '#43301a'))
      .setOrigin(0.5)
      .setDepth(9500);
    await ensureBattleTextures(this, lvl.biome, profile.activeSkin);
    wait.destroy();
    this.scene.start('Battle', { levelId: lvl.id });
  }

  private openLevel(lvl: LevelDef): void {
    const record = profile.levelRecord(lvl.id);
    const threat = Math.round(levelThreat(lvl));
    showDialog(this, {
      title: lvl.name,
      body: `${lvl.brief}\n\n${lvl.waves} waves  ·  threat ${threat}\nStarting gold ${lvl.startingGold}${
        record ? `\nBest: ${record.stars} stars` : ''
      }`,
      height: 620,
      buttons: [
        { text: 'BACK', tone: 'stone' },
        {
          text: 'FIGHT',
          tone: 'green',
          onClick: () => {
            void this.startBattle(lvl);
          },
        },
      ],
    });
  }
}
