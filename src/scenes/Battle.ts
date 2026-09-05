/**
 * The battle.
 *
 * Five lanes, a wall on the left, and a horde that walks. The player places
 * defenders from a card tray with gold, and casts hero spells by tapping the
 * field. If the wall reaches zero, humanity is over.
 */
import Phaser from 'phaser';
import {
  DESIGN,
  FIELD,
  GRID,
  HERO_BAR,
  HUD,
  SPAWN_X,
  TRAY,
  WALL,
  cellCenter,
  colFromX,
  laneCenterY,
  laneGroundY,
  rowFromY,
} from '../core/layout';
import { BIOMES } from '../art/scenery';
import { WALL_SKINS } from '../art/structures';
import { DEFENDERS, defender, upgradedStats } from '../data/defenders';
import { enemy as enemyDef } from '../data/enemies';
import { hero as heroDef } from '../data/heroes';
import { generateWaves, level as levelById, levelNumber, type Wave } from '../data/levels';
import type { LevelDef, SpellDef } from '../data/types';
import { profile } from '../systems/profile';
import { audio, haptic, type SfxId } from '../systems/audio';
import { COLORS, Counter, TextButton, floatText, showDialog, textStyle } from '../ui/kit';
import { Defender, Enemy, Projectile, type BattleWorld, type ProjectileOptions } from '../battle/entities';
import { enemyScaling, starsForWall, tensionFor } from '../battle/combat';

const WALL_MAX_HP = 1000;
const PREP_SECONDS = 10;

interface CardView {
  id: string;
  container: Phaser.GameObjects.Container;
  cost: number;
  cooldown: number;
  cooldownLeft: number;
  overlay: Phaser.GameObjects.Rectangle;
  costText: Phaser.GameObjects.Text;
  frame: Phaser.GameObjects.Image;
}

interface SpellView {
  spell: SpellDef;
  container: Phaser.GameObjects.Container;
  cooldownLeft: number;
  overlay: Phaser.GameObjects.Graphics;
  ready: Phaser.GameObjects.Image;
}

export class BattleScene extends Phaser.Scene implements BattleWorld {
  private levelDef!: LevelDef;
  private waves: Wave[] = [];
  private waveIndex = -1;
  private waveTimer = PREP_SECONDS;
  private spawnQueue: Array<{ at: number; enemyId: string; row: number }> = [];
  private elapsed = 0;
  private finished = false;

  private gold = 0;
  private wallHp = WALL_MAX_HP;
  private killCount = 0;
  private goldSpent = 0;

