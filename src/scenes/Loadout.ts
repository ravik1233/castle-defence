/**
 * What you take to the fort, chosen before anything is on the field.
 *
 * A defence is mostly decided before the first enemy appears: which six
 * cards are in hand, which three pieces of equipment are fitted to the wall,
 * and what one-use stock is in the pack. Putting all three on one screen, in
 * front of the fort they are for, makes that a decision rather than a
 * setting buried in a menu.
 */
import Phaser from 'phaser';
import { DESIGN } from '../core/layout';
import { DEFENDERS, defender } from '../data/defenders';
import { CONSUMABLES, EQUIPMENT, EQUIPMENT_SLOTS } from '../data/workshop';
import { level as levelById } from '../data/levels';
import type { LevelDef } from '../data/types';
import { portraitFor } from '../art/portraits';
import { profile } from '../systems/profile';
import { ensureBattleTextures } from '../systems/textures';
import { audio } from '../systems/audio';
import { COLORS, Counter, TextButton, fitText, showDialog, tappable, textStyle } from '../ui/kit';

const DECK_MAX = 6;

export class LoadoutScene extends Phaser.Scene {
  private lvl!: LevelDef;
  private deck: string[] = [];
  private body: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Loadout');
  }

  init(data: { levelId: string }): void {
    this.lvl = levelById(data.levelId ?? 'c1l1');
    this.deck = profile.effectiveDeck();
  }

  create(): void {
    const w = DESIGN.width;
    this.add.rectangle(w / 2, DESIGN.height / 2, w, DESIGN.height, 0x1b1626);
    this.add.image(w / 2, DESIGN.height / 2, 'bg.menu').setDisplaySize(w, DESIGN.height).setAlpha(0.2);

    this.add.text(w / 2, 46, this.lvl.name.toUpperCase(), textStyle('title', COLORS.gold)).setOrigin(0.5);
    const brief = this.add
      .text(w / 2, 100, this.lvl.brief, { ...textStyle('small', COLORS.muted), wordWrap: { width: 1400 }, align: 'center' })
      .setOrigin(0.5, 0);
    fitText(brief, 1400);

    new Counter(this, 40, 46, 'icon.coin', profile.gold, 'small');
    new Counter(this, 250, 46, 'icon.hammer', profile.salvage, 'small');

    new TextButton(this, w - 70, 46, '<', {
      width: 104,
      height: 72,
      tone: 'stone',
      onClick: () => this.scene.start('Map', { chapter: this.lvl.chapter }),
    });

    new TextButton(this, w / 2, DESIGN.height - 62, 'MARCH OUT', {
      width: 520,
      height: 96,
      tone: 'green',
      onClick: () => void this.march(),
    });

    this.draw();
  }

  private clearBody(): void {
    for (const o of this.body) o.destroy();
    this.body = [];
  }

  private track<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.body.push(o);
    return o;
  }

  private draw(): void {
    this.clearBody();
    this.drawDeck();
    this.drawEquipment();
    this.drawStock();
  }

  /* ----------------------------------------------------------------- deck */

  private drawDeck(): void {
    this.track(
      this.add.text(60, 200, `IN HAND  ${this.deck.length} / ${DECK_MAX}`, textStyle('body', COLORS.gold)).setOrigin(0, 0.5),
    );
    this.track(
      this.add
        .text(60, 244, 'Tap a card to drop it. Tap one below to take it.', textStyle('tiny', COLORS.muted))
        .setOrigin(0, 0.5),
    );

    this.deck.forEach((id, i) => {
      const def = defender(id);
      const c = this.track(this.add.container(150 + i * 170, 350));
      c.add(this.add.image(0, 0, 'ui.card').setDisplaySize(150, 168).setTint(0x9ff0b4));
      const portrait = portraitFor(this, def);
      if (portrait) {
        const img = this.add.image(0, -22, portrait.key);
        img.setScale(Math.min(78 / img.width, 78 / img.height));
        c.add(img);
      }
      c.add(fitText(this.add.text(0, 42, def.name, textStyle('tiny', COLORS.parchment)).setOrigin(0.5), 130));
      c.add(this.add.text(0, 68, `${def.cost}g`, textStyle('tiny', COLORS.gold)).setOrigin(0.5));
      tappable(c, 150, 168);
      c.on('pointerdown', () => {
        if (this.deck.length <= 2) {
          audio.play('deny');
          return;
        }
        audio.play('tap');
        this.deck = this.deck.filter((d) => d !== id);
        profile.setDeck(this.deck);
        this.draw();
      });
    });

    // Everything unlocked and not already in hand.
    const bench = DEFENDERS.filter((d) => profile.isCardUnlocked(d.id) && !this.deck.includes(d.id));
    this.track(this.add.text(60, 480, 'MUSTERED', textStyle('small', COLORS.muted)).setOrigin(0, 0.5));
    bench.slice(0, 16).forEach((def, i) => {
      const c = this.track(this.add.container(150 + (i % 8) * 170, 590 + Math.floor(i / 8) * 190));
      const full = this.deck.length >= DECK_MAX;
      c.add(this.add.image(0, 0, 'ui.card').setDisplaySize(150, 168).setTint(full ? 0x6a6478 : 0xffffff));
      const portrait = portraitFor(this, def);
      if (portrait) {
        const img = this.add.image(0, -22, portrait.key);
        img.setScale(Math.min(78 / img.width, 78 / img.height));
        img.setAlpha(full ? 0.5 : 1);
        c.add(img);
      }
      c.add(fitText(this.add.text(0, 42, def.name, textStyle('tiny', COLORS.parchment)).setOrigin(0.5), 130));
      c.add(this.add.text(0, 68, `${def.cost}g`, textStyle('tiny', COLORS.gold)).setOrigin(0.5));
      tappable(c, 150, 168);
      c.on('pointerdown', () => {
        if (this.deck.length >= DECK_MAX) {
          audio.play('deny');
          return;
        }
        audio.play('tap');
        this.deck = [...this.deck, def.id];
        profile.setDeck(this.deck);
        this.draw();
      });
    });
  }

  /* ------------------------------------------------------------ equipment */

  private drawEquipment(): void {
    const x = 1480;
    const fitted = profile.equipped;
    this.track(
      this.add
        .text(x, 200, `FITTED TO THE WALL  ${fitted.length} / ${EQUIPMENT_SLOTS}`, textStyle('body', COLORS.gold))
        .setOrigin(0.5),
    );

    const owned = EQUIPMENT.filter((e) => profile.ownsEquipment(e.id));
    if (!owned.length) {
      this.track(
        this.add
          .text(x, 300, 'Nothing yet. The workshop turns salvage into walls.', {
            ...textStyle('small', COLORS.muted),
            wordWrap: { width: 700 },
            align: 'center',
          })
          .setOrigin(0.5),
      );
    }

    owned.forEach((def, i) => {
      const y = 280 + i * 96;
      const on = fitted.includes(def.id);
      const row = this.track(this.add.container(x, y));
      row.add(this.add.rectangle(0, 0, 720, 84, on ? 0x33405e : 0x2a2338, 0.92).setStrokeStyle(3, on ? 0xf5c542 : 0x4a4060));
      if (this.textures.exists(def.icon)) row.add(this.add.image(-320, 0, def.icon).setDisplaySize(52, 52));
      row.add(fitText(this.add.text(-280, -14, def.name, textStyle('small', COLORS.parchment)).setOrigin(0, 0.5), 560));
      row.add(fitText(this.add.text(-280, 18, def.blurb, textStyle('tiny', COLORS.muted)).setOrigin(0, 0.5), 560));
      row.add(this.add.text(310, 0, on ? 'ON' : 'OFF', textStyle('tiny', on ? COLORS.gold : COLORS.muted)).setOrigin(0.5));
      tappable(row, 720, 84);
      row.on('pointerdown', () => {
        if (!profile.toggleEquipped(def.id)) {
          audio.play('deny');
          showDialog(this, {
            title: 'No room on the wall',
            body: `A fort carries ${EQUIPMENT_SLOTS} pieces. Take one off first.`,
            height: 360,
            buttons: [{ text: 'OK', tone: 'stone' }],
          });
          return;
        }
        audio.play('tap');
        this.draw();
      });
    });

    this.track(
      new TextButton(this, x, 830, 'THE WORKSHOP', {
        width: 420,
        height: 84,
        size: 'small',
        tone: 'blue',
        onClick: () => this.scene.start('Workshop'),
      }),
    );
  }

  /* ---------------------------------------------------------------- stock */

  private drawStock(): void {
    const x = 1480;
    const carried = CONSUMABLES.filter((c) => profile.stockOf(c.id) > 0);
    const line = carried.length
      ? carried.map((c) => `${c.name} x${profile.stockOf(c.id)}`).join('    ')
      : 'No stock in the pack.';
    this.track(this.add.text(x, 930, 'IN THE PACK', textStyle('small', COLORS.gold)).setOrigin(0.5));
    this.track(fitText(this.add.text(x, 972, line, textStyle('tiny', COLORS.muted)).setOrigin(0.5), 720));
  }

  /* --------------------------------------------------------------- march */

  private async march(): Promise<void> {
    profile.setDeck(this.deck);
    const wait = this.add
      .text(DESIGN.width / 2, DESIGN.height - 140, 'mustering...', textStyle('small', COLORS.muted))
      .setOrigin(0.5)
      .setDepth(9500);
    await ensureBattleTextures(this, this.lvl.biome, profile.activeSkin);
    wait.destroy();
    this.scene.start('Battle', { levelId: this.lvl.id });
  }
}
