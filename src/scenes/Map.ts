/** Campaign map: chapters of level nodes on a parchment. */
import Phaser from 'phaser';
import { DESIGN } from '../core/layout';
import { CHAPTERS, levelNumber, levelThreat } from '../data/levels';
import type { LevelDef } from '../data/types';
import { profile } from '../systems/profile';
import { audio } from '../systems/audio';
import { emberCost } from '../battle/economy';
import { COLORS, Counter, TextButton, fitText, showDialog, starRow, tappable, textStyle } from '../ui/kit';

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
    this.add.rectangle(w / 2, 0, w, 96, 0x1b1626, 0.92).setOrigin(0.5, 0);

    new Counter(this, 40, 48, 'icon.coin', profile.gold, 'body');
    new TextButton(this, w - 70, 48, '<', {
      width: 104,
      height: 76,
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
      fitText(
        this.add.text(w / 2, 214, chapter.name.toUpperCase(), textStyle('title', '#43301a')).setOrigin(0.5),
        w - 300,
      ),
    );
    const stars = profile.chapterStars(chapter.id);
    add(
      this.add
        .text(w / 2, 268, `${stars.earned} / ${stars.total} stars`, textStyle('small', '#6d5636'))
        .setOrigin(0.5),
    );

    if (this.chapterIndex > 0) {
      add(
        new TextButton(this, 110, 950, '<', {
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
        new TextButton(this, w - 110, 950, '>', {
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
      add(this.add.text(w / 2, 430, 'Sealed', textStyle('title', '#7a2c2c')).setOrigin(0.5));
      add(
        this.add
          .text(
            w / 2,
            520,
            'The Demon King withdrew to his throne.\nThe Crown Pack opens the way down.',
            { ...textStyle('small', '#6d5636'), align: 'center' },
          )
          .setOrigin(0.5),
      );
      add(
        new TextButton(this, w / 2, 700, 'SEE THE CROWN PACK', {
          width: 620,
          tone: 'gold',
          onClick: () => this.scene.start('Store'),
        }),
      );
      return;
    }

    // A winding path from left to right - the direction the campaign advances.
    const count = chapter.levels.length;
    const first = 170;
    const span = w - first * 2;
    const midY = 560;
    chapter.levels.forEach((lvl, i) => {
      const x = first + (count > 1 ? (span * i) / (count - 1) : span / 2);
      const y = midY + (i % 2 === 0 ? -110 : 110);
      const side = i % 2 === 0 ? -1 : 1;
      const unlocked = profile.isLevelUnlocked(lvl.id);
      const record = profile.levelRecord(lvl.id);

      const node = this.add.container(x, y);
      const disc = this.add.circle(0, 0, 46, unlocked ? 0x4a3a24 : 0x5d564a).setStrokeStyle(6, 0x2b2113);
      node.add(disc);
      node.add(
        this.add
          .text(0, 0, unlocked ? String(lvl.index) : '', textStyle('title', unlocked ? COLORS.gold : COLORS.muted))
          .setOrigin(0.5),
      );
      if (!unlocked) {
        node.add(this.add.image(0, 0, 'icon.skull').setDisplaySize(46, 46).setAlpha(0.7));
      }
      if (record) node.add(starRow(this, 0, 66, record.stars, 30));
      // Wrapped rather than shrunk, so every level name is the same size.
      node.add(
        this.add
          .text(0, side < 0 ? -102 : 108, lvl.name, {
            ...textStyle('small', '#3a2a18'),
            align: 'center',
            wordWrap: { width: 230 },
          })
          .setOrigin(0.5),
      );

      tappable(node, 160, 190);
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

  /**
   * A fort is chosen, then packed for. The loadout screen streams the art in
   * while the player picks their hand, so nothing waits on a loading line.
   */
  private startBattle(lvl: LevelDef): void {
    this.scene.start('Loadout', { levelId: lvl.id });
  }

  private openLevel(lvl: LevelDef): void {
    const record = profile.levelRecord(lvl.id);
    const threat = Math.round(levelThreat(lvl));
    showDialog(this, {
      title: lvl.name,
      body: `${lvl.brief}\n\n${lvl.waves} waves  ·  threat ${threat}\nStarting Ember ${emberCost(lvl.startingGold)}${
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