  readonly enemies: Enemy[] = [];
  readonly defenders: Defender[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly occupancy = new Map<string, Defender>();

  rallyFactor = 1;
  private rallyTimer = 0;
  chapter = 1;

  private selectedCard?: string;
  private selectedSpell?: SpellDef;
  private cards: CardView[] = [];
  private spells: SpellView[] = [];
  private ghost?: Phaser.GameObjects.Container;
  private cellMarker!: Phaser.GameObjects.Image;

  private goldCounter!: Counter;
  private waveText!: Phaser.GameObjects.Text;
  private wallBar!: Phaser.GameObjects.Rectangle;

  private wallLabel!: Phaser.GameObjects.Text;

  private paused = false;
  private skipBriefing = false;

  constructor() {
    super('Battle');
  }

  /**
   * Test surface. Only installed outside production builds; the smoke test
   * drives a real battle through this rather than faking pointer events.
   */
  private installTestHooks(): void {
    if (!import.meta.env.DEV && !__QA_BUILD__) return;
    (globalThis as unknown as { __battle?: unknown }).__battle = {
      place: (id: string, row: number, col: number): boolean => {
        if (!this.canPlaceAt(row, col)) return false;
        this.placeDefender(id, row, col);
        return true;
      },
      spawn: (id: string, row: number): void => this.spawnEnemy(id, row),
      nextWave: (): void => this.startWave(),
      // Jumps to the final wave so the victory path can be exercised.
      endWaves: (): void => {
        this.waveIndex = this.waves.length - 1;
        this.spawnQueue.length = 0;
        this.updateHud();
      },
      addGold: (n: number): void => {
        this.gold += n;
        this.updateHud();
      },
      state: () => ({
        gold: Math.round(this.gold),
        wallHp: Math.round(this.wallHp),
        wave: this.waveIndex + 1,
        waves: this.waves.length,
        enemies: this.enemies.filter((e) => e.alive).length,
        defenders: this.defenders.filter((d) => d.alive).length,
        kills: this.killCount,
        finished: this.finished,
        enemyDump: this.enemies
          .filter((e) => e.alive)
          .map((e) => ({ id: e.def.id, row: e.row, x: Math.round(e.x), hp: Math.round(e.hp) })),
      }),
      castAt: (spellIndex: number, x: number, y: number): void => {
        const spell = this.spells[spellIndex]?.spell;
        if (spell) this.castSpell(spell, x, y);
      },
    };
  }

  init(data: { levelId: string; skipBriefing?: boolean }): void {
    this.skipBriefing = Boolean(data.skipBriefing);
    this.levelDef = levelById(data.levelId ?? 'c1l1');
    this.chapter = this.levelDef.chapter;
    this.waves = generateWaves(this.levelDef);
    this.waveIndex = -1;
    this.waveTimer = PREP_SECONDS;
    this.spawnQueue = [];
    this.elapsed = 0;
    this.finished = false;
    this.gold = this.levelDef.startingGold;
    this.wallHp = WALL_MAX_HP;
    this.killCount = 0;
    this.goldSpent = 0;
    this.rallyFactor = 1;
    this.rallyTimer = 0;
    this.enemies.length = 0;
    this.defenders.length = 0;
    this.projectiles.length = 0;
    this.occupancy.clear();
    this.selectedCard = undefined;
    this.selectedSpell = undefined;
    this.cards = [];
    this.spells = [];
    this.paused = false;
  }

  create(): void {
    this.buildField();
    this.buildHud();
    this.buildTray();
    this.buildHeroBar();
    this.bindInput();

    audio.startMusic();
    audio.setTension(0);

    if (!this.skipBriefing) this.announce(this.levelDef.name, this.levelDef.brief);
    if (this.levelDef.id === 'c1l1' && !profile.raw.tutorialDone) this.showTutorialHints();
    this.installTestHooks();

    this.events.on('summon', (source: Enemy) => {
      // Warlords call in a pair of grunts beside them.
      for (const dx of [-40, 40]) {
        this.spawnEnemy('goblin', source.row, Math.min(SPAWN_X, source.x + dx));
      }
      this.burst(source.x, source.topY, 'magic');
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      audio.stopMusic();
      this.events.off('summon');
    });
  }

  /* ------------------------------------------------------------- scenery - */

  private buildField(): void {
    const biome = BIOMES[this.levelDef.biome];
    this.add
      .image(DESIGN.width / 2, FIELD.y - FIELD.horizon, `bg.${biome.id}`)
      .setOrigin(0.5, 0)
      .setDisplaySize(DESIGN.width, FIELD.height + FIELD.horizon)
      .setDepth(-1000);

    // Everything above and below the field is a dark surround.
    this.add.rectangle(DESIGN.width / 2, (FIELD.y - FIELD.horizon) / 2, DESIGN.width, FIELD.y - FIELD.horizon, 0x140f1e).setDepth(-1200);
    this.add
      .rectangle(
        DESIGN.width / 2,
        FIELD.y + FIELD.height + (DESIGN.height - FIELD.y - FIELD.height) / 2,
        DESIGN.width,
        DESIGN.height - FIELD.y - FIELD.height,
        0x140f1e,
      )
      .setDepth(-1200);

    const skin = WALL_SKINS.find((s) => s.id === profile.activeSkin) ?? WALL_SKINS[0]!;
    this.add
      .image(0, FIELD.y - FIELD.horizon, `wall.${skin.id}`)
      .setOrigin(0, 0)
      .setDisplaySize(WALL.width, FIELD.height + FIELD.horizon)
      .setDepth(2000);
    this.add
      .image(WALL.width - 34, FIELD.y + FIELD.height / 2, `gate.${skin.id}`)
      .setOrigin(0.5, 0.5)
      .setDepth(2002);

    this.cellMarker = this.add
      .image(0, 0, 'ui.cell')
      .setDisplaySize(GRID.cellW, GRID.cellH)
      .setVisible(false)
      .setDepth(2500);
  }

  /* ----------------------------------------------------------------- hud - */

  private buildHud(): void {
    this.add.rectangle(DESIGN.width / 2, HUD.height / 2, DESIGN.width, HUD.height, 0x1b1626, 0.94).setDepth(3000);
    this.goldCounter = new Counter(this, 40, 52, 'icon.coin', this.gold);
    this.goldCounter.setDepth(3001);

    this.waveText = this.add
      .text(DESIGN.width / 2, 40, '', textStyle('small', COLORS.parchment))
      .setOrigin(0.5, 0)
      .setDepth(3001);

    this.add
      .rectangle(DESIGN.width / 2, 114, 520, 34, 0x2a2338)
      .setStrokeStyle(4, 0x0f0c1a)
      .setDepth(3001);
    this.wallBar = this.add
      .rectangle(DESIGN.width / 2 - 258, 114, 516, 28, 0x5fd07a)
      .setOrigin(0, 0.5)
      .setDepth(3002);
    this.wallLabel = this.add
      .text(DESIGN.width / 2, 114, 'GATE', textStyle('tiny', COLORS.ink, { strokeThickness: 0 }))
      .setOrigin(0.5)
      .setDepth(3003);

    new TextButton(this, DESIGN.width - 76, 56, '||', {
      width: 96,
      height: 84,
      tone: 'stone',
      onClick: () => this.openPause(),
    }).setDepth(3002);

    this.updateHud();
  }

  private updateHud(): void {
    this.goldCounter.set(this.gold);
    const total = this.waves.length;
    const shown = Math.max(1, this.waveIndex + 1);
    this.waveText.setText(
      this.waveIndex < 0
        ? `First wave in ${Math.ceil(this.waveTimer)}s`
        : `Wave ${Math.min(shown, total)} / ${total}`,
    );
    const f = Math.max(0, this.wallHp / WALL_MAX_HP);
    this.wallBar.width = 516 * f;
    this.wallBar.fillColor = f > 0.55 ? 0x5fd07a : f > 0.25 ? 0xf0b429 : 0xe8455c;
    this.wallLabel.setText(`GATE ${Math.max(0, Math.ceil(this.wallHp))}`);
  }

  /* ---------------------------------------------------------------- tray - */

  private deckForLevel(): string[] {
    const mods = this.levelDef.modifiers;
    if (mods?.fixedDeck) return mods.fixedDeck;
    let deck = profile.effectiveDeck();
    if (mods?.bannedCards) deck = deck.filter((id) => !mods.bannedCards!.includes(id));
    return deck;
  }

  private buildTray(): void {
    const deck = this.deckForLevel();
    this.add.rectangle(DESIGN.width / 2, TRAY.y + TRAY.height / 2, DESIGN.width, TRAY.height, 0x221c33, 0.92).setDepth(3000);

    const total = deck.length * TRAY.cardW + (deck.length - 1) * TRAY.gap;
    const startX = (DESIGN.width - total) / 2 + TRAY.cardW / 2;

    deck.forEach((id, i) => {
      const def = defender(id);
      const x = startX + i * (TRAY.cardW + TRAY.gap);
      const y = TRAY.y + TRAY.height / 2 - 4;
      const container = this.add.container(x, y).setDepth(3001);

      const frame = this.add.image(0, 0, 'ui.card').setDisplaySize(TRAY.cardW, TRAY.cardH);
      container.add(frame);

      const art = this.cardArt(id, 0, -18, 0.42);
      container.add(art);

      const costText = this.add
        .text(0, TRAY.cardH / 2 - 26, String(def.cost), textStyle('small', COLORS.gold))
        .setOrigin(0.5);
      container.add(costText);
      container.add(this.add.image(-34, TRAY.cardH / 2 - 26, 'icon.coin').setDisplaySize(30, 30));

      const overlay = this.add
        .rectangle(0, 0, TRAY.cardW - 12, TRAY.cardH - 12, 0x0b0713, 0.62)
        .setOrigin(0.5)
        .setVisible(false);
      container.add(overlay);

      container.setSize(TRAY.cardW, TRAY.cardH);
      container.setInteractive(
        new Phaser.Geom.Rectangle(-TRAY.cardW / 2, -TRAY.cardH / 2, TRAY.cardW, TRAY.cardH),
        Phaser.Geom.Rectangle.Contains,
      );
      container.on('pointerdown', () => this.selectCard(id));

      this.cards.push({
        id,
        container,
        cost: def.cost,
        cooldown: def.recharge,
        cooldownLeft: 0,
        overlay,
        costText,
        frame,
      });
    });


  }

  /** A small preview of a defender for cards and ghosts. */
  private cardArt(id: string, x: number, y: number, scale: number): Phaser.GameObjects.Container {
    const def = defender(id);
    const c = this.add.container(x, y);
    if (def.art.kind === 'build') {
      const img = this.add.image(0, 46, def.art.key).setOrigin(0.5, 1).setScale(scale * 1.55);
      c.add(img);
    } else {
      // Compose the character from its parts at rest.
      const parts = ['legBack', 'legFront', 'torso', 'head', 'armBack', 'armFront', 'weapon', 'offhand'];
      for (const p of parts) {
        const key = `unit.${def.art.id}.${p}`;
        if (!this.textures.exists(key)) continue;
        const img = this.add.image(0, 0, key);
        img.setScale(scale * 0.5);
        c.add(img);
      }
      c.removeAll(true);
      // Simpler and sharper: use the head as the card portrait.
      const head = `unit.${def.art.id}.head`;
      if (this.textures.exists(head)) {
        c.add(this.add.image(0, 8, head).setScale(scale * 1.25));
      }
    }
    return c;
  }

  private selectCard(id: string): void {
    audio.play('tap');
    if (this.selectedCard === id) {
      this.clearSelection();
      return;
    }
    this.selectedSpell = undefined;
    this.selectedCard = id;
    this.refreshCardHighlight();
    this.buildGhost();
  }

  private clearSelection(): void {
    this.selectedCard = undefined;
    this.selectedSpell = undefined;
    this.ghost?.destroy();
    this.ghost = undefined;
    this.cellMarker.setVisible(false);
    this.refreshCardHighlight();
    this.refreshSpellHighlight();
  }

  private refreshCardHighlight(): void {
    for (const card of this.cards) {
      card.frame.setTint(this.selectedCard === card.id ? 0xffe9a8 : 0xffffff);
      card.container.setScale(this.selectedCard === card.id ? 1.07 : 1);
    }
  }

  private buildGhost(): void {
    this.ghost?.destroy();
    this.ghost = undefined;
    if (!this.selectedCard || this.selectedCard === '__sell__') return;
    this.ghost = this.cardArt(this.selectedCard, -500, -500, 1);
    this.ghost.setAlpha(0.65).setDepth(2600);
  }

  /* ----------------------------------------------------------- hero bar - */

  private buildHeroBar(): void {
    const hero = heroDef(profile.heroId);
    const y = HERO_BAR.y + HERO_BAR.height / 2;
    this.add.rectangle(DESIGN.width / 2, y, DESIGN.width, HERO_BAR.height, 0x221c33, 0.92).setDepth(3000);

    const portraitKey = `unit.${hero.art}.head`;
    if (this.textures.exists(portraitKey)) {
      this.add.image(110, y, portraitKey).setScale(0.5).setDepth(3001);
    }
    this.add
      .text(190, y - 30, hero.name, textStyle('small', COLORS.gold))
      .setOrigin(0, 0.5)
      .setDepth(3001);
    this.add
      .text(190, y + 16, hero.title, textStyle('tiny', COLORS.muted))
      .setOrigin(0, 0.5)
      .setDepth(3001)
      .setFixedSize(300, 0);

    // The sell tool lives beside the hero, out of the card row.
    new TextButton(this, DESIGN.width / 2 + 50, y, 'SELL', {
      width: 150,
      height: 100,
      tone: 'red',
      size: 'small',
      onClick: () => this.selectCard('__sell__'),
    }).setDepth(3001);

    hero.spells.forEach((spell, i) => {
      const x = DESIGN.width - 240 + i * 150;
      const container = this.add.container(x, y).setDepth(3001);
      const ring = this.add.image(0, 0, 'ui.button.blue').setDisplaySize(126, 126);
      container.add(ring);
      const icon = this.add.image(0, 0, spell.icon).setDisplaySize(78, 78);
      container.add(icon);
      const overlay = this.add.graphics();
      container.add(overlay);
      container.setSize(126, 126);
      container.setInteractive(new Phaser.Geom.Rectangle(-63, -63, 126, 126), Phaser.Geom.Rectangle.Contains);
      container.on('pointerdown', () => this.selectSpell(spell));
      this.add
        .text(x, y + 74, spell.name, textStyle('tiny', COLORS.muted))
        .setOrigin(0.5)
        .setDepth(3001);
      this.spells.push({ spell, container, cooldownLeft: 0, overlay, ready: ring });
    });
  }

  private selectSpell(spell: SpellDef): void {
    const view = this.spells.find((s) => s.spell.id === spell.id);
    if (!view || view.cooldownLeft > 0) {
      audio.play('deny');
      return;
    }
    audio.play('tap');
    this.selectedCard = undefined;
    this.refreshCardHighlight();
    this.ghost?.destroy();
    this.ghost = undefined;
    if (spell.target === 'global') {
      this.castSpell(spell, DESIGN.width / 2, laneCenterY(2));
      return;
    }
    this.selectedSpell = this.selectedSpell?.id === spell.id ? undefined : spell;
    this.refreshSpellHighlight();
  }

  private refreshSpellHighlight(): void {
    for (const s of this.spells) {
      s.ready.setTint(this.selectedSpell?.id === s.spell.id ? 0xffe9a8 : 0xffffff);
    }
  }

  private castSpell(spell: SpellDef, x: number, y: number): void {
    const view = this.spells.find((s) => s.spell.id === spell.id);
    if (!view || view.cooldownLeft > 0) return;
    view.cooldownLeft = spell.cooldown;
    this.selectedSpell = undefined;
    this.refreshSpellHighlight();
    haptic(24);

    const row = Math.max(0, Math.min(GRID.rows - 1, rowFromY(y)));
    switch (spell.effect) {
      case 'smite': {
        this.sfx('smite');
        this.shake(10);
        const ring = this.add.image(x, y, 'fx.holy_ring').setDepth(4000).setScale(0.2);
        this.tweens.add({
          targets: ring,
          scale: (spell.radius ?? 160) / 90,
          alpha: 0,
          duration: 420,
          onComplete: () => ring.destroy(),
        });
        for (const e of this.enemies) {
          if (!e.alive) continue;
          if (Phaser.Math.Distance.Between(e.x, e.y - 50, x, y) <= (spell.radius ?? 160)) {
            e.takeDamage(spell.damage ?? 200, true);
          }
        }
        break;
      }
      case 'chain': {
        this.sfx('magic');
        const hit = this.enemies
          .filter((e) => e.alive && e.row === row)
          .sort((a, b) => a.x - b.x)
          .slice(0, 6);
        let prev: { x: number; y: number } = { x: WALL.width, y: laneCenterY(row) };
        for (const e of hit) {
          const line = this.add
            .line(0, 0, prev.x, prev.y, e.x, e.y - 60, 0x9fe8ff, 1)
            .setOrigin(0)
            .setLineWidth(6)
            .setDepth(4000);
          this.tweens.add({ targets: line, alpha: 0, duration: 300, onComplete: () => line.destroy() });
          e.takeDamage(spell.damage ?? 180, true);
          prev = { x: e.x, y: e.y - 60 };
        }
        break;
      }
      case 'freeze': {
        this.sfx('freeze');
        const ring = this.add.image(DESIGN.width / 2, laneCenterY(2), 'fx.frost_ring').setDepth(4000).setScale(0.4);
        this.tweens.add({ targets: ring, scale: 7, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
        for (const e of this.enemies) {
          if (!e.alive) continue;
          e.freeze(spell.duration ?? 5);
          if (spell.damage) e.takeDamage(spell.damage, true);
        }
        break;
      }
      case 'rally': {
        this.sfx('upgrade');
        this.rallyFactor = 1.6;
        this.rallyTimer = spell.duration ?? 8;
        const ring = this.add.image(WALL.width, laneCenterY(2), 'fx.shockwave').setDepth(4000).setScale(0.3);
        this.tweens.add({ targets: ring, scale: 8, alpha: 0, duration: 800, onComplete: () => ring.destroy() });
        for (const d of this.defenders) if (d.alive) this.burst(d.x, d.y - 80, 'heal');
        break;
      }
      default:
        break;
    }
  }

  /* --------------------------------------------------------------- input - */

  private bindInput(): void {
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onHover(p.worldX, p.worldY));
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.worldY < FIELD.y || p.worldY > FIELD.y + FIELD.height) return;
      this.onFieldTap(p.worldX, p.worldY);
    });
    this.input.keyboard?.on('keydown-ESC', () => this.openPause());
  }

  private onHover(x: number, y: number): void {
    if (this.selectedSpell) {
      this.cellMarker.setVisible(false);
      this.ghost?.setVisible(false);
      return;
    }
    if (!this.selectedCard || this.selectedCard === '__sell__') {
      this.cellMarker.setVisible(false);
      return;
    }
    const row = rowFromY(y);
    const col = colFromX(x);
    const valid = this.canPlaceAt(row, col);
    if (row < 0 || row >= GRID.rows || col < 0 || col >= GRID.cols) {
      this.cellMarker.setVisible(false);
      this.ghost?.setVisible(false);
      return;
    }
    const c = cellCenter(row, col);
    this.cellMarker.setPosition(c.x, c.y).setVisible(true).setTint(valid ? 0xffffff : 0xff6b6b);
    this.ghost?.setVisible(true).setPosition(c.x, laneGroundY(row));
  }

  private canPlaceAt(row: number, col: number): boolean {
    if (row < 0 || row >= GRID.rows || col < 0 || col >= GRID.cols) return false;
    if (this.occupancy.has(`${row},${col}`)) return false;
    const blocked = this.levelDef.modifiers?.blockedCells;
    if (blocked?.some(([r, c]) => r === row && c === col)) return false;
    return true;
  }

  private onFieldTap(x: number, y: number): void {
    if (this.selectedSpell) {
      this.castSpell(this.selectedSpell, x, y);
      return;
    }
    const row = rowFromY(y);
    const col = colFromX(x);

    if (this.selectedCard === '__sell__') {
      const target = this.occupancy.get(`${row},${col}`);
      if (target) {
        const refund = Math.max(10, Math.round(target.def.cost * 0.5));
        this.gold += refund;
        floatText(this, target.x, target.y - 90, `+${refund}`, COLORS.gold);
        this.occupancy.delete(`${row},${col}`);
        target.kill();
        audio.play('coin');
        this.updateHud();
      } else {
        audio.play('deny');
      }
      return;
    }

    if (!this.selectedCard) return;
    const card = this.cards.find((c) => c.id === this.selectedCard);
    if (!card) return;

    if (!this.canPlaceAt(row, col)) {
      audio.play('deny');
      return;
    }
    if (card.cooldownLeft > 0) {
      audio.play('deny');
      floatText(this, x, y - 40, 'recharging', COLORS.muted, 'tiny');
      return;
    }
    if (this.gold < card.cost) {
      audio.play('deny');
      floatText(this, x, y - 40, 'not enough gold', COLORS.danger, 'tiny');
      return;
    }

    this.placeDefender(this.selectedCard, row, col);
    card.cooldownLeft = card.cooldown;
    this.gold -= card.cost;
    this.goldSpent += card.cost;
    this.updateHud();
    audio.play('place');
    haptic(14);
    this.clearSelection();
  }

  private placeDefender(id: string, row: number, col: number): void {
    const def = defender(id);
    const stats = upgradedStats(def, profile.upgradeLevel(id));
    const unit = new Defender(this, def, row, col, stats);
    this.defenders.push(unit);
    this.occupancy.set(`${row},${col}`, unit);
  }

  /* ------------------------------------------------------ BattleWorld API - */

  get stage(): Phaser.Scene {
    return this;
  }

  defenderAt(row: number, col: number): Defender | undefined {
    return this.occupancy.get(`${row},${col}`);
  }

  spawnProjectile(opts: ProjectileOptions): void {
    this.projectiles.push(new Projectile(this, opts));
  }

  damageWall(amount: number, atY: number): void {
    if (this.finished) return;
    this.wallHp -= amount;
    floatText(this, WALL.width + 20, atY - 80, `-${Math.round(amount)}`, COLORS.danger, 'small');
    this.cameras.main.flash(90, 120, 20, 30);
    this.updateHud();
    if (this.wallHp <= 0) this.endBattle(false);
  }

  awardGold(amount: number, x: number, y: number): void {
    this.gold += amount;
    audio.play('coin');
    const coin = this.add.image(x, y, 'icon.coin').setDepth(5000).setScale(0.7);
    this.tweens.add({
      targets: coin,
      x: 60,
      y: 52,
      scale: 0.4,
      duration: 620,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        coin.destroy();
        this.updateHud();
      },
    });
    floatText(this, x, y - 20, `+${amount}`, COLORS.gold, 'tiny');
  }

  onEnemyKilled(e: Enemy): void {
    this.killCount += 1;
    const bounty = Math.round(e.def.bounty * (1 + (this.chapter - 1) * 0.15));
    this.gold += bounty;
    floatText(this, e.x, e.y - 100, `+${bounty}`, COLORS.gold, 'tiny');
    this.updateHud();
  }

  burst(x: number, y: number, kind: 'hit' | 'blood' | 'magic' | 'explosion' | 'coin' | 'heal'): void {
    const config: Record<string, { key: string; count: number; speed: number; scale: number; tint?: number }> = {
      hit: { key: 'fx.spark', count: 5, speed: 180, scale: 0.5 },
      blood: { key: 'fx.blood', count: 8, speed: 220, scale: 0.7 },
      magic: { key: 'fx.spark', count: 8, speed: 200, scale: 0.6, tint: 0xa45cf0 },
      explosion: { key: 'fx.ember', count: 16, speed: 340, scale: 1.1 },
      coin: { key: 'icon.coin', count: 3, speed: 160, scale: 0.4 },
      heal: { key: 'fx.spark', count: 6, speed: 120, scale: 0.5, tint: 0x8fe2a8 },
    };
    const c = config[kind]!;
    for (let i = 0; i < c.count; i += 1) {
      const p = this.add.image(x, y, c.key).setDepth(6000).setScale(c.scale);
      if (c.tint) p.setTint(c.tint);
      const a = Math.random() * Math.PI * 2;
      const s = c.speed * (0.4 + Math.random() * 0.8);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(a) * s * 0.35,
        y: y + Math.sin(a) * s * 0.35 - 20,
        alpha: 0,
        scale: c.scale * 0.3,
        duration: 380 + Math.random() * 220,
        ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  shake(intensity: number): void {
    this.cameras.main.shake(140, intensity / 3000);
  }

  sfx(id: SfxId): void {
    audio.play(id);
  }

  /* --------------------------------------------------------------- waves - */

  private startWave(): void {
    this.waveIndex += 1;
    const wave = this.waves[this.waveIndex];
    if (!wave) return;
    this.waveTimer = wave.duration;
    for (const e of wave.entries) {
      this.spawnQueue.push({ at: this.elapsed + e.delay, enemyId: e.enemyId, row: e.row });
    }
    audio.play('wave');
    this.banner(
      wave.big ? 'A HUGE WAVE APPROACHES' : `WAVE ${this.waveIndex + 1}`,
      wave.big ? COLORS.danger : COLORS.gold,
    );
    this.updateHud();
  }

  private spawnEnemy(id: string, row: number, x = SPAWN_X): void {
    const def = enemyDef(id);
    const scale = enemyScaling(this.chapter, Math.max(0, this.waveIndex)) * (this.levelDef.modifiers?.hpScale ?? 1);
    const e = new Enemy(this, def, row, x, { hpScale: scale, damageScale: Math.sqrt(scale) });
    this.enemies.push(e);
    if (def.special === 'boss') {
      this.banner('THE DEMON KING', COLORS.danger);
      this.shake(20);
    }
  }

  /**
   * The only tutorial in the game: two hints on the first level, shown once.
   * The Tithe Shrine hint is the one that matters - players who skip the
   * economy lose the second wave and do not come back.
   */
  private showTutorialHints(): void {
    const hint = (text: string, y: number, delay: number): void => {
      const t = this.add
        .text(DESIGN.width / 2, y, text, {
          ...textStyle('small', COLORS.parchment),
          align: 'center',
          backgroundColor: '#1b1626dd',
          padding: { x: 22, y: 14 },
          wordWrap: { width: 760 },
        })
        .setOrigin(0.5)
        .setDepth(6500)
        .setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 300, delay });
      this.tweens.add({
        targets: t,
        alpha: 0,
        duration: 400,
        delay: delay + 7000,
        onComplete: () => t.destroy(),
      });
    };
    hint('Tap a card, then tap the field to place it.', FIELD.y + 90, 900);
    hint('Build Tithe Shrines first - they are your only income.', FIELD.y + 220, 4200);
    profile.markTutorialDone();
  }

  private banner(text: string, color: string): void {
    const t = this.add
      .text(DESIGN.width / 2, FIELD.y + 120, text, textStyle('title', color))
      .setOrigin(0.5)
      .setDepth(7000)
      .setAlpha(0);
    this.tweens.add({
      targets: t,
      alpha: 1,
      y: FIELD.y + 90,
      duration: 260,
      yoyo: true,
      hold: 900,
      onComplete: () => t.destroy(),
    });
  }

  private announce(title: string, body: string): void {
    showDialog(this, {
      title,
      body,
      width: 860,
      height: 460,
      dismissable: false,
      buttons: [{ text: 'HOLD THE GATE', tone: 'green' }],
    });
  }

  /* -------------------------------------------------------------- update - */

  override update(time: number, delta: number): void {
    if (this.paused || this.finished) return;
    const dt = delta / 1000;
    this.elapsed += dt;

    // Wave pacing
    if (this.waveIndex < this.waves.length - 1) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) this.startWave();
      if (this.waveIndex < 0) this.updateHud();
    } else if (this.waveIndex === this.waves.length - 1) {
      const noneLeft = this.spawnQueue.length === 0 && this.enemies.every((e) => !e.alive);
      if (noneLeft) this.endBattle(true);
    }

    // Scheduled spawns
    while (this.spawnQueue.length && this.spawnQueue[0]!.at <= this.elapsed) {
      const s = this.spawnQueue.shift()!;
      this.spawnEnemy(s.enemyId, s.row);
    }
    this.spawnQueue.sort((a, b) => a.at - b.at);

    if (this.levelDef.modifiers?.goldTrickle) {
      this.gold += this.levelDef.modifiers.goldTrickle * dt;
      this.goldCounter.set(Math.floor(this.gold), false);
    }

    if (this.rallyTimer > 0) {
      this.rallyTimer -= dt;
      if (this.rallyTimer <= 0) this.rallyFactor = 1;
    }

    for (const d of this.defenders) d.update(time, delta);
    for (const e of this.enemies) e.update(time, delta);
    for (const p of this.projectiles) p.update(time, delta);

    // Reap
    for (let i = this.defenders.length - 1; i >= 0; i -= 1) {
      const d = this.defenders[i]!;
      if (!d.alive) {
        this.occupancy.delete(`${d.row},${d.col}`);
        this.defenders.splice(i, 1);
      }
    }
    for (let i = this.enemies.length - 1; i >= 0; i -= 1) {
      if (!this.enemies[i]!.alive) {
        // Keep the corpse around for its death animation, then drop it.
        const e = this.enemies[i]!;
        this.enemies.splice(i, 1);
        this.time.delayedCall(900, () => e.destroy());
      }
    }
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      if (!this.projectiles[i]!.alive) this.projectiles.splice(i, 1);
    }

    // Cards recharge
    for (const card of this.cards) {
      if (card.cooldownLeft > 0) {
        card.cooldownLeft = Math.max(0, card.cooldownLeft - dt);
      }
      const affordable = this.gold >= card.cost;
      const ready = card.cooldownLeft <= 0;
      card.overlay.setVisible(!ready || !affordable);
      card.overlay.height = ready ? TRAY.cardH - 12 : (TRAY.cardH - 12) * (card.cooldownLeft / card.cooldown);
      card.overlay.y = ready ? 0 : -(TRAY.cardH - 12) / 2 + card.overlay.height / 2;
      card.costText.setColor(affordable ? COLORS.gold : COLORS.danger);
    }

    // Spells recharge
    for (const s of this.spells) {
      if (s.cooldownLeft > 0) {
        s.cooldownLeft = Math.max(0, s.cooldownLeft - dt);
        const f = s.cooldownLeft / s.spell.cooldown;
        s.overlay.clear();
        s.overlay.fillStyle(0x0b0713, 0.66);
        s.overlay.slice(0, 0, 64, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f, false);
        s.overlay.fillPath();
        s.ready.setAlpha(0.6);
      } else if (s.ready.alpha !== 1) {
        s.overlay.clear();
        s.ready.setAlpha(1);
      }
    }

    const nearWall = this.enemies.filter((e) => e.alive && e.x < WALL.width + 260).length;
    audio.setTension(tensionFor({ hp: this.wallHp, max: WALL_MAX_HP }, nearWall));
  }

  /* ---------------------------------------------------------------- flow - */

  private openPause(): void {
    if (this.finished) return;
    this.paused = true;
    showDialog(this, {
      title: 'Paused',
      body: `${this.levelDef.name}\nWave ${Math.max(1, this.waveIndex + 1)} of ${this.waves.length}`,
      dismissable: false,
      buttons: [
        { text: 'RESUME', tone: 'green', onClick: () => (this.paused = false) },
        {
          text: 'RETREAT',
          tone: 'red',
          onClick: () => {
            this.paused = false;
            profile.recordDefeat(this.levelDef.id, this.waveIndex + 1);
            this.scene.start('Map');
          },
        },
      ],
    });
  }

  private endBattle(victory: boolean): void {
    if (this.finished) return;
    this.finished = true;
    audio.stopMusic();
    audio.play(victory ? 'victory' : 'defeat');
    profile.addKills(this.killCount);

    const stars = victory ? starsForWall(this.wallHp, WALL_MAX_HP) : 0;
    const wave = this.waveIndex + 1;
    const unlockedBefore = profile.campaignProgress;

    this.time.delayedCall(700, () => {
      this.scene.start('Result', {
        levelId: this.levelDef.id,
        victory,
        stars,
        wave,
        kills: this.killCount,
        wallHp: Math.max(0, Math.round(this.wallHp)),
        wallMax: WALL_MAX_HP,
        reward: this.levelDef.reward,
        levelNo: levelNumber(this.levelDef.id),
        unlockedBefore,
      });
    });
  }
}

/** Exposed for the armoury preview so both screens agree on card contents. */
export const ALL_CARD_IDS = DEFENDERS.map((d) => d.id);
