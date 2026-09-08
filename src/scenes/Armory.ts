/**
 * Armoury: choose the six cards you take into battle, spend gold on upgrades,
 * pick a hero and a castle skin.
 */
import Phaser from 'phaser';
import { DESIGN } from '../core/layout';
import { DEFENDERS, MAX_UPGRADE_LEVEL, upgradeCost, upgradedStats } from '../data/defenders';
import { HEROES } from '../data/heroes';
import { CHAPTERS } from '../data/levels';
import { WALL_SKINS } from '../art/structures';
import { profile, PREMIUM_SKINS } from '../systems/profile';
import { ensureAllCastleSkins } from '../systems/textures';
import { portraitFor, portraitForArt } from '../art/portraits';
import { audio } from '../systems/audio';
import { COLORS, Counter, TextButton, fitText, showDialog, tappable, textStyle } from '../ui/kit';

type Tab = 'deck' | 'upgrades' | 'hero' | 'castle';

/** Upgrade rows that fit on one page; the rest pages. */
const UPGRADES_PER_PAGE = 10;
/** Rows of cards that fit above the bottom of the screen. */
const DECK_GRID_ROWS = 3;
/** Where the page controls sit: clear of the tabs above and the grid below. */
const PAGER_X = 1660;
const PAGER_Y = 196;

export class ArmoryScene extends Phaser.Scene {
  private tab: Tab = 'deck';
  private upgradePage = 0;
  private deckPage = 0;
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
    this.goldCounter = new Counter(this, 40, 48, 'icon.coin', profile.gold, 'body');
    new TextButton(this, w - 70, 48, '<', {
      width: 104,
      height: 76,
      tone: 'stone',
      onClick: () => {
        profile.setDeck(this.deck);
        this.scene.start('MainMenu');
      },
    });
    this.add.text(w / 2, 48, 'ARMOURY', textStyle('title', COLORS.gold)).setOrigin(0.5);

    // Salvage rides beside gold: the two currencies are spent in different
    // places and the player should always know how much of each they hold.
    new Counter(this, 260, 48, 'icon.hammer', profile.salvage, 'body');

