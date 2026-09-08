/**
 * The battle.
 *
 * Five lanes, a wall on the left, and a horde that walks. The player places
 * defenders from a card tray with Ember, and casts hero spells by tapping the
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
  KEEP,
  TRAY,
  WALL,
  WALL_FACE_X,
  cellCenter,
  colFromX,
  laneCenterY,
  laneGroundY,
  rowFromY,
} from '../core/layout';
import { BIOMES } from '../art/scenery';
import { Atmosphere } from '../battle/atmosphere';
import { Tutorial, type TutorialHost } from '../battle/tutorial';
import { quality } from '../systems/quality';
import { WALL_SKINS } from '../art/structures';
import { DEFENDERS, defender, upgradedStats } from '../data/defenders';
import { enemy as enemyDef } from '../data/enemies';
import { hero as heroDef } from '../data/heroes';
import { CHAPTERS, generateWaves, hashString, level as levelById, levelNumber, type Wave } from '../data/levels';
import type { LevelDef, SpellDef, TileKind } from '../data/types';
import { profile } from '../systems/profile';
import { audio, haptic, type SfxId } from '../systems/audio';
import { COLORS, Counter, TextButton, fitText, floatText, showDialog, tappable, textStyle } from '../ui/kit';
import { showDefenderEntry } from '../ui/ledger';
import { Defender, Enemy, Projectile, type BattleWorld, type ProjectileOptions } from '../battle/entities';
import { portraitFor, portraitForArt } from '../art/portraits';
import { enemyScaling, starsForKeep, tensionFor } from '../battle/combat';
import { EMBER_DEPOSITS_PER_VEIN, emberBounty, emberCost } from '../battle/economy';
import { CONSUMABLES, EQUIPMENT_EFFECT, consumable } from '../data/workshop';
import { TILE_NAME, canStandOn } from '../data/tiles';
import { DOCTRINES, DOCTRINE_EFFECT, type DoctrineId } from '../data/doctrines';
import type { KeepState } from '../battle/combat';

/**
 * A gate section per lane, rather than one wall across the whole field.
 *
 * Sections are worth more together than the old single wall, because an
 * enemy only ever chews on its own lane's - what the player defends now is
 * five separate things, and losing one is a setback rather than the end.
 */
const SECTION_MAX_HP = 420;
const HEART_MAX_HP = 1200;
/** Ember to rebuild a breached section, and the share of it that comes back. */
const REPAIR_COST = 3;
const REPAIR_SHARE = 0.6;
/**
 * Damage a second that the keep's own garrison deals to anything inside it.
 *
 * Without this a breach is a certain loss on a timer: a lane held only by
 * melee has nothing that can reach the courtyard, so whatever got in would
 * hit the heart forever. The garrison makes a breach a race the player can
 * win by killing what came through - or lose by letting more follow.
 */
const GARRISON_DPS = 50;
const PREP_SECONDS = 10;
const MUSTER_SECONDS = 5;

/*
 * The fight runs in phases rather than as one long stream of enemies.
 *
 * A muster is a short, readable lull. It pays nothing: Ember comes from
 * kills and finite veins, so the player stays involved in the battle rather
 * than waiting for a timer to make the correct play.
 *
 * A siege wave brings engines. They batter a section from out of reach,
 * aiming at whichever lane is thinnest, so a siege is a demand to repair
 * and to spread out rather than to stack one killing lane.
 */
const BOMBARD_DAMAGE = 34;
const BOMBARD_EVERY = 5.5;

type Phase = 'muster' | 'assault' | 'siege';

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

/** What a blow against one of ours is worth while sanctuary holds. */
const SANCTUARY_GUARD = 0.5;

export class BattleScene extends Phaser.Scene implements BattleWorld {
  private levelDef!: LevelDef;
  private waves: Wave[] = [];
  private waveIndex = -1;
  private waveTimer = PREP_SECONDS;
  private phase: Phase = 'muster';
  private bombardTimer = 0;
  /** Fort equipment fitted for this battle, and the section HP it buys. */
  private fitted = new Set<string>();
  /** The ground this fort is fought on, row by row. */
  private tiles: TileKind[][] = [];
  /** Deposits belong to the vein, not the Miner standing on it. */
  private readonly seamDeposits = new Map<string, number>();
  private readonly seamLabels = new Map<string, Phaser.GameObjects.Text>();
  /** The rules this fort is fought under. */
  private doctrines = new Set<DoctrineId>();
  private sectionMax = SECTION_MAX_HP;
  private spawnQueue: Array<{ at: number; enemyId: string; row: number; scale?: number }> = [];
  private elapsed = 0;
  private finished = false;

  private gold = 0;
  private sections: number[] = [];
  private heartHp = HEART_MAX_HP;
  private sectionBars: Phaser.GameObjects.Rectangle[] = [];
  private breachMarks: Phaser.GameObjects.Text[] = [];
  private breachHoles: Phaser.GameObjects.Rectangle[] = [];
  private heartBar?: Phaser.GameObjects.Rectangle;
  private heartLabel?: Phaser.GameObjects.Text;
  private killCount = 0;
  private goldSpent = 0;

