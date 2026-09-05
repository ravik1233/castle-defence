/**
 * Armoury: choose the six cards you take into battle, spend gold on upgrades,
 * pick a hero and a castle skin.
 */
import Phaser from 'phaser';
import { DESIGN } from '../core/layout';
import { DEFENDERS, MAX_UPGRADE_LEVEL, upgradeCost, upgradedStats } from '../data/defenders';
import { HEROES } from '../data/heroes';
import { WALL_SKINS } from '../art/structures';
import { profile, PREMIUM_SKINS } from '../systems/profile';
import { ensureAllCastleSkins } from '../systems/textures';
import { audio } from '../systems/audio';
import { COLORS, Counter, TextButton, showDialog, textStyle } from '../ui/kit';

type Tab = 'deck' | 'upgrades' | 'hero' | 'castle';

export class ArmoryScene extends Phaser.Scene {
  private tab: Tab = 'deck';
  private body: Phaser.GameObjects.GameObject[] = [];
  private goldCounter!: Counter;
  private deck: string[] = [];

  constructor() {
    super('Armory');
  }

  create(): void {
    const w = DESIGN.width;
    this.add.rectangle(w / 2, DESIGN.height / 2, w, DESIGN.height, 0x1b1626);
    this.add.image(w / 2, DESIGN.height / 2, 'bg.menu').setDisplaySize(w, DESIGN.height).setAlpha(0.22);

    this.deck = profile.effectiveDeck();
    this.goldCounter = new Counter(this, 44, 70, 'icon.coin', profile.gold, 'body');
    new TextButton(this, w - 92, 70, '<', {
      width: 120,
      height: 92,
      tone: 'stone',
      onClick: () => {
        profile.setDeck(this.deck);
        this.scene.start('MainMenu');
      },
    });
    this.add.text(w / 2, 70, 'ARMOURY', textStyle('title', COLORS.gold)).setOrigin(0.5);

    const tabs: Array<[Tab, string]> = [
      ['deck', 'DECK'],
      ['upgrades', 'FORGE'],
      ['hero', 'HERO'],
      ['castle', 'CASTLE'],
    ];
    tabs.forEach(([id, label], i) => {
      const bw = 240;
      new TextButton(this, 150 + i * (bw + 16), 190, label, {
        width: bw,
        height: 88,
        size: 'small',
        tone: 'stone',
        onClick: () => {
          this.tab = id;
          this.draw();
        },
      });
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
    this.goldCounter.set(profile.gold, false);
    switch (this.tab) {
      case 'deck':
        this.drawDeck();
        break;
      case 'upgrades':
        this.drawUpgrades();
        break;
      case 'hero':
        this.drawHero();
        break;
      default:
        void ensureAllCastleSkins(this).then(() => {
          if (this.tab === 'castle') this.drawCastle();
        });
        this.drawCastle();
        break;
    }
  }

  /* ----------------------------------------------------------------- deck */

  private drawDeck(): void {
    const w = DESIGN.width;
    this.track(
      this.add
        .text(w / 2, 268, 'Tap to add or remove. Six cards go to war.', textStyle('small', COLORS.muted))
        .setOrigin(0.5),
    );

    const cols = 4;
    const cw = 232;
    const ch = 210;
    const startX = (w - cols * cw) / 2 + cw / 2;
    DEFENDERS.forEach((def, i) => {
      const unlocked = profile.isCardUnlocked(def.id);
      const x = startX + (i % cols) * cw;
      const y = 380 + Math.floor(i / cols) * ch;
      const c = this.track(this.add.container(x, y));
      const inDeck = this.deck.includes(def.id);

      const frame = this.add.image(0, 0, 'ui.card').setDisplaySize(200, 180);
      frame.setTint(inDeck ? 0x9ff0b4 : unlocked ? 0xffffff : 0x6a6478);
      c.add(frame);

      const head = def.art.kind === 'unit' ? `unit.${def.art.id}.head` : def.art.key;
      if (this.textures.exists(head)) {
        c.add(this.add.image(0, -24, head).setScale(def.art.kind === 'unit' ? 0.42 : 0.34));
      }
      c.add(this.add.text(0, 48, def.name, textStyle('tiny', COLORS.parchment)).setOrigin(0.5));
      c.add(
        this.add
          .text(0, 76, unlocked ? `${def.cost}g` : def.premium ? 'Crown Pack' : `Lv ${def.unlockLevel}`, textStyle('tiny', unlocked ? COLORS.gold : COLORS.danger))
          .setOrigin(0.5),
      );

      c.setSize(200, 180);
      c.setInteractive(new Phaser.Geom.Rectangle(-100, -90, 200, 180), Phaser.Geom.Rectangle.Contains);
      c.on('pointerdown', () => {
        if (!unlocked) {
          audio.play('deny');
          showDialog(this, {
            title: def.name,
            body: def.premium
              ? `${def.blurb}\n\nUnlocked by the Crown Pack.`
              : `${def.blurb}\n\nUnlocks at campaign level ${def.unlockLevel}.`,
            height: 460,
            buttons: def.premium
              ? [
                  { text: 'BACK', tone: 'stone' },
                  { text: 'CROWN PACK', tone: 'gold', onClick: () => this.scene.start('Store') },
                ]
              : [{ text: 'BACK', tone: 'stone' }],
          });
          return;
        }
        audio.play('tap');
        if (inDeck) {
          if (this.deck.length <= 2) return;
          this.deck = this.deck.filter((id) => id !== def.id);
        } else if (this.deck.length < 6) {
          this.deck = [...this.deck, def.id];
        } else {
          showDialog(this, {
            title: 'Deck is full',
            body: 'Remove a card before adding another.',
            height: 360,
            buttons: [{ text: 'OK', tone: 'stone' }],
          });
          return;
        }
        profile.setDeck(this.deck);
        this.draw();
      });
    });
  }

  /* ------------------------------------------------------------- upgrades */

  private drawUpgrades(): void {
    const w = DESIGN.width;
    this.track(
      this.add
        .text(w / 2, 268, 'Gold spent here is permanent.', textStyle('small', COLORS.muted))
        .setOrigin(0.5),
    );
    const unlocked = DEFENDERS.filter((d) => profile.isCardUnlocked(d.id));
    unlocked.slice(0, 9).forEach((def, i) => {
      const y = 350 + i * 132;
      const lvl = profile.upgradeLevel(def.id);
      const stats = upgradedStats(def, lvl);
      const maxed = lvl >= MAX_UPGRADE_LEVEL;
      const cost = upgradeCost(def, lvl);

      this.track(this.add.rectangle(w / 2, y, w - 120, 116, 0x2a2338, 0.85).setStrokeStyle(3, 0x4a4060));
      const head = def.art.kind === 'unit' ? `unit.${def.art.id}.head` : def.art.key;
      if (this.textures.exists(head)) {
        this.track(this.add.image(120, y, head).setScale(def.art.kind === 'unit' ? 0.34 : 0.26));
      }
      this.track(this.add.text(200, y - 26, `${def.name}  ${'|'.repeat(lvl)}`, textStyle('small', COLORS.parchment)).setOrigin(0, 0.5));
      this.track(
        this.add
          .text(200, y + 20, `${stats.hp} hp   ${stats.damage ? `${stats.damage} dmg` : 'support'}`, textStyle('tiny', COLORS.muted))
          .setOrigin(0, 0.5),
      );

      this.track(
        new TextButton(this, w - 190, y, maxed ? 'MAX' : `${cost}g`, {
          width: 250,
          height: 88,
          size: 'small',
          tone: maxed ? 'stone' : profile.gold >= cost ? 'gold' : 'stone',
          enabled: !maxed && profile.gold >= cost,
          onClick: () => {
            if (profile.buyUpgrade(def.id)) {
              audio.play('upgrade');
              this.draw();
            }
          },
        }),
      );
    });
  }

  /* ----------------------------------------------------------------- hero */

  private drawHero(): void {
    const w = DESIGN.width;
    HEROES.forEach((h, i) => {
      const y = 420 + i * 520;
      const owned = !h.premium || profile.hasCrownPack;
      const active = profile.heroId === h.id;
      this.track(
        this.add
          .rectangle(w / 2, y, w - 120, 470, active ? 0x33405e : 0x2a2338, 0.9)
          .setStrokeStyle(4, active ? 0xf5c542 : 0x4a4060),
      );
      const head = `unit.${h.art}.head`;
      if (this.textures.exists(head)) this.track(this.add.image(180, y - 110, head).setScale(0.6));
      this.track(this.add.text(300, y - 150, h.name, textStyle('title', COLORS.gold)).setOrigin(0, 0.5));
      this.track(this.add.text(300, y - 96, h.title, textStyle('small', COLORS.muted)).setOrigin(0, 0.5));
      this.track(
        this.add
          .text(120, y - 40, h.blurb, { ...textStyle('small'), wordWrap: { width: w - 260 } })
          .setOrigin(0, 0),
      );
      h.spells.forEach((s, si) => {
        const sy = y + 70 + si * 96;
        if (this.textures.exists(s.icon)) {
          this.track(this.add.image(160, sy, s.icon).setDisplaySize(70, 70));
        }
        this.track(this.add.text(215, sy - 18, s.name, textStyle('small', COLORS.parchment)).setOrigin(0, 0.5));
        this.track(
          this.add
            .text(215, sy + 16, `${s.blurb}  (${s.cooldown}s)`, { ...textStyle('tiny', COLORS.muted), wordWrap: { width: w - 400 } })
            .setOrigin(0, 0.5),
        );
      });
      this.track(
        new TextButton(this, w / 2, y + 200, active ? 'LEADING' : owned ? 'CHOOSE' : 'CROWN PACK', {
          width: 420,
          height: 92,
          tone: active ? 'stone' : owned ? 'green' : 'gold',
          enabled: !active,
          onClick: () => {
            if (owned) {
              profile.setHero(h.id);
              audio.play('upgrade');
              this.draw();
            } else {
              this.scene.start('Store');
            }
          },
        }),
      );
    });
  }

  /* --------------------------------------------------------------- castle */

  private drawCastle(): void {
    const w = DESIGN.width;
    this.track(
      this.add.text(w / 2, 268, 'The banner they see before they die.', textStyle('small', COLORS.muted)).setOrigin(0.5),
    );
    WALL_SKINS.forEach((skin, i) => {
      const x = w / 2 - 250 + (i % 2) * 500;
      const y = 480 + Math.floor(i / 2) * 560;
      const owned = profile.ownsSkin(skin.id);
      const active = profile.activeSkin === skin.id;
      this.track(
        this.add
          .rectangle(x, y, 440, 500, active ? 0x33405e : 0x2a2338, 0.9)
          .setStrokeStyle(4, active ? 0xf5c542 : 0x4a4060),
      );
      if (this.textures.exists(`keep.${skin.id}`)) {
        this.track(this.add.image(x, y - 40, `keep.${skin.id}`).setScale(0.9).setAlpha(owned ? 1 : 0.4));
      }
      this.track(this.add.text(x, y + 130, skin.name, textStyle('small', COLORS.parchment)).setOrigin(0.5));
      this.track(
        new TextButton(this, x, y + 200, active ? 'FLYING' : owned ? 'RAISE' : 'CROWN PACK', {
          width: 340,
          height: 86,
          size: 'small',
          tone: active ? 'stone' : owned ? 'green' : 'gold',
          enabled: !active,
          onClick: () => {
            if (owned) {
              profile.setSkin(skin.id);
              audio.play('upgrade');
              this.draw();
            } else if (PREMIUM_SKINS.has(skin.id)) {
              this.scene.start('Store');
            }
          },
        }),
      );
    });
  }
}
