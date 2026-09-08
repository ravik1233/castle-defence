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
import { CHAPTERS, level as levelById } from '../data/levels';
import { DOCTRINES } from '../data/doctrines';
import type { LevelDef } from '../data/types';
import { portraitFor } from '../art/portraits';
import { profile } from '../systems/profile';
import { ensureBattleTextures } from '../systems/textures';
import { audio } from '../systems/audio';
import { COLORS, Counter, TextButton, fitText, showDialog, tappable, textStyle } from '../ui/kit';

const DECK_MAX = 6;
/** Cards the bench shows at once; the rest pages. */
const BENCH_SLOTS = 14;

export class LoadoutScene extends Phaser.Scene {
  private lvl!: LevelDef;
  private deck: string[] = [];
  private benchPage = 0;
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
      .text(w / 2, 88, this.lvl.brief, { ...textStyle('small', COLORS.muted), wordWrap: { width: 1200 }, align: 'center' })
      .setOrigin(0.5, 0);
    fitText(brief, 1200);
    this.drawDoctrines();

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

  /**
   * The rules this fort is fought under, before a card is chosen.
   *
   * This is the whole point of the screen: a deck is only a decision if the
   * player knows what is being asked of it. Each rule carries its answer, so
   * the briefing teaches the counter rather than only naming the problem.
   */
  private drawDoctrines(): void {
    const rules = (this.lvl.modifiers?.doctrines ?? []).map((id) => DOCTRINES[id]);
    if (!rules.length) return;
    const w = DESIGN.width;
    const cardW = Math.min(760, 1560 / rules.length);
    const total = rules.length * cardW + (rules.length - 1) * 20;

    rules.forEach((d, i) => {
      const cx = (w - total) / 2 + cardW / 2 + i * (cardW + 20);
      // Clear of the fort's brief above: the cards used to be drawn over it.
      const cy = 208;
      const wrap = cardW - 56;
      this.add.rectangle(cx, cy, cardW, 144, 0x3a2434, 0.92).setStrokeStyle(3, 0xc0603a);
      const name = this.add.text(cx, cy - 56, d.name.toUpperCase(), textStyle('small', COLORS.danger)).setOrigin(0.5);
      fitText(name, wrap);
      this.add
        .text(cx, cy - 36, d.blurb, {
          ...textStyle('tiny', COLORS.parchment),
          wordWrap: { width: wrap },
          align: 'center',
        })
        .setOrigin(0.5, 0);
      this.add
        .text(cx, cy + 16, d.answer, {
          ...textStyle('tiny', COLORS.muted),
          wordWrap: { width: wrap },
          align: 'center',
        })
        .setOrigin(0.5, 0)
        .setScale(0.9);
    });
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
      this.add.text(60, 296, `IN HAND  ${this.deck.length} / ${DECK_MAX}`, textStyle('body', COLORS.gold)).setOrigin(0, 0.5),
    );
    this.track(
      this.add
        .text(60, 330, 'Tap a card to drop it. Tap one below to take it.', textStyle('tiny', COLORS.muted))
        .setOrigin(0, 0.5),
    );