  readonly enemies: Enemy[] = [];
  readonly defenders: Defender[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly occupancy = new Map<string, Defender>();

  rallyFactor = 1;
  private rallyTimer = 0;
  /** Seconds of sanctuary left: while it holds, our own take less. */
  private guardTimer = 0;
  /** The card Standing Orders has taken for this fort, if any. */
  private spokenFor?: string;
  chapter = 1;

  private selectedCard?: string;
  private selectedSpell?: SpellDef;
  private cards: CardView[] = [];
  private spells: SpellView[] = [];
  private ghost?: Phaser.GameObjects.Container;
  private cellMarker!: Phaser.GameObjects.Image;
  private laneGlow!: Phaser.GameObjects.Rectangle;
  private atmosphere?: Atmosphere;

  private goldCounter!: Counter;
  private waveText!: Phaser.GameObjects.Text;
  private phaseText!: Phaser.GameObjects.Text;
  private callButton?: TextButton;
  private itemButton?: TextButton;


  private paused = false;
  private skipBriefing = false;
  private tutorial?: Tutorial;
  /** The tutorial holds the first wave until the player has built something. */
  private wavesHeld = false;

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
      spawn: (id: string, row: number, x?: number): void => this.spawnEnemy(id, row, x ?? SPAWN_X),
      nextWave: (): void => this.startWave(),
      // Jumps to the final wave so the victory path can be exercised.
      endWaves: (): void => {
        this.waveIndex = this.waves.length - 1;
        this.spawnQueue.length = 0;
        this.updateHud();
      },
      // Knocks a lane's section out so the breach path can be exercised
      // without waiting for enemies to chew through it.
      breach: (row: number): void => {
        this.sections[row] = 0;
        this.onBreach(row);
        this.updateHud();
      },
      repair: (row: number): void => this.repairSection(row),
      // Burns a piece of workshop stock, the same as the item button does.
      useItem: (id: string): boolean => {
        const held = profile.stockOf(id);
        this.useItem(id);
        return profile.stockOf(id) < held;
      },
      // Sends a placed unit out of the gate, or calls it back.
      sortie: (row: number, col: number): string => {
        const d = this.occupancy.get(`${row},${col}`);
        if (!d) return 'none';
        if (d.sortie === 'held') return d.goOut() ? 'out' : 'refused';
        return d.recall() ? 'returning' : d.sortie;
      },
      addGold: (n: number): void => {
        this.gold += n;
        this.updateHud();
      },
      addEmber: (n: number): void => {
        this.gold += n;
        this.updateHud();
      },
      // Calls the assault on early, the same as the button does.
      call: (): number => this.callAssault(),
      /*
       * Kills what is on the field. An enemy has no public way to be killed
       * outright - it dies by taking damage - so a test that wants a quiet
       * field asks the battle for one rather than reaching into entities.
       */
      clearField: (keepBeyond = 0): number => {
        let killed = 0;
        for (const e of this.enemies) {
          if (!e.alive || e.x > keepBeyond) continue;
          e.takeDamage(e.hp + 1, true);
          killed += 1;
        }
        return killed;
      },
      // What the hordes are actually doing, for the family driver.
      enemyState: (): Array<Record<string, unknown>> =>
        this.enemies.map((e) => ({
          id: e.def.id,
          alive: e.alive,
          x: Math.round(e.x),
          row: e.row,
          hp: Math.round(e.hp),
          maxHp: e.maxHp,
          shield: e.shield,
          blow: e.blow,
        })),
      hurt: (index: number, amount: number, type = 'physical', breakShield = false): void => {
        this.enemies[index]?.takeDamage(amount, false, type as never, breakShield);
      },
      state: () => ({
        gold: Math.round(this.gold),
        ember: Math.round(this.gold),
        phase: this.phase,
        musterLeft: Math.max(0, Math.round(this.waveTimer)),
        wallHp: Math.round(this.sections.reduce((a, b) => a + b, 0)),
        heartHp: Math.round(this.heartHp),
        breached: this.sections.filter((hp) => hp <= 0).length,
        sections: this.sections.map((hp) => Math.round(hp)),
        wave: this.waveIndex + 1,
        waves: this.waves.length,
        enemies: this.enemies.filter((e) => e.alive).length,
        defenders: this.defenders.filter((d) => d.alive).length,
        defenderDump: this.defenders
          .filter((d) => d.alive)
          .map((d) => ({ id: d.def.id, row: d.row, x: Math.round(d.x), home: Math.round(d.homeX), sortie: d.sortie })),
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
    this.phase = 'muster';
    this.bombardTimer = 0;
    this.spawnQueue = [];
    this.elapsed = 0;
    this.finished = false;
    /*
     * Fort equipment is chosen in the workshop and fitted here, before a
     * single enemy exists: what the player brought decides how much wall
     * they have and how much gold they start with, not anything they do
     * once the fighting starts.
     */
    this.fitted = new Set(profile.equipped);
    this.tiles = this.levelDef.modifiers?.tiles ?? [];
    this.seamDeposits.clear();
    this.seamLabels.clear();
    for (let row = 0; row < GRID.rows; row += 1) {
      for (let col = 0; col < GRID.cols; col += 1) {
        if (this.tileAt(row, col) === 'seam') {
          this.seamDeposits.set(`${row},${col}`, EMBER_DEPOSITS_PER_VEIN);
        }
      }
    }
    this.doctrines = new Set(this.levelDef.modifiers?.doctrines ?? []);
    this.sectionMax = Math.round(
      SECTION_MAX_HP * (this.fitted.has('reinforced') ? EQUIPMENT_EFFECT.reinforced.sectionHp : 1),
    );
    this.gold =
      emberCost(this.levelDef.startingGold) +
      (this.fitted.has('cellars') ? emberCost(EQUIPMENT_EFFECT.cellars.startingGold) : 0);
    this.sections = new Array(GRID.rows).fill(this.sectionMax);
    // A breached gate is the fort's opening position, not something that
    // happens to it: the player picks their deck already knowing.
    if (this.doctrines.has('breached')) this.sections[Math.floor(GRID.rows / 2)] = 0;
    this.heartHp = HEART_MAX_HP;
    this.killCount = 0;
    this.goldSpent = 0;
    this.rallyFactor = 1;
    this.rallyTimer = 0;
    this.guardTimer = 0;
    this.enemies.length = 0;
    this.defenders.length = 0;
    this.projectiles.length = 0;
    this.occupancy.clear();
    this.selectedCard = undefined;
    this.selectedSpell = undefined;
    this.cards = [];
    this.spells = [];
    this.paused = false;
    this.tutorial = undefined;
    this.wavesHeld = false;
    this.callButton = undefined;
  }

  create(): void {
    this.buildField();
    this.buildHud();
    this.buildTray();
    this.buildHeroBar();
    this.bindInput();

    audio.startMusic();
    audio.setTension(0);

    if (!this.skipBriefing) {
      // Two rules need more panel than one: a briefing the player has to
      // read around the button is not a briefing.
      this.announce(this.levelDef.name, this.briefingText(), 460 + this.doctrines.size * 170);
    }
    if (this.levelDef.id === 'c1l1' && !profile.raw.tutorialDone) this.startTutorial();
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
      this.atmosphere?.destroy();
      this.atmosphere = undefined;
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
      .image(WALL.width * 0.55, FIELD.y + FIELD.height / 2, `gate.${skin.id}`)
      .setOrigin(0.5, 0.5)
      .setDisplaySize(WALL.gateWidth, FIELD.height * 0.42)
      .setDepth(2002);

    this.drawGround();
    this.buildSections();
    this.buildHeart();

    this.cellMarker = this.add
      .image(0, 0, 'ui.cell')
      .setDisplaySize(GRID.cellW, GRID.cellH)
      .setVisible(false)
      .setDepth(2500);

    // A soft band under the row being aimed at, so placement reads at a glance.
    this.laneGlow = this.add
      .rectangle(DESIGN.width / 2, 0, DESIGN.width - WALL.width, GRID.cellH, 0xffe9a8, 0.1)
      .setVisible(false)
      .setDepth(1500);

    this.atmosphere = new Atmosphere(this, biome, { intensity: quality.effects });
  }

  /* ----------------------------------------------------------------- hud - */

  private buildHud(): void {
    this.add.rectangle(DESIGN.width / 2, HUD.height / 2, DESIGN.width, HUD.height, 0x1b1626, 0.94).setDepth(3000);

    this.goldCounter = new Counter(this, 40, HUD.height / 2, 'fx.ember', this.gold);
    this.goldCounter.setDepth(3001);

    this.waveText = this.add
      .text(300, HUD.height / 2 - 14, '', textStyle('small', COLORS.parchment))
      .setOrigin(0, 0.5)
      .setDepth(3001);
    this.phaseText = this.add
      .text(300, HUD.height / 2 + 20, '', textStyle('tiny', COLORS.muted))
      .setOrigin(0, 0.5)
      .setDepth(3001);

    /*
     * What the player made in the workshop. It is one button rather than a
     * row of them because the tray is already full, and because a one-use
     * item is worth a second's thought before it is burned.
     */
    this.itemButton = new TextButton(this, 1222, HUD.height / 2, '', {
      width: 108,
      height: 66,
      size: 'tiny',
      tone: 'blue',
      icon: 'icon.hammer',
      onClick: () => this.openItems(),
    });
    this.itemButton.setDepth(3002);
    this.refreshItems();

    // Right of the keep bar and clear of it: the HUD centre belongs to the
    // heart, and a button over it would hide the one number that matters.
    this.callButton = new TextButton(this, DESIGN.width - 480, HUD.height / 2, 'START NOW', {
      width: 320,
      height: 66,
      size: 'tiny',
      tone: 'gold',
      onClick: () => this.callAssault(),
    });
    this.callButton.setDepth(3002).setVisible(false);

    /*
     * The heart of the keep sits centre-top, because it is now the one number
     * that decides the run. The wall is read on the wall itself, lane by lane,
     * where the damage is actually happening.
     */
    const barW = 400;
    this.add
      .rectangle(DESIGN.width / 2, HUD.height / 2, barW, 38, 0x2a2338)
      .setStrokeStyle(4, 0x0f0c1a)
      .setDepth(3001);
    this.heartBar = this.add
      .rectangle(DESIGN.width / 2 - barW / 2 + 2, HUD.height / 2, barW - 4, 32, 0x5fd07a)
      .setOrigin(0, 0.5)
      .setDepth(3002);
    this.heartLabel = this.add
      .text(DESIGN.width / 2, HUD.height / 2, 'KEEP', textStyle('tiny', COLORS.ink, { strokeThickness: 0 }))
      .setOrigin(0.5)
      .setDepth(3003);

    new TextButton(this, DESIGN.width - 72, HUD.height / 2, '||', {
      width: 96,
      height: 74,
      tone: 'stone',
      onClick: () => this.openPause(),
    }).setDepth(3002);

    this.updateHud();
  }

  /* ------------------------------------------------------------ the wall - */

  /**
   * One bar per lane, drawn on the wall itself.
   *
   * The player needs to see which lane is losing, not a single number that
   * averages five separate fights into one. Tapping a breached section
   * rebuilds it, so the bars are the repair control too.
   */
  /**
   * Paints the ground the fort is fought on.
   *
   * A cell has to say what it is before the player commits a card to it, so
   * each kind is drawn as itself - rock as rock, water as water, grass as
   * grass - rather than as a coloured square with a legend somewhere else.
   */
  private drawGround(): void {
    if (!this.tiles.length) return;
    const g = this.add.graphics().setDepth(-900);
    const detail = this.add.graphics().setDepth(-880);

    for (let row = 0; row < GRID.rows; row += 1) {
      for (let col = 0; col < GRID.cols; col += 1) {
        const kind = this.tileAt(row, col);
        if (kind === 'plain') continue;
        const c = cellCenter(row, col);
        const w = GRID.cellW;
        const h = GRID.cellH;
        const x = c.x - w / 2;
        const y = c.y - h / 2;

        if (kind === 'water') {
          g.fillStyle(0x2f6a84, 0.72);
          g.fillRect(x, y, w, h);
          detail.lineStyle(3, 0x7fd0e8, 0.5);
          for (let i = 0; i < 3; i += 1) {
            const yy = y + h * (0.3 + i * 0.22);
            detail.beginPath();
            detail.moveTo(x + 12, yy);
            for (let k = 0; k <= 6; k += 1) {
              detail.lineTo(x + 12 + (k * (w - 24)) / 6, yy + Math.sin(k * 1.3 + row + i) * 4);
            }
            detail.strokePath();
          }
        } else if (kind === 'marsh') {
          g.fillStyle(0x3f5240, 0.6);
          g.fillRect(x, y, w, h);
          detail.fillStyle(0x6f8a5a, 0.5);
          for (let i = 0; i < 5; i += 1) {
            detail.fillCircle(x + 20 + ((i * 37) % (w - 40)), y + 30 + ((i * 53) % (h - 50)), 9);
          }
        } else if (kind === 'highground') {
          g.fillStyle(0x6a6152, 0.85);
          g.fillRect(x, y, w, h);
          detail.fillStyle(0x8b8272, 1);
          detail.fillTriangle(c.x - 46, y + h - 16, c.x - 8, y + 22, c.x + 30, y + h - 16);
          detail.fillStyle(0xa39a88, 1);
          detail.fillTriangle(c.x + 4, y + h - 16, c.x + 34, y + 40, c.x + 62, y + h - 16);
        } else if (kind === 'rubble') {
          g.fillStyle(0x4a4038, 0.7);
          g.fillRect(x, y, w, h);
          detail.fillStyle(0x6f6355, 1);
          for (let i = 0; i < 6; i += 1) {
            const rx = x + 18 + ((i * 41) % (w - 36));
            const ry = y + 34 + ((i * 61) % (h - 60));
            detail.fillRect(rx, ry, 18 + (i % 3) * 6, 12 + (i % 2) * 5);
          }
        } else if (kind === 'tallgrass') {
          g.fillStyle(0x4f7a3c, 0.42);
          g.fillRect(x, y, w, h);
          detail.lineStyle(4, 0x76a84a, 0.75);
          for (let i = 0; i < 7; i += 1) {
            const bx = x + 16 + ((i * 29) % (w - 30));
            const by = y + h - 18 - ((i * 17) % 22);
            detail.beginPath();
            detail.moveTo(bx, by);
            detail.lineTo(bx + (i % 2 ? 8 : -8), by - 34);
            detail.strokePath();
          }
        } else if (kind === 'shrine') {
          g.fillStyle(0x5a5470, 0.55);
          g.fillRect(x, y, w, h);
          detail.lineStyle(5, 0xf5c542, 0.75);
          detail.strokeCircle(c.x, c.y, 34);
          detail.lineStyle(4, 0xffe9a8, 0.65);
          detail.strokeCircle(c.x, c.y, 18);
        } else if (kind === 'seam') {
          g.fillStyle(0x3b2d42, 0.76);
          g.fillRect(x, y, w, h);
          detail.fillStyle(0xff8a3d, 0.95);
          for (let i = 0; i < 4; i += 1) {
            const cx = c.x - 34 + i * 22;
            const cy = c.y + Math.sin(i * 2) * 14;
            detail.fillTriangle(cx - 8, cy + 10, cx, cy - 16, cx + 8, cy + 10);
          }
          const key = `${row},${col}`;
          const label = this.add
            .text(c.x + w / 2 - 18, c.y - h / 2 + 16, String(EMBER_DEPOSITS_PER_VEIN), textStyle('tiny', '#fff0d0'))
            .setOrigin(0.5)
            .setDepth(-870);
          this.seamLabels.set(key, label);
        }
      }
    }
  }

  private buildSections(): void {
    this.sectionBars = [];
    this.breachMarks = [];
    for (let row = 0; row < GRID.rows; row += 1) {
      const y = laneCenterY(row);
      const h = GRID.cellH * 0.5;
      this.add
        .rectangle(WALL_FACE_X - 15, y, 22, h, 0x1a1526, 0.85)
        .setStrokeStyle(3, 0x0f0c1a)
        .setDepth(2100);
      const bar = this.add
        .rectangle(WALL_FACE_X - 15, y + h / 2 - 2, 16, h - 4, 0x5fd07a)
        .setOrigin(0.5, 1)
        .setDepth(2101);
      this.sectionBars.push(bar);

      /*
       * A hole punched through the wall art. Without it a fallen section
       * looks exactly like a standing one and enemies simply walk through
       * solid stone, which reads as a bug rather than a breach.
       */
      const hole = this.add
        .rectangle(WALL.width / 2, y, WALL.width, GRID.cellH * 0.78, 0x0b0713)
        .setDepth(2010)
        .setVisible(false);
      this.breachHoles.push(hole);

      const mark = this.add
        .text(WALL_FACE_X - 15, y, 'REBUILD', textStyle('tiny', COLORS.gold))
        .setOrigin(0.5)
        .setDepth(2102)
        .setVisible(false);
      mark.setAngle(-90);
      this.breachMarks.push(mark);

      // The whole section strip is the repair button, so it is easy to hit.
      const hit = this.add
        .rectangle(WALL_FACE_X - 15, y, 64, h, 0xffffff, 0)
        .setDepth(2103);
      tappable(hit as unknown as Phaser.GameObjects.Container, 64, h);
      hit.on('pointerdown', () => this.repairSection(row));
    }
  }

  /**
   * The heart of the keep, standing in the courtyard behind the wall.
   *
   * It has to be visible even when nothing has broken through, so the player
   * understands what a breach threatens before one happens.
   */
  private buildHeart(): void {
    const y = FIELD.y + FIELD.height / 2;
    this.add.image(KEEP.x, y, 'fx.glow')
      .setDisplaySize(KEEP.radius * 4, KEEP.radius * 4)
      .setTint(0xf0b429)
      .setAlpha(0.35)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(2050);
    const core = this.add.image(KEEP.x, y, 'icon.crown')
      .setDisplaySize(KEEP.radius * 1.6, KEEP.radius * 1.6)
      .setDepth(2051);
    // A slow pulse, so it reads as something alive that is worth protecting.
    this.tweens.add({
      targets: core,
      scaleX: core.scaleX * 1.1,
      scaleY: core.scaleY * 1.1,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  private updateSections(): void {
    for (let row = 0; row < this.sectionBars.length; row += 1) {
      const hp = this.sections[row] ?? 0;
      const f = Math.max(0, hp / this.sectionMax);
      const bar = this.sectionBars[row]!;
      const full = GRID.cellH * 0.5 - 4;
      bar.height = Math.max(0, full * f);
      bar.fillColor = f > 0.55 ? 0x5fd07a : f > 0.25 ? 0xf0b429 : 0xe8455c;
      bar.setVisible(hp > 0);
      this.breachHoles[row]?.setVisible(hp <= 0);
      this.breachMarks[row]?.setVisible(hp <= 0 && !this.finished);
    }
  }

  /** How the keep is doing, for scoring and for the results screen. */
  private keepState(): KeepState {
    return {
      sections: [...this.sections],
      sectionMax: this.sectionMax,
      heartHp: this.heartHp,
      heartMax: HEART_MAX_HP,
    };
  }

  /** The keep's last defenders, cutting at whatever came through a breach. */
  private garrisonFire(dt: number): void {
    for (const e of this.enemies) {
      if (!e.alive || !e.inside) continue;
      const dps = GARRISON_DPS * (this.fitted.has('garrison') ? EQUIPMENT_EFFECT.garrison.garrisonDps : 1);
      e.takeDamage(dps * dt, true);
    }
  }

  /**
   * True while a consecrating unit is alive in this lane.
   *
   * Holy ground is what stops the dead getting back up, so it is a property
   * of the lane rather than of the blow that killed them - which is what
   * makes a runesmith worth a slot next to something that only kills.
   */
  isConsecrated(row: number): boolean {
    return this.defenders.some((d) => d.alive && d.row === row && d.def.trait === 'consecrate');
  }

  /** True while a ward is alive in this lane, holding portals shut. */
  isWarded(row: number): boolean {
    return this.defenders.some((d) => d.alive && d.row === row && d.def.trait === 'ward');
  }

  /** A thief takes Ember out of the battle purse; it cannot take what is not there. */
  stealGold(amount: number, x: number, y: number): void {
    if (this.finished || this.gold <= 0) return;
    const taken = Math.min(this.gold, amount);
    this.gold -= taken;
    audio.play('deny');
    floatText(this, x, y - 30, `-${taken}`, COLORS.danger, 'tiny');
    this.updateHud();
  }

  /** The ground in one cell of this fort. */
  tileAt(row: number, col: number): TileKind {
    return this.tiles[row]?.[col] ?? 'plain';
  }

  /** The ground under a point on the field, for anything that walks it. */
  tileUnder(row: number, x: number): TileKind {
    return this.tileAt(row, colFromX(x));
  }

  isBreached(row: number): boolean {
    return (this.sections[row] ?? 0) <= 0;
  }

  /** Rebuilds a fallen section, for Ember. The one way back from a breach. */
  private repairSection(row: number): void {
    if (this.finished || !this.isBreached(row)) return;
    if (this.gold < REPAIR_COST) {
      audio.play('deny');
      floatText(this, WALL.width + 40, laneCenterY(row), 'NOT ENOUGH EMBER', COLORS.danger, 'small');
      return;
    }
    this.gold -= REPAIR_COST;
    this.sections[row] = this.sectionMax * REPAIR_SHARE;
    audio.play('place');
    haptic(20);
    floatText(this, WALL.width + 40, laneCenterY(row), 'REBUILT', COLORS.good, 'small');
    this.updateHud();
  }

  damageHeart(amount: number): void {
    if (this.finished) return;
    this.heartHp -= amount;
    this.cameras.main.flash(140, 160, 20, 40);
    this.shake(9);
    this.updateHud();
    if (this.heartHp <= 0) this.endBattle(false);
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
    this.updatePhaseHud();
    const f = Math.max(0, this.heartHp / HEART_MAX_HP);
    if (this.heartBar) {
      this.heartBar.width = 396 * f;
      this.heartBar.fillColor = f > 0.55 ? 0x5fd07a : f > 0.25 ? 0xf0b429 : 0xe8455c;
    }
    this.heartLabel?.setText(`KEEP ${Math.max(0, Math.ceil(this.heartHp))}`);
    this.updateSections();
  }

  /* ---------------------------------------------------------------- tray - */

  private deckForLevel(): string[] {
    const mods = this.levelDef.modifiers;
    if (mods?.fixedDeck) return mods.fixedDeck;
    let deck = profile.effectiveDeck();
    if (mods?.bannedCards) deck = deck.filter((id) => !mods.bannedCards!.includes(id));
    /*
     * Standing Orders. The rule cannot be written into the level, because the
     * level is generated before anyone has a deck: which card is spoken for
     * only means anything once we know what the player brought. Picked from
     * the fort's own id, so it is the same card for the same player at the
     * same fort every time, and never the last two - a rule that leaves
     * someone with one card is not a rule, it is a loss.
     */
    if (this.under('standingorders') && deck.length > 2) {
      const spokenFor = deck[hashString(`${this.levelDef.id}:${deck.join(',')}`) % deck.length]!;
      this.spokenFor = spokenFor;
      deck = deck.filter((id) => id !== spokenFor);
    }
    return deck;
  }

  private buildTray(): void {
    const deck = this.deckForLevel();
    this.add.rectangle(DESIGN.width / 2, TRAY.y + TRAY.height / 2, DESIGN.width, TRAY.height, 0x221c33, 0.92).setDepth(3000);

    deck.forEach((id, i) => {
      const def = defender(id);
      const x = TRAY.x0 + TRAY.cardW / 2 + i * (TRAY.cardW + TRAY.gap);
      const y = TRAY.y + TRAY.height / 2;
      const container = this.add.container(x, y).setDepth(3001);

      const frame = this.add.image(0, 0, 'ui.card').setDisplaySize(TRAY.cardW, TRAY.cardH);
      container.add(frame);

      const art = this.cardArt(id, 0, -10, 0.27);
      container.add(art);

      // The price this fort actually charges. Thin Supply puts every card up
      // a quarter, and a tray showing the ledger price instead of the one it
      // will take is the rule lying to the player.
      const costText = this.add
        .text(10, TRAY.cardH / 2 - 20, String(this.priceOf(def.cost)), textStyle('tiny', COLORS.gold))
        .setOrigin(0.5);
      container.add(costText);
      container.add(this.add.image(-20, TRAY.cardH / 2 - 20, 'fx.ember').setDisplaySize(24, 24));

      const overlay = this.add
        .rectangle(0, 0, TRAY.cardW - 10, TRAY.cardH - 10, 0x0b0713, 0.62)
        .setOrigin(0.5)
        .setVisible(false);
      container.add(overlay);

      tappable(container, TRAY.cardW, TRAY.cardH);
      /*
       * Tap selects; hold reads. Damage types are only a decision the player
       * can make if they can look up what this card actually does, and
       * mid-battle is exactly when they want to.
       */
      let held: Phaser.Time.TimerEvent | undefined;
      container.on('pointerdown', () => {
        held = this.time.delayedCall(420, () => {
          held = undefined;
          this.paused = true;
          showDefenderEntry(this, defender(id), () => {
            this.paused = false;
          });
        });
      });
      const release = (): void => {
        if (!held) return;
        held.remove();
        held = undefined;
        this.selectCard(id);
      };
      container.on('pointerup', release);
      container.on('pointerout', () => {
        held?.remove();
        held = undefined;
      });

      this.cards.push({
        id,
        container,
        cost: def.cost,
        cooldown: def.recharge * (this.fitted.has('horn') ? EQUIPMENT_EFFECT.horn.cardRecharge : 1),
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
    // A head-and-shoulders portrait reads better at card size than a full
    // body squeezed into 150px; structures show the whole building.
    const portrait = portraitFor(this, def);
    if (portrait) {
      const img = this.add.image(0, portrait.whole ? 46 : 8, portrait.key, portrait.frame);
      if (portrait.whole) {
        img.setOrigin(0.5, 1);
        img.setScale(Math.min((scale * 150) / img.width, (scale * 150) / img.height));
      } else {
        img.setScale(scale * 1.25);
      }
      c.add(img);
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
    this.tutorial?.noteCardSelected(id);
    this.refreshCardHighlight();
    this.buildGhost();
  }

  private clearSelection(): void {
    this.selectedCard = undefined;
    this.selectedSpell = undefined;
    this.ghost?.destroy();
    this.ghost = undefined;
    this.cellMarker.setVisible(false);
    this.laneGlow.setVisible(false);
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
    if (!this.selectedCard || this.selectedCard === '__sell__' || this.selectedCard === '__sortie__') return;
    this.ghost = this.cardArt(this.selectedCard, -500, -500, 1);
    this.ghost.setAlpha(0.65).setDepth(2600);
  }

  /** Who commands in this level's region. */
  private commanderId(): string {
    return CHAPTERS.find((c) => c.id === this.levelDef.chapter)?.commander ?? profile.heroId;
  }

  /* ----------------------------------------------------------- hero bar - */

  private buildHeroBar(): void {
    /*
     * The commander of the region being fought over, not a hero picked once in
     * a menu. Crossing a border changes the two spells in the player's hand,
     * which is the point of regions existing at all.
     */
    const hero = heroDef(this.commanderId());
    const y = HERO_BAR.y + HERO_BAR.height / 2;

    /*
     * The two tools stack in the narrow gap between the last card and the
     * commander. Side by side they ran over both.
     */
    const toolX = HERO_BAR.x - 110;
    new TextButton(this, toolX, y - 36, 'SELL', {
      width: 160,
      height: 64,
      tone: 'red',
      size: 'small',
      onClick: () => this.selectCard('__sell__'),
    }).setDepth(3001);
    new TextButton(this, toolX, y + 36, 'SORTIE', {
      width: 160,
      height: 64,
      tone: 'blue',
      size: 'small',
      onClick: () => this.selectCard('__sortie__'),
    }).setDepth(3001);

    // Commanders may wear a unit's drawn frames, which have no head crop, so
    // this takes whatever image the art actually provides.
    const face = portraitForArt(this, hero.art);
    if (face) {
      const img = this.add.image(HERO_BAR.x + 40, y, face.key).setDepth(3001);
      img.setScale(Math.min(64 / img.width, 64 / img.height));
    }
    this.add
      .text(HERO_BAR.x + 100, y - 20, hero.name, textStyle('small', COLORS.gold))
      .setOrigin(0, 0.5)
      .setDepth(3001);
    // The spell buttons start at the right edge, so the title is squeezed
    // down to fit rather than sliding under them.
    fitText(
      this.add
        .text(HERO_BAR.x + 100, y + 18, hero.title, textStyle('tiny', COLORS.muted))
        .setOrigin(0, 0.5)
        .setDepth(3001),
      DESIGN.width - 330 - (HERO_BAR.x + 100),
    );

    hero.spells.forEach((spell, i) => {
      const x = DESIGN.width - 250 + i * 150;
      // Label above the button: below it would fall off the bottom edge.
      fitText(
        this.add.text(x, TRAY.y + 20, spell.name, textStyle('tiny', COLORS.muted)).setOrigin(0.5).setDepth(3001),
        138,
      );
      const container = this.add.container(x, TRAY.y + TRAY.height / 2 + 14).setDepth(3001);
      const ring = this.add.image(0, 0, 'ui.button.blue').setDisplaySize(112, 100);
      container.add(ring);
      const icon = this.add.image(0, 0, spell.icon).setDisplaySize(66, 66);
      container.add(icon);
      const overlay = this.add.graphics();
      container.add(overlay);
      tappable(container, 112, 100);
      container.on('pointerdown', () => this.selectSpell(spell));
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
      /*
       * Sanctuary. This case did not exist: the spell was declared with an
       * effect the battle had no branch for, so the one hero card the player
       * carries into the last region fell through to `default` and did
       * nothing at all while its blurb promised a heal and a shield.
       */
      case 'heal': {
        this.sfx('upgrade');
        this.guardTimer = spell.duration ?? 4;
        for (const d of this.defenders) {
          if (!d.alive) continue;
          d.heal(spell.damage ?? 260);
        }
        const halo = this.add.image(DESIGN.width / 2, laneCenterY(2), 'fx.holy_ring').setDepth(4000).setScale(0.4);
        this.tweens.add({ targets: halo, scale: 9, alpha: 0, duration: 800, onComplete: () => halo.destroy() });
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
      this.laneGlow.setVisible(false);
      this.ghost?.setVisible(false);
      return;
    }
    if (!this.selectedCard || this.selectedCard === '__sell__' || this.selectedCard === '__sortie__') {
      this.cellMarker.setVisible(false);
      this.laneGlow.setVisible(false);
      return;
    }
    const row = rowFromY(y);
    const col = colFromX(x);
    const valid = this.canPlaceAt(row, col);
    if (row < 0 || row >= GRID.rows || col < 0 || col >= GRID.cols) {
      this.cellMarker.setVisible(false);
      this.laneGlow.setVisible(false);
      this.ghost?.setVisible(false);
      return;
    }
    const c = cellCenter(row, col);
    this.cellMarker.setPosition(c.x, c.y).setVisible(true).setTint(valid ? 0xffffff : 0xff6b6b);
    this.laneGlow
      .setPosition(WALL.width + (DESIGN.width - WALL.width) / 2, laneCenterY(row))
      .setVisible(true);
    this.ghost?.setVisible(true).setPosition(c.x, laneGroundY(row));
  }

  private canPlaceAt(row: number, col: number, cardId = this.selectedCard): boolean {
    if (row < 0 || row >= GRID.rows || col < 0 || col >= GRID.cols) return false;
    if (this.occupancy.has(`${row},${col}`)) return false;
    const blocked = this.levelDef.modifiers?.blockedCells;
    if (blocked?.some(([r, c]) => r === row && c === col)) return false;
    // Rock and rubble take nothing at all; water takes only what floats.
    const def = cardId && cardId !== '__sell__' && cardId !== '__sortie__' ? defender(cardId) : undefined;
    if (def?.economy?.requiresSeam && this.tileAt(row, col) !== 'seam') return false;
    return canStandOn(this.tileAt(row, col), Boolean(def?.aquatic));
  }

  private onFieldTap(x: number, y: number): void {
    if (this.selectedSpell) {
      this.castSpell(this.selectedSpell, x, y);
      return;
    }
    const row = rowFromY(y);
    const col = colFromX(x);

    if (this.selectedCard === '__sell__') {
      if (!this.canGiveGround()) {
        audio.play('deny');
        floatText(this, x, y - 40, 'no ground given here', COLORS.muted, 'tiny');
        return;
      }
      const target = this.occupancy.get(`${row},${col}`);
      if (target) {
        const refund = Math.max(1, Math.round(this.priceOf(target.def.cost) * 0.5));
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

    if (this.selectedCard === '__sortie__') {
      this.toggleSortie(row, col, x, y);
      return;
    }

    if (!this.selectedCard) return;
    const card = this.cards.find((c) => c.id === this.selectedCard);
    if (!card) return;

    if (!this.canPlaceAt(row, col)) {
      audio.play('deny');
      // Say why. A card refused with no reason reads as a broken button.
      const kind = this.tileAt(row, col);
      const chosen = defender(card.id);
      if (chosen.economy?.requiresSeam && kind !== 'seam') {
        floatText(this, x, y - 40, 'miners need an Ember vein', COLORS.muted, 'tiny');
      } else if (!canStandOn(kind, Boolean(chosen.aquatic))) {
        floatText(this, x, y - 40, `cannot build on ${TILE_NAME[kind]}`, COLORS.muted, 'tiny');
      }
      return;
    }
    if (card.cooldownLeft > 0) {
      audio.play('deny');
      floatText(this, x, y - 40, 'recharging', COLORS.muted, 'tiny');
      return;
    }
    if (this.gold < this.priceOf(card.cost)) {
      audio.play('deny');
      floatText(this, x, y - 40, 'not enough Ember', COLORS.danger, 'tiny');
      return;
    }

    this.placeDefender(this.selectedCard, row, col);
    card.cooldownLeft = card.cooldown;
    this.gold -= this.priceOf(card.cost);
    this.goldSpent += this.priceOf(card.cost);
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
    const row = Math.max(0, Math.min(GRID.rows - 1, rowFromY(atY)));
    const before = this.sections[row] ?? 0;
    if (before <= 0) return;
    this.sections[row] = Math.max(0, before - amount * this.wallDamageFactor());
    /*
     * Boiling oil answers whoever is swinging at the gate. It is poured on
     * the swing rather than on a timer, so it only ever hits what is
     * actually at the wall.
     */
    if (this.fitted.has('oil')) {
      const y = laneCenterY(row);
      for (const e of this.enemies) {
        if (!e.alive || e.row !== row || !e.atWall) continue;
        e.takeDamage(EQUIPMENT_EFFECT.oil.gateBurn, true, 'fire');
      }
      this.burst(WALL.width + 20, y - 40, 'explosion');
    }
    floatText(this, WALL.width + 20, atY - 80, `-${Math.round(amount)}`, COLORS.danger, 'small');
    this.cameras.main.flash(90, 120, 20, 30);
    // A breach is loud. It is the moment the battle changes shape, and the
    // player has to notice it happening in a lane they may not be watching.
    if (this.sections[row] === 0) this.onBreach(row);
    this.updateHud();
  }

  /**
   * Patch a section that is still standing. A fallen one is not mended - it
   * is rebuilt, and rebuilding costs Ember or a repair kit.
   */
  mendWall(row: number, amount: number): void {
    if (this.finished) return;
    const hp = this.sections[row] ?? 0;
    if (hp <= 0 || hp >= this.sectionMax) return;
    this.sections[row] = Math.min(this.sectionMax, hp + amount);
    floatText(this, WALL.width + 20, laneCenterY(row) - 40, `+${Math.round(amount)}`, COLORS.good, 'tiny');
    this.updateHud();
  }

  /** A section has fallen: the lane is open and the keep is exposed. */
  private onBreach(row: number): void {
    audio.play('explode');
    haptic(40);
    this.shake(16);
    this.cameras.main.flash(220, 200, 40, 40);
    floatText(this, WALL.width + 60, laneCenterY(row), 'BREACH!', COLORS.danger, 'title');
  }

  awardGold(amount: number, x: number, y: number): void {
    this.gold += amount;
    audio.play('coin');
    const coin = this.add.image(x, y, 'fx.ember').setDepth(5000).setScale(0.7);
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
    floatText(this, x, y - 20, `+${amount} EMBER`, COLORS.gold, 'tiny');
  }

  /** Takes one finite deposit from the vein under a Miner. */
  mineEmber(row: number, col: number, amount: number, x: number, y: number): boolean {
    const key = `${row},${col}`;
    const remaining = this.seamDeposits.get(key) ?? 0;
    if (remaining <= 0) return false;
    const next = remaining - 1;
    this.seamDeposits.set(key, next);
    this.seamLabels.get(key)?.setText(String(next)).setVisible(next > 0);
    this.awardGold(amount, x, y);
    floatText(
      this,
      x,
      y + 22,
      next > 0 ? `VEIN ${next}/${EMBER_DEPOSITS_PER_VEIN}` : 'VEIN EMPTY',
      COLORS.muted,
      'tiny',
    );
    return true;
  }

  onEnemyKilled(e: Enemy): void {
    this.killCount += 1;
    if (this.under('noquarter')) return;
    const bounty = emberBounty(e.def.bounty);
    this.gold += bounty;
    floatText(this, e.x, e.y - 100, `+${bounty} EMBER`, COLORS.gold, 'tiny');
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
    const count = Math.max(2, Math.round(c.count * quality.particleScale));
    for (let i = 0; i < count; i += 1) {
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

  /** True when this fort is fought under the named rule. */
  under(id: DoctrineId): boolean {
    return this.doctrines.has(id);
  }

  /** What a card costs here. Thin supply puts the price up. */
  private priceOf(cost: number): number {
    const base = emberCost(cost);
    return this.under('thinsupply') ? Math.ceil(base * DOCTRINE_EFFECT.thinSupplyCost) : base;
  }

  /** How far a defender can see. The night takes a quarter of it. */
  /** Sanctuary blunts what lands on our own while it holds. */
  guardFactor(): number {
    return this.guardTimer > 0 ? SANCTUARY_GUARD : 1;
  }

  rangeFactor(): number {
    return this.under('night') ? DOCTRINE_EFFECT.nightRange : 1;
  }

  /** What a gate section takes from a blow. Sappers came for the gate. */
  wallDamageFactor(): number {
    return this.under('sappers') ? DOCTRINE_EFFECT.sapperWallDamage : 1;
  }

  /** Whether a unit may be sold or sent out. Not under standing orders. */
  canGiveGround(): boolean {
    return !this.under('holdtheline');
  }

  /** How much stock the player is carrying, all kinds together. */
  private itemsHeld(): number {
    return CONSUMABLES.reduce((n, c) => n + profile.stockOf(c.id), 0);
  }

  private refreshItems(): void {
    const held = this.itemsHeld();
    this.itemButton?.setText(String(held)).setEnabled(held > 0 && !this.finished);
  }

  /**
   * Choose something to burn. Everything here is one-use and was paid for
   * with salvage from an earlier battle, so the dialog names what it does
   * before it is spent rather than after.
   */
  private openItems(): void {
    const held = CONSUMABLES.filter((c) => profile.stockOf(c.id) > 0);
    if (!held.length) {
      audio.play('deny');
      return;
    }
    this.paused = true;
    showDialog(this, {
      title: 'What you carry',
      body: held.map((c) => `${c.name} x${profile.stockOf(c.id)} - ${c.blurb}`).join('\n\n'),
      width: 980,
      height: 560,
      buttons: [
        ...held.slice(0, 3).map((c) => ({
          text: c.name.toUpperCase(),
          tone: 'green' as const,
          onClick: (): void => {
            this.paused = false;
            this.useItem(c.id);
          },
        })),
        { text: 'KEEP THEM', tone: 'stone' as const, onClick: (): void => void (this.paused = false) },
      ],
    });
  }

  /** Spends one piece of stock and does what it does. */
  private useItem(id: string): void {
    if (this.finished) return;
    // A repair kit with nothing to mend is not spent: refuse it before it is
    // taken out of the pack rather than handing it back afterwards.
    if (id === 'repairkit' && !this.sections.some((hp) => hp <= 0)) {
      audio.play('deny');
      floatText(this, DESIGN.width / 2, HUD.height + 90, 'nothing to rebuild', COLORS.muted, 'small');
      return;
    }
    if (!profile.useStock(id)) {
      audio.play('deny');
      return;
    }
    const def = consumable(id);
    if (id === 'oilbarrel') {
      // The fullest lane is the one worth burning, and it is the one the
      // player would have picked anyway.
      const counts = this.sections.map((_, row) => this.enemies.filter((e) => e.alive && e.row === row).length);
      const row = counts.indexOf(Math.max(...counts));
      const y = laneCenterY(row);
      for (const e of this.enemies) {
        if (!e.alive || e.row !== row) continue;
        e.takeDamage(260, false, 'fire');
        e.applySlow(0.3, 3);
      }
      this.burst(DESIGN.width * 0.5, y, 'explosion');
      audio.play('explode');
      this.shake(14);
      floatText(this, DESIGN.width * 0.5, y - 60, 'OIL!', COLORS.danger, 'title');
    } else if (id === 'repairkit') {
      const row = this.sections.findIndex((hp) => hp <= 0);
      this.sections[row] = this.sectionMax * REPAIR_SHARE;
      audio.play('place');
      floatText(this, WALL.width + 40, laneCenterY(row), 'REBUILT', COLORS.good, 'small');
    } else {
      this.rallyFactor = 1.6;
      this.rallyTimer = 10;
      audio.play('upgrade');
      floatText(this, DESIGN.width / 2, HUD.height + 90, def.name.toUpperCase(), COLORS.gold, 'small');
    }
    this.refreshItems();
    this.updateHud();
  }

  /**
   * Send a unit out of the gate, or call it back.
   *
   * A unit on sortie keeps its cell - the price of going out is that nothing
   * holds its lane while it is gone, not that it loses its place - so its own
   * square stays the handle for calling it home.
   */
  private toggleSortie(row: number, col: number, x: number, y: number): void {
    if (!this.canGiveGround()) {
      audio.play('deny');
      floatText(this, x, y - 40, 'no sorties here', COLORS.muted, 'tiny');
      return;
    }
    const target =
      this.occupancy.get(`${row},${col}`) ??
      this.defenders.find(
        (d) => d.alive && d.row === row && d.sortie === 'out' && Math.abs(d.x - x) < GRID.cellW * 0.8,
      );
    if (!target) {
      audio.play('deny');
      return;
    }
    if (target.sortie !== 'held') {
      if (target.recall()) {
        floatText(this, target.x, target.topY, 'FALL BACK', COLORS.parchment, 'tiny');
        audio.play('tap');
      }
      return;
    }
    if (!target.goOut()) {
      audio.play('deny');
      floatText(this, x, y - 40, 'cannot sortie', COLORS.muted, 'tiny');
      return;
    }
    audio.play('gate');
    haptic(18);
    floatText(this, target.x, target.topY, 'SORTIE!', COLORS.gold, 'tiny');
  }

  /** The phase line and the button that lets the player set the pace. */
  private updatePhaseHud(): void {
    const last = this.waveIndex >= this.waves.length - 1;
    if (this.phase === 'muster' && !last) {
      this.phaseText.setText(`MUSTER  -  ${Math.ceil(Math.max(0, this.waveTimer))}s to the assault`);
      this.phaseText.setColor(COLORS.gold);
      this.callButton?.setVisible(!this.wavesHeld && !this.finished).setText('START NOW');
    } else {
      this.phaseText.setText(this.phase === 'siege' ? 'SIEGE  -  the engines are ranging on the wall' : 'ASSAULT');
      this.phaseText.setColor(this.phase === 'siege' ? COLORS.danger : COLORS.parchment);
      this.callButton?.setVisible(false);
    }
  }

  /** The short lull between waves; it deliberately pays nothing. */
  private beginMuster(): void {
    if (this.waveIndex >= this.waves.length - 1) return;
    this.phase = 'muster';
    this.waveTimer = MUSTER_SECONDS * (this.under('forcedmarch') ? DOCTRINE_EFFECT.forcedMarchMuster : 1);
    this.updateHud();
  }

  /**
   * Bring the next wave on now. Returns zero for the legacy test hook.
   */
  private callAssault(): number {
    if (this.phase !== 'muster' || this.finished || this.wavesHeld) return 0;
    if (this.waveIndex >= this.waves.length - 1) return 0;
    this.waveTimer = 0;
    this.startWave();
    return 0;
  }

  /**
   * Siege engines batter the wall from beyond the field. They aim at the
   * lane holding the fewest defenders, so a siege punishes a player who has
   * stacked one lane and left the rest thin.
   */
  private bombard(): void {
    const standing = this.sections
      .map((hp, row) => ({ hp, row }))
      .filter((s) => s.hp > 0);
    if (!standing.length) return;
    const held = (row: number) => this.defenders.filter((d) => d.alive && d.row === row).length;
    standing.sort((a, b) => held(a.row) - held(b.row) || a.hp - b.hp);
    const target = standing[0]!;
    this.sections[target.row] = Math.max(0, target.hp - BOMBARD_DAMAGE);
    const y = laneCenterY(target.row);
    this.burst(WALL.width + 30, y, 'explosion');
    audio.play('explode');
    this.shake(10);
    floatText(this, WALL.width + 90, y, `-${BOMBARD_DAMAGE}`, COLORS.danger, 'tiny');
    if (this.sections[target.row]! <= 0) this.onBreach(target.row);
    this.updateHud();
  }

  /* --------------------------------------------------------------- waves - */

  private startWave(): void {
    this.waveIndex += 1;
    const wave = this.waves[this.waveIndex];
    if (!wave) return;
    this.waveTimer = wave.duration * (this.under('forcedmarch') ? DOCTRINE_EFFECT.forcedMarchMuster : 1);
    for (const e of wave.entries) {
      this.spawnQueue.push({ at: this.elapsed + e.delay, enemyId: e.enemyId, row: e.row, scale: e.scale });
    }
    this.phase = wave.big || this.under('bombardment') ? 'siege' : 'assault';
    this.bombardTimer = BOMBARD_EVERY;
    audio.play('wave');
    this.banner(
      wave.big ? 'SIEGE ENGINES' : `WAVE ${this.waveIndex + 1}`,
      wave.big ? COLORS.danger : COLORS.gold,
    );
    this.updateHud();
  }

  private spawnEnemy(id: string, row: number, x = SPAWN_X, body = 1): void {
    const def = enemyDef(id);
    const scale =
      enemyScaling(this.chapter, Math.max(0, this.waveIndex)) * (this.levelDef.modifiers?.hpScale ?? 1) * body;
    const e = new Enemy(this, def, row, x, { hpScale: scale, damageScale: Math.sqrt(scale) });
    // Watchfires burn all night: everything that walks into their light is
    // already slower than it wanted to be.
    if (this.fitted.has('watchfires')) e.applySlow(EQUIPMENT_EFFECT.watchfires.enemySlow, Number.MAX_SAFE_INTEGER);
    this.enemies.push(e);
    if (def.special === 'boss') {
      this.banner('THE DEMON KING', COLORS.danger);
      this.shake(20);
    }
  }

  /** Runs the guided first level. */
  private startTutorial(): void {
    this.tutorial = new Tutorial(this, this.tutorialHost(), () => {
      profile.markTutorialDone();
      this.tutorial = undefined;
    });
  }

  private tutorialHost(): TutorialHost {
    return {
      cardPosition: (id) => {
        const card = this.cards.find((c) => c.id === id);
        return card ? { x: card.container.x, y: card.container.y } : undefined;
      },
      setWavesHeld: (held) => {
        this.wavesHeld = held;
      },
      countPlaced: (id) => this.defenders.filter((d) => d.alive && d.def.id === id).length,
    };
  }

  private banner(text: string, color: string): void {
    const t = this.add
      .text(DESIGN.width / 2, FIELD.y + FIELD.height * 0.42, text, textStyle('title', color))
      .setOrigin(0.5)
      .setDepth(7000)
      .setAlpha(0);
    this.tweens.add({
      targets: t,
      alpha: 1,
      y: FIELD.y + FIELD.height * 0.34,
      duration: 260,
      yoyo: true,
      hold: 900,
      onComplete: () => t.destroy(),
    });
  }

  /** The fort's own brief, plus the rules it is fought under. */
  private briefingText(): string {
    const rules = [...this.doctrines].map((id) => DOCTRINES[id]);
    if (!rules.length) return this.levelDef.brief;
    const lines = rules.map((d) => {
      // Standing Orders names the card it took, since which card it is only
      // becomes known once the player's deck is in hand.
      const blurb =
        d.id === 'standingorders' && this.spokenFor
          ? `The ${defender(this.spokenFor).name} is spoken for elsewhere and cannot be played here.`
          : d.blurb;
      return `${d.name.toUpperCase()}: ${blurb}\n${d.answer}`;
    });
    return `${this.levelDef.brief}\n\n${lines.join('\n\n')}`;
  }

  private announce(title: string, body: string, height = 460): void {
    showDialog(this, {
      title,
      body,
      width: 980,
      height,
      dismissable: false,
      buttons: [{ text: 'HOLD THE GATE', tone: 'green' }],
    });
  }

  /* -------------------------------------------------------------- update - */

  override update(time: number, delta: number): void {
    if (this.paused || this.finished) return;
    const dt = delta / 1000;
    this.elapsed += dt;

    this.tutorial?.update();
    this.garrisonFire(dt);

    // Wave pacing
    if (this.waveIndex < this.waves.length - 1) {
      if (!this.wavesHeld) this.waveTimer -= dt;
      // The field going quiet ends the assault and starts the next muster,
      // whatever the clock says: the lull is earned by clearing the wave.
      const clear = this.spawnQueue.length === 0 && this.enemies.every((e) => !e.alive);
      if (this.phase !== 'muster' && clear) this.beginMuster();
      if (this.waveTimer <= 0) this.startWave();
      this.updatePhaseHud();
      if (this.waveIndex < 0) this.updateHud();
    } else if (this.waveIndex === this.waves.length - 1) {
      const noneLeft = this.spawnQueue.length === 0 && this.enemies.every((e) => !e.alive);
      if (noneLeft) this.endBattle(true);
    }

    // Scheduled spawns
    while (this.spawnQueue.length && this.spawnQueue[0]!.at <= this.elapsed) {
      const s = this.spawnQueue.shift()!;
      this.spawnEnemy(s.enemyId, s.row, undefined, s.scale);
    }
    this.spawnQueue.sort((a, b) => a.at - b.at);

    // Siege waves keep hitting the wall whether or not anything reaches it.
    if (this.phase === 'siege') {
      this.bombardTimer -= dt;
      if (this.bombardTimer <= 0) {
        this.bombardTimer = BOMBARD_EVERY;
        this.bombard();
      }
    }

    if (this.guardTimer > 0) this.guardTimer -= dt;
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
      const affordable = this.gold >= this.priceOf(card.cost);
      const ready = card.cooldownLeft <= 0;
      card.overlay.setVisible(!ready || !affordable);
      card.overlay.height = ready ? TRAY.cardH - 10 : (TRAY.cardH - 10) * (card.cooldownLeft / card.cooldown);
      card.overlay.y = ready ? 0 : -(TRAY.cardH - 10) / 2 + card.overlay.height / 2;
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
    audio.setTension(tensionFor({ hp: this.heartHp, max: HEART_MAX_HP }, nearWall));

    quality.sample(this.game);
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

    const stars = victory ? starsForKeep(this.keepState()) : 0;
    const wave = this.waveIndex + 1;
    const unlockedBefore = profile.campaignProgress;
    const shrineGold = victory
      ? Math.min(
          40,
          this.defenders
            .filter((d) => d.alive)
            .reduce((total, d) => total + (d.def.metaGold ?? 0), 0),
        )
      : 0;

    this.time.delayedCall(700, () => {
      this.scene.start('Result', {
        levelId: this.levelDef.id,
        victory,
        stars,
        wave,
        kills: this.killCount,
        wallHp: Math.max(0, Math.round(this.heartHp)),
        wallMax: HEART_MAX_HP,
        reward: this.levelDef.reward,
        levelNo: levelNumber(this.levelDef.id),
        unlockedBefore,
        shrineGold,
      });
    });
  }
}

/** Exposed for the armoury preview so both screens agree on card contents. */
export const ALL_CARD_IDS = DEFENDERS.map((d) => d.id);