    const tabs: Array<[Tab | 'workshop', string]> = [
      ['deck', 'DECK'],
      ['upgrades', 'FORGE'],
      ['hero', 'HERO'],
      ['castle', 'CASTLE'],
      ['workshop', 'WORKSHOP'],
    ];
    tabs.forEach(([id, label], i) => {
      const bw = 240;
      const total = tabs.length * bw + (tabs.length - 1) * 16;
      new TextButton(this, (w - total) / 2 + bw / 2 + i * (bw + 16), 132, label, {
        width: bw,
        height: 76,
        size: 'small',
        tone: 'stone',
        onClick: () => {
          if (id === 'workshop') {
            profile.setDeck(this.deck);
            this.scene.start('Workshop');
            return;
          }
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
        .text(w / 2, 196, 'Tap to add or remove. Six cards go to war.', textStyle('small', COLORS.muted))
        .setOrigin(0.5),
    );

    /*
     * Forty-seven cards in a seven-wide grid ran to y=1710 on a screen 1080
     * tall: three rows fit and twenty-one cards could not be seen, let alone
     * tapped. Three rows to a page, and the page you are on is the page the
     * cards are drawn from.
     */
    const cols = 7;
    const cw = 250;
    const ch = 230;
    const perPage = cols * DECK_GRID_ROWS;
    const pages = Math.max(1, Math.ceil(DEFENDERS.length / perPage));
    this.deckPage = Math.min(this.deckPage, pages - 1);
    const shown = DEFENDERS.slice(this.deckPage * perPage, (this.deckPage + 1) * perPage);
    if (pages > 1) {
      this.track(this.add.text(PAGER_X, PAGER_Y, `${this.deckPage + 1} / ${pages}`, textStyle('tiny', COLORS.gold)).setOrigin(0.5));
      this.track(
        new TextButton(this, PAGER_X - 120, PAGER_Y, '<', {
          width: 84,
          height: 60,
          tone: 'stone',
          onClick: () => {
            this.deckPage = (this.deckPage + pages - 1) % pages;
            this.draw();
          },
        }),
      );
      this.track(
        new TextButton(this, PAGER_X + 120, PAGER_Y, '>', {
          width: 84,
          height: 60,
          tone: 'stone',
          onClick: () => {
            this.deckPage = (this.deckPage + 1) % pages;
            this.draw();
          },
        }),
      );
    }
    const startX = (w - cols * cw) / 2 + cw / 2;
    shown.forEach((def, i) => {
      const unlocked = profile.isCardUnlocked(def.id);
      const x = startX + (i % cols) * cw;
      const y = 330 + Math.floor(i / cols) * ch;
      const c = this.track(this.add.container(x, y));
      const inDeck = this.deck.includes(def.id);

      const frame = this.add.image(0, 0, 'ui.card').setDisplaySize(214, 190);
      frame.setTint(inDeck ? 0x9ff0b4 : unlocked ? 0xffffff : 0x6a6478);
      c.add(frame);

      const portrait = portraitFor(this, def);
      if (portrait) {
        const img = this.add.image(0, -22, portrait.key, portrait.frame);
        // Fit the art into a fixed box so units and buildings line up.
        const box = portrait.whole ? 104 : 92;
        img.setScale(Math.min(box / img.width, box / img.height));
        c.add(img);
      }
      c.add(fitText(this.add.text(0, 48, def.name, textStyle('tiny', COLORS.parchment)).setOrigin(0.5), 180));
      c.add(
        this.add
          .text(0, 76, unlocked ? `${def.cost}g` : def.premium ? 'Crown Pack' : `Lv ${def.unlockLevel}`, textStyle('tiny', unlocked ? COLORS.gold : COLORS.danger))
          .setOrigin(0.5),
      );

      tappable(c, 200, 180);
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
        .text(w / 2, 196, 'Gold spent here is permanent.', textStyle('small', COLORS.muted))
        .setOrigin(0.5),
    );
    /*
     * This used to show the first ten unlocked cards and stop, which meant
     * that from the third region on, the defenders raised to answer the
     * horde in front of the player could never be upgraded at all - the gold
     * only ever reached the starter deck. It pages now.
     */
    const unlocked = DEFENDERS.filter((d) => profile.isCardUnlocked(d.id));
    const pages = Math.max(1, Math.ceil(unlocked.length / UPGRADES_PER_PAGE));
    this.upgradePage = Math.min(this.upgradePage, pages - 1);
    const shown = unlocked.slice(this.upgradePage * UPGRADES_PER_PAGE, (this.upgradePage + 1) * UPGRADES_PER_PAGE);
    if (pages > 1) {
      this.track(
        this.add.text(PAGER_X, PAGER_Y, `${this.upgradePage + 1} / ${pages}`, textStyle('tiny', COLORS.gold)).setOrigin(0.5),
      );
      this.track(
        new TextButton(this, PAGER_X - 120, PAGER_Y, '<', {
          width: 84,
          height: 60,
          tone: 'stone',
          onClick: () => {
            this.upgradePage = (this.upgradePage + pages - 1) % pages;
            this.draw();
          },
        }),
      );
      this.track(
        new TextButton(this, PAGER_X + 120, PAGER_Y, '>', {
          width: 84,
          height: 60,
          tone: 'stone',
          onClick: () => {
            this.upgradePage = (this.upgradePage + 1) % pages;
            this.draw();
          },
        }),
      );
    }
    const colW = w / 2;
    shown.forEach((def, i) => {
      const col = i % 2;
      const cx = colW / 2 + col * colW;
      const y = 280 + Math.floor(i / 2) * 148;
      const lvl = profile.upgradeLevel(def.id);
      const stats = upgradedStats(def, lvl);
      const maxed = lvl >= MAX_UPGRADE_LEVEL;
      const cost = upgradeCost(def, lvl);

      this.track(this.add.rectangle(cx, y, colW - 60, 128, 0x2a2338, 0.85).setStrokeStyle(3, 0x4a4060));
      const portrait = portraitFor(this, def);
      if (portrait) {
        const img = this.add.image(cx - colW / 2 + 70, y, portrait.key, portrait.frame);
        img.setScale(Math.min(90 / img.width, 90 / img.height));
        this.track(img);
      }
      this.track(
        this.add
          .text(cx - colW / 2 + 130, y - 26, `${def.name}  ${'|'.repeat(lvl)}`, textStyle('small', COLORS.parchment))
          .setOrigin(0, 0.5),
      );
      this.track(
        this.add
          .text(
            cx - colW / 2 + 130,
            y + 20,
            `${stats.hp} hp   ${stats.damage ? `${stats.damage} dmg` : 'support'}`,
            textStyle('tiny', COLORS.muted),
          )
          .setOrigin(0, 0.5),
      );

      this.track(
        new TextButton(this, cx + colW / 2 - 150, y, maxed ? 'MAX' : `${cost}g`, {
          width: 220,
          height: 82,
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
    this.track(
      this.add
        .text(w / 2, 196, 'Commanders ride with their own region. Their spells come with them.', textStyle('small', COLORS.muted))
        .setOrigin(0.5),
    );

    /*
     * Seven commanders. A single row of seven gave each card 274 pixels, and
     * at that width the spell blurbs ran to six lines, overlapped each other
     * and the CHOOSE button, and the seventh card hung off the right edge.
     * Four and three, in two rows, gives each one 440 and room for two lines.
     */
    const cols = 4;
    const colW = w / cols;
    const cardW = colW - 40;
    const half = 190;
    HEROES.forEach((h, i) => {
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, HEROES.length - row * cols);
      // A short last row is centred rather than left-aligned under the first.
      const cx = (w - inRow * colW) / 2 + colW / 2 + (i % cols) * colW;
      const y = 430 + row * 410;
      const owned = profile.availableHeroes().includes(h.id);
      const active = profile.heroId === h.id;
      const region = CHAPTERS.find((c) => c.commander === h.id);
      this.track(
        this.add
          .rectangle(cx, y, cardW, half * 2, active ? 0x33405e : 0x2a2338, 0.9)
          .setStrokeStyle(4, active ? 0xf5c542 : 0x4a4060),
      );

      const face = portraitForArt(this, h.art);
      if (face) {
        const img = this.add.image(cx, y - 140, face.key, face.frame);
        img.setScale(Math.min(88 / img.width, 88 / img.height));
        img.setAlpha(owned ? 1 : 0.35);
        this.track(img);
      }

      const name = this.add.text(cx, y - 76, h.name, textStyle('body', COLORS.gold)).setOrigin(0.5);
      this.track(fitText(name, cardW - 60));
      const where = this.add
        .text(cx, y - 50, region ? region.name : h.title, textStyle('tiny', COLORS.muted))
        .setOrigin(0.5);
      this.track(fitText(where, cardW - 60));

      h.spells.forEach((s, si) => {
        // A blurb runs to three lines at this width, so the spells sit 74
        // apart and the button 155 down: at 62 and 148 the first blurb ran
        // into the second spell's name and the second ran under CHOOSE.
        const sy = y - 22 + si * 74;
        if (this.textures.exists(s.icon)) {
          this.track(this.add.image(cx - cardW / 2 + 40, sy + 12, s.icon).setDisplaySize(46, 46));
        }
        this.track(
          this.add
            .text(cx - cardW / 2 + 72, sy, `${s.name}  (${s.cooldown}s)`, textStyle('tiny', COLORS.parchment))
            .setOrigin(0, 0.5),
        );
        /*
         * Two lines and no more. The blurbs vary from one line to four, and
         * a four-line one printed its tail over the next spell's name or the
         * CHOOSE button below it. The full text is on the card in battle and
         * in the ledger; here it only has to say which spell this is.
         */
        const blurb = this.add
          .text(cx - cardW / 2 + 72, sy + 14, s.blurb, {
            ...textStyle('tiny', COLORS.muted),
            wordWrap: { width: (cardW - 100) / 0.85 },
          })
          .setOrigin(0, 0)
          .setScale(0.85);
        const wrapped = blurb.getWrappedText(s.blurb);
        if (wrapped.length > 2) blurb.setText(`${wrapped.slice(0, 2).join('\n').replace(/[.,;\s]+$/, '')}...`);
        this.track(blurb);
      });

      const label = active ? 'LEADING' : owned ? 'CHOOSE' : h.premium && !profile.hasCrownPack ? 'CROWN PACK' : 'NOT YET MET';
      this.track(
        new TextButton(this, cx, y + 155, label, {
          width: cardW - 60,
          height: 58,
          size: 'small',
          tone: active ? 'stone' : owned ? 'green' : h.premium && !profile.hasCrownPack ? 'gold' : 'stone',
          enabled: !active && (owned || (h.premium && !profile.hasCrownPack)),
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
      this.add.text(w / 2, 196, 'The banner they see before they die.', textStyle('small', COLORS.muted)).setOrigin(0.5),
    );
    WALL_SKINS.forEach((skin, i) => {
      const x = (w / WALL_SKINS.length) * (i + 0.5);
      const y = 590;
      const owned = profile.ownsSkin(skin.id);
      const active = profile.activeSkin === skin.id;
      this.track(
        this.add
          .rectangle(x, y, w / WALL_SKINS.length - 40, 560, active ? 0x33405e : 0x2a2338, 0.9)
          .setStrokeStyle(4, active ? 0xf5c542 : 0x4a4060),
      );
      if (this.textures.exists(`keep.${skin.id}`)) {
        this.track(this.add.image(x, y - 60, `keep.${skin.id}`).setScale(0.85).setAlpha(owned ? 1 : 0.4));
      }
      this.track(this.add.text(x, y + 120, skin.name, textStyle('small', COLORS.parchment)).setOrigin(0.5));
      this.track(
        new TextButton(this, x, y + 200, active ? 'FLYING' : owned ? 'RAISE' : 'CROWN PACK', {
          width: 320,
          height: 82,
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
