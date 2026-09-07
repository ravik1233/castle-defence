/**
 * The War Ledger: every force in the field, and what beats what.
 *
 * Damage types are only a real decision if the player can look them up. This
 * is where they do that - a roster of both sides, and the matchup table
 * itself, rather than sixteen numbers that only exist inside the code.
 */
import Phaser from 'phaser';
import { DESIGN } from '../core/layout';
import { DEFENDERS } from '../data/defenders';
import { ENEMIES } from '../data/enemies';
import type { DamageType, EnemyKind } from '../data/types';
import { damageMultiplier } from '../battle/combat';
import { portraitFor } from '../art/portraits';
import { showDefenderEntry, showEnemyEntry } from '../ui/ledger';
import { COLORS, TextButton, fitText, tappable, textStyle } from '../ui/kit';

type Tab = 'defenders' | 'enemies' | 'matchups';

const TYPES: DamageType[] = ['physical', 'fire', 'frost', 'holy'];
const KINDS: EnemyKind[] = ['living', 'armoured', 'undead', 'demon'];
const TYPE_LABEL = ['Steel', 'Fire', 'Frost', 'Holy'];
const KIND_LABEL = ['Living', 'Armoured', 'Undead', 'Demon'];

export class LedgerScene extends Phaser.Scene {
  private tab: Tab = 'defenders';
  private body: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Ledger');
  }

  create(): void {
    const w = DESIGN.width;
    this.add.rectangle(w / 2, DESIGN.height / 2, w, DESIGN.height, 0x1b1626);
    this.add.image(w / 2, DESIGN.height / 2, 'bg.menu').setDisplaySize(w, DESIGN.height).setAlpha(0.2);

    this.add
      .text(w / 2, 54, 'WAR LEDGER', textStyle('title', COLORS.gold))
      .setOrigin(0.5);

    new TextButton(this, w - 70, 48, '<', {
      width: 104,
      height: 76,
      tone: 'stone',
      onClick: () => this.scene.start('MainMenu'),
    });

    const tabs: Array<[Tab, string]> = [
      ['defenders', 'OUR FORCES'],
      ['enemies', 'THE HORDE'],
      ['matchups', 'WHAT BEATS WHAT'],
    ];
    tabs.forEach(([id, label], i) => {
      new TextButton(this, 300 + i * 330, 140, label, {
        width: 300,
        height: 76,
        size: 'small',
        tone: this.tab === id ? 'gold' : 'stone',
        onClick: () => {
          this.tab = id;
          this.scene.restart();
        },
      });
    });

    this.render();
  }

  private render(): void {
    for (const o of this.body) o.destroy();
    this.body = [];
    if (this.tab === 'matchups') this.renderMatchups();
    else this.renderRoster();
  }

  /** A grid of cards; tapping one opens its full entry. */
  private renderRoster(): void {
    const cols = 7;
    const cellW = 250;
    const cellH = 210;
    const x0 = DESIGN.width / 2 - ((cols - 1) * cellW) / 2;
    const entries =
      this.tab === 'defenders'
        ? DEFENDERS.map((d) => ({ name: d.name, open: () => showDefenderEntry(this, d), art: portraitFor(this, d) }))
        : ENEMIES.map((e) => ({
            name: e.name,
            open: () => showEnemyEntry(this, e),
            art: this.textures.exists(`unit.${e.art}.frame0`)
              ? { key: `unit.${e.art}.frame0`, whole: true }
              : this.textures.exists(`unit.${e.art}.head`)
                ? { key: `unit.${e.art}.head`, whole: false }
                : undefined,
          }));

    entries.forEach((entry, i) => {
      const x = x0 + (i % cols) * cellW;
      const y = 300 + Math.floor(i / cols) * cellH;
      const card = this.add.container(x, y);
      card.add(this.add.image(0, 0, 'ui.card').setDisplaySize(226, 190));
      if (entry.art) {
        const img = this.add.image(0, -18, entry.art.key);
        const size = entry.art.whole ? 118 : 96;
        const ratio = img.width / img.height;
        img.setDisplaySize(ratio > 1 ? size : size * ratio, ratio > 1 ? size / ratio : size);
        card.add(img);
      }
      const label = this.add.text(0, 68, entry.name, textStyle('tiny')).setOrigin(0.5);
      fitText(label, 206);
      card.add(label);
      tappable(card, 226, 190);
      card.on('pointerdown', entry.open);
      this.body.push(card);
    });
  }

  /** The whole table, once, so nobody has to piece it together from cards. */
  private renderMatchups(): void {
    const x0 = 560;
    const y0 = 300;
    const cw = 200;
    const ch = 96;

    KIND_LABEL.forEach((label, c) => {
      this.body.push(
        this.add.text(x0 + c * cw, y0 - 60, label, textStyle('small', COLORS.parchment)).setOrigin(0.5),
      );
    });

    TYPES.forEach((type, r) => {
      this.body.push(
        this.add
          .text(x0 - cw, y0 + r * ch, TYPE_LABEL[r]!, textStyle('small', COLORS.gold))
          .setOrigin(0.5),
      );
      KINDS.forEach((kind, c) => {
        const m = damageMultiplier(type, kind);
        const colour = m > 1.05 ? COLORS.good : m < 0.95 ? COLORS.danger : COLORS.muted;
        this.body.push(
          this.add.text(x0 + c * cw, y0 + r * ch, `${m.toFixed(2)}x`, textStyle('body', colour)).setOrigin(0.5),
        );
      });
    });

    this.body.push(
      this.add
        .text(
          DESIGN.width / 2,
          y0 + 4 * ch + 40,
          'Steel is never wrong and never right. Everything else is one or the other.',
          textStyle('small', COLORS.muted),
        )
        .setOrigin(0.5),
    );
  }
}