    this.deck.forEach((id, i) => {
      const def = defender(id);
      const c = this.track(this.add.container(150 + i * 170, 424));
      c.add(this.add.image(0, 0, 'ui.card').setDisplaySize(150, 168).setTint(0x9ff0b4));
      const portrait = portraitFor(this, def);
      if (portrait) {
        const img = this.add.image(0, -22, portrait.key, portrait.frame);
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

    this.drawBench();
  }

  /**
   * Everything unlocked and not already in hand.
   *
   * Two things this has to get right. The bench used to show the first
   * fourteen cards in unlock order, which by the fifth region meant the five
   * defenders raised to answer *this* horde were off the end of the list and
   * could not be played at all - the whole point of a regional muster,
   * unreachable. So the region's own cards come first and are named as such,
   * and the rest pages rather than being cut off.
   */
  private drawBench(): void {
    const local = new Set(CHAPTERS.find((c) => c.id === this.lvl.chapter)?.unlocks ?? []);
    const bench = DEFENDERS.filter((d) => profile.isCardUnlocked(d.id) && !this.deck.includes(d.id)).sort(
      (a, b) => Number(local.has(b.id)) - Number(local.has(a.id)),
    );
    const pages = Math.max(1, Math.ceil(bench.length / BENCH_SLOTS));
    this.benchPage = Math.min(this.benchPage, pages - 1);
    const page = bench.slice(this.benchPage * BENCH_SLOTS, (this.benchPage + 1) * BENCH_SLOTS);

    this.track(this.add.text(60, 540, 'MUSTERED', textStyle('small', COLORS.muted)).setOrigin(0, 0.5));
    if (pages > 1) {
      this.track(
        this.add
          .text(250, 540, `${this.benchPage + 1} / ${pages}`, textStyle('tiny', COLORS.gold))
          .setOrigin(0, 0.5),
      );
      this.track(
        new TextButton(this, 400, 540, '<', {
          width: 72,
          height: 56,
          tone: 'stone',
          onClick: () => {
            this.benchPage = (this.benchPage + pages - 1) % pages;
            this.draw();
          },
        }),
      );
      this.track(
        new TextButton(this, 490, 540, '>', {
          width: 72,
          height: 56,
          tone: 'stone',
          onClick: () => {
            this.benchPage = (this.benchPage + 1) % pages;
            this.draw();
          },
        }),
      );
    }

    page.forEach((def, i) => {
      const c = this.track(this.add.container(150 + (i % 7) * 170, 640 + Math.floor(i / 7) * 178));
      const full = this.deck.length >= DECK_MAX;
      const home = local.has(def.id);
      c.add(
        this.add
          .image(0, 0, 'ui.card')
          .setDisplaySize(150, 168)
          .setTint(full ? 0x6a6478 : home ? 0xffe6a8 : 0xffffff),
      );
      const portrait = portraitFor(this, def);
      if (portrait) {
        const img = this.add.image(0, -22, portrait.key, portrait.frame);
        img.setScale(Math.min(78 / img.width, 78 / img.height));
        img.setAlpha(full ? 0.5 : 1);
        c.add(img);
      }
      c.add(fitText(this.add.text(0, 42, def.name, textStyle('tiny', COLORS.parchment)).setOrigin(0.5), 130));
      c.add(this.add.text(0, 68, `${def.cost}g`, textStyle('tiny', COLORS.gold)).setOrigin(0.5));
      // Raised here, to fight what is here. Worth saying out loud - inside
      // the card, where it cannot run into the card beside it.
      if (home) {
        c.add(this.add.rectangle(0, -72, 150, 24, 0xf5c542, 0.9));
        c.add(fitText(this.add.text(0, -72, 'RAISED HERE', textStyle('tiny', COLORS.ink)).setOrigin(0.5), 138));
      }
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
    const x = 1560;
    const fitted = profile.equipped;
    this.track(
      this.add
        .text(x, 296, `FITTED TO THE WALL  ${fitted.length} / ${EQUIPMENT_SLOTS}`, textStyle('body', COLORS.gold))
        .setOrigin(0.5),
    );

    const owned = EQUIPMENT.filter((e) => profile.ownsEquipment(e.id));
    if (!owned.length) {
      this.track(
        this.add
          .text(x, 372, 'Nothing yet. The workshop turns salvage into walls.', {
            ...textStyle('small', COLORS.muted),
            wordWrap: { width: 600 },
            align: 'center',
          })
          .setOrigin(0.5),
      );
    }

    owned.forEach((def, i) => {
      const y = 356 + i * 92;
      const on = fitted.includes(def.id);
      const row = this.track(this.add.container(x, y));
      row.add(this.add.rectangle(0, 0, 620, 84, on ? 0x33405e : 0x2a2338, 0.92).setStrokeStyle(3, on ? 0xf5c542 : 0x4a4060));
      if (this.textures.exists(def.icon)) row.add(this.add.image(-270, 0, def.icon).setDisplaySize(52, 52));
      row.add(fitText(this.add.text(-232, -14, def.name, textStyle('small', COLORS.parchment)).setOrigin(0, 0.5), 430));
      row.add(fitText(this.add.text(-232, 18, def.blurb, textStyle('tiny', COLORS.muted)).setOrigin(0, 0.5), 430));
      row.add(this.add.text(262, 0, on ? 'ON' : 'OFF', textStyle('tiny', on ? COLORS.gold : COLORS.muted)).setOrigin(0.5));
      tappable(row, 620, 84);
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
      new TextButton(this, x, 838, 'THE WORKSHOP', {
        width: 360,
        height: 84,
        size: 'small',
        tone: 'blue',
        onClick: () => this.scene.start('Workshop'),
      }),
    );
  }

  /* ---------------------------------------------------------------- stock */

  private drawStock(): void {
    const x = 1560;
    const carried = CONSUMABLES.filter((c) => profile.stockOf(c.id) > 0);
    const line = carried.length
      ? carried.map((c) => `${c.name} x${profile.stockOf(c.id)}`).join('    ')
      : 'No stock in the pack.';
    this.track(this.add.text(x, 930, 'IN THE PACK', textStyle('small', COLORS.gold)).setOrigin(0.5));
    this.track(fitText(this.add.text(x, 972, line, textStyle('tiny', COLORS.muted)).setOrigin(0.5), 620));
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
