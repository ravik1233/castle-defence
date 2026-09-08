/**
 * Battle entities: defenders, enemies and projectiles.
 *
 * Each entity owns its own view (a `Rig` puppet or a structure sprite) and is
 * ticked by the battle scene through the `BattleWorld` interface, which is the
 * only thing they know about the wider game.
 */
import Phaser from 'phaser';
import { characterArt } from '../art/compose';
import { ALL_CHARACTER_ART } from '../art/cast';
import type { ProjectileId } from '../art/props';
import { GRID, KEEP, WALL_FACE_X, cellCenter, laneGroundY } from '../core/layout';
import type { DamageType, DefenderDef, EnemyDef, EnemySpecial, TileKind } from '../data/types';
import { TILE_EFFECT } from '../data/types';
import { Rig } from '../objects/Rig';
import {
  FAMILY,
  applyDamage,
  damageDealt,
  damageMultiplier,
  packSpeed,
  pickBlocker,
  rageBlow,
  risesAgain,
  throughShield,
} from './combat';

export interface BattleWorld {
  /** The Phaser scene the battle runs in. Named `stage` because `Scene.scene`
   *  is already taken by Phaser's own ScenePlugin. */
  stage: Phaser.Scene;
  chapter: number;
  readonly enemies: Enemy[];
  readonly defenders: Defender[];
  /** Rally buff multiplier on defender attack speed, 1 when inactive. */
  rallyFactor: number;
  /** What a blow against one of ours is multiplied by. Sanctuary blunts it. */
  guardFactor(): number;
  defenderAt(row: number, col: number): Defender | undefined;
  spawnProjectile(opts: ProjectileOptions): void;
  damageWall(amount: number, atY: number): void;
  /** Mend a standing gate section. Rebuilding a fallen one costs gold. */
  mendWall(row: number, amount: number): void;
  /** True once this lane's gate section has fallen and the way is open. */
  isBreached(row: number): boolean;
  /** True while something holy is keeping the dead down in this lane. */
  isConsecrated(row: number): boolean;
  /** True while a ward is shut over this lane, so nothing can step through. */
  isWarded(row: number): boolean;
  /** How far anything of ours can see here. The night takes a quarter. */
  rangeFactor(): number;
  /** True when this fort is fought under the named rule. */
  under(id: import('../data/doctrines').DoctrineId): boolean;
  /** What kind of ground a cell is: rock, marsh, shrine, water, or plain. */
  tileAt(row: number, col: number): TileKind;
  /** The ground under a point on the field, for anything that is walking. */
  tileUnder(row: number, x: number): TileKind;
  /** Damage the heart of the keep, which only breached enemies can reach. */
  damageHeart(amount: number): void;
  /** A goblin thief lifts gold straight out of the purse. */
  stealGold(amount: number, x: number, y: number): void;
  awardGold(amount: number, x: number, y: number): void;
  onEnemyKilled(enemy: Enemy): void;
  burst(x: number, y: number, kind: 'hit' | 'blood' | 'magic' | 'explosion' | 'coin' | 'heal'): void;
  shake(intensity: number): void;
  sfx(id: import('../systems/audio').SfxId): void;
}

/* ---------------------------------------------------------------- shared - */

/** Small floating health bar shared by both sides. */
class HealthBar {
  private readonly back: Phaser.GameObjects.Image;
  private readonly fill: Phaser.GameObjects.Image;
  private readonly width: number;

  constructor(scene: Phaser.Scene, width: number, tone: 'green' | 'red' | 'gold') {
    this.width = width;
    this.back = scene.add.image(0, 0, 'ui.hp.back').setDisplaySize(width, width * 0.175).setDepth(1);
    this.fill = scene.add
      .image(0, 0, `ui.hp.${tone}`)
      .setOrigin(0, 0.5)
      .setDisplaySize(width - 6, width * 0.175 - 6)
      .setDepth(2);
    this.setVisible(false);
  }

  update(x: number, y: number, fraction: number, depth: number): void {
    const f = Math.max(0, Math.min(1, fraction));
    this.back.setPosition(x, y).setDepth(depth + 2);
    this.fill.setPosition(x - (this.width - 6) / 2, y).setDepth(depth + 3);
    this.fill.setDisplaySize((this.width - 6) * f, this.width * 0.175 - 6);
    this.setVisible(f < 0.999);
  }

  setVisible(v: boolean): void {
    this.back.setVisible(v);
    this.fill.setVisible(v);
  }

  destroy(): void {
    this.back.destroy();
    this.fill.destroy();
  }
}

/* -------------------------------------------------------------- defender - */

export class Defender {
  readonly def: DefenderDef;
  readonly row: number;
  readonly col: number;
  x: number;
  readonly y: number;
  /** Where this unit stands when it is holding the wall. */
  readonly homeX: number;
  /*
   * A sortie is the one thing a defender does that a lane defender usually
   * cannot: leave the line. Out there it meets the horde in the open, where
   * nothing supports it and nothing behind it is held - and where the killing
   * is worth more, because a body that never reaches the wall never breaks it.
   */
  sortie: 'held' | 'out' | 'returning' = 'held';
  hp: number;
  readonly maxHp: number;
  readonly damage: number;
  alive = true;

  private readonly rig?: Rig;
  private readonly sprite?: Phaser.GameObjects.Image;
  private readonly bar: HealthBar;
  private cooldown = 0;
  private economyTimer: number;
  private auraTimer = 0;
  private masonTimer = MASON_EVERY;
  /** The ground under this unit. Fixed: a defender does not move house. */
  private readonly ground: TileKind;
  /** Swings taken, for traits that land on a count rather than a chance. */
  private swings = 0;
  private pendingShot?: () => void;

  constructor(
    private readonly world: BattleWorld,
    def: DefenderDef,
    row: number,
    col: number,
    stats: { hp: number; damage: number },
  ) {
    this.def = def;
    this.row = row;
    this.col = col;
    this.maxHp = stats.hp;
    this.hp = stats.hp;
    this.damage = stats.damage;
    const c = cellCenter(row, col);
    this.x = c.x;
    this.homeX = c.x;
    this.y = laneGroundY(row);
    this.economyTimer = def.economy ? def.economy.interval : 0;
    /*
     * The ground a unit is put on is part of the decision to put it there:
     * an old shrine sharpens a blade, an ore seam pays a tithe more, and
     * tall grass keeps an archer alive long enough to matter.
     */
    this.ground = world.tileAt(row, col);

    const scene = world.stage;
    if (def.art.kind === 'unit') {
      const art = characterArt(ALL_CHARACTER_ART[def.art.id]!);
      this.rig = new Rig(scene, this.x, this.y, art, { facing: 1, phase: Math.random() * 6 });
      this.rig.setDepth(this.y);
      this.rig.play('spawn');
    } else {
      this.sprite = scene.add.image(this.x, this.y + 6, def.art.key);
      this.sprite.setOrigin(0.5, 1);
      // Fit the building to its lane rather than trusting a fixed scale: the
      // textures are supersampled, so a raw scale is meaningless.
      const fit = Math.min(
        (GRID.cellH * 0.98) / this.sprite.height,
        (GRID.cellW * 0.9) / this.sprite.width,
      );
      this.sprite.setScale(fit);
      this.sprite.setDepth(this.y);
      scene.tweens.add({
        targets: this.sprite,
        scaleY: { from: fit * 0.55, to: fit },
        scaleX: { from: fit * 1.15, to: fit },
        duration: 260,
        ease: 'Back.easeOut',
      });
    }
    this.bar = new HealthBar(scene, 88, 'green');
  }

  get topY(): number {
    return this.y - (this.rig ? this.rig.worldHeight : (this.sprite?.displayHeight ?? 110));
  }

  takeDamage(amount: number): void {
    amount *= this.world.guardFactor();
    if (!this.alive) return;
    // Tall grass is cover: what shoots at it mostly hits the grass.
    const cover = this.ground === 'tallgrass' ? TILE_EFFECT.grassCover : 1;
    const state = { hp: this.hp, maxHp: this.maxHp };
    applyDamage(state, amount * cover, 0);
    this.hp = state.hp;
    this.rig?.flash(0xff8888, 90);
    this.sprite?.setTintFill(0xffaaaa);
    if (this.sprite) {
      this.world.stage.time.delayedCall(80, () => this.sprite?.clearTint());
    }
    if (this.hp <= 0) this.kill();
  }

  heal(amount: number): void {
    if (!this.alive || this.hp >= this.maxHp) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.world.burst(this.x, this.topY + 20, 'heal');
  }

  kill(): void {
    if (!this.alive) return;
    this.alive = false;
    this.world.burst(this.x, this.y - 40, 'blood');
    this.world.sfx('die');
    if (this.rig) {
      this.rig.play('die');
      this.world.stage.time.delayedCall(600, () => this.rig?.destroy());
    }
    if (this.sprite) {
      this.world.stage.tweens.add({
        targets: this.sprite,
        alpha: 0,
        scaleY: 0.4,
        duration: 260,
        onComplete: () => this.sprite?.destroy(),
      });
    }
    this.bar.destroy();
  }

  destroy(): void {
    this.rig?.destroy();
    this.sprite?.destroy();
    this.bar.destroy();
  }

  update(time: number, delta: number): void {
    if (!this.alive) return;
    const dt = delta / 1000;
    this.rig?.update(time, delta);
    this.bar.update(this.x, this.topY - 16, this.hp / this.maxHp, this.y);
    if (this.sortie !== 'held') this.march(dt);

    if (this.def.economy) {
      this.economyTimer -= dt;
      if (this.economyTimer <= 0) {
        this.economyTimer = this.def.economy.interval;
        // A tithe raised over an ore seam is worth half as much again, and
        // nothing at all where the ground is frozen.
        if (this.world.under('frozenground')) return;
        const seam = this.ground === 'seam' ? TILE_EFFECT.seamGold : 1;
        this.world.awardGold(Math.round(this.def.economy.amount * seam), this.x, this.topY);
      }
    }

    /*
     * A mason works on the gate behind them rather than on the enemy in
     * front. It is the only way a wall gains health while the battle is
     * still running, which is what makes the dwarf worth a card slot.
     */
    if (this.def.trait === 'mason' && this.sortie === 'held') {
      this.masonTimer -= dt;
      if (this.masonTimer <= 0) {
        this.masonTimer = MASON_EVERY;
        this.world.mendWall(this.row, MASON_MEND);
      }
    }

    if (this.def.aura) {
      this.auraTimer -= dt;
      if (this.auraTimer <= 0) {
        this.auraTimer = this.def.aura.interval;
        this.pulseAura();
      }
    }

    const attack = this.def.attack;
    if (!attack) return;
    this.cooldown -= dt * this.world.rallyFactor;
    if (this.cooldown > 0) return;

    // Standing beside rock lets a shooter see further down the lane; a dark
    // night takes reach off everyone.
    const vantage = this.ground === 'highground' ? TILE_EFFECT.highgroundRange : 1;
    const reach = attack.range * vantage * this.world.rangeFactor();
    const target = this.findTarget(reach, attack.targets !== 'ground');
    if (!target) return;
    this.cooldown = 1 / attack.rate;
    this.swings += 1;

    /*
     * The only two crits in the game, and neither is a roll.
     *
     * A smite lands on every third swing; an executioner's bolt bites on
     * armour. Both are things the player can count or see coming, which is
     * the point - a crit nobody can predict is just noise in the numbers,
     * and one they can predict is a thing to play around.
     */
    const smiting = this.def.trait === 'smite' && this.swings % SMITE_EVERY === 0;
    const executing = this.def.trait === 'executioner' && target.def.kind === 'armoured';
    // A skyward weapon is built for one target and useless against the rest.
    const skyward = this.def.trait === 'skyward' && target.flying;
    const crit = smiting || executing || skyward;
    // An old shrine is worth standing on: it sharpens whatever is held there.
    const ground = this.ground === 'shrine' ? TILE_EFFECT.shrineDamage : 1;
    const blow = (crit ? this.damage * CRIT_MULTIPLIER : this.damage) * ground;
    const blowType: DamageType = smiting ? 'holy' : (attack.damageType ?? 'physical');

    const fire = (): void => {
      if (!this.alive) return;
      if (attack.projectile) {
        this.world.spawnProjectile({
          from: { x: this.x + 30, y: this.topY + 40 },
          target,
          damage: blow,
          damageType: blowType,
          breakShield: this.def.trait === 'shieldbreak',
          kind: attack.projectile,
          splash: attack.splash ?? 0,
          pierce: attack.pierce ?? 0,
          hitsAir: attack.targets !== 'ground',
          row: this.row,
        });
        this.applyTraitTo(target);
        this.world.sfx(
          attack.projectile === 'cannonball'
            ? 'cannon'
            : attack.projectile === 'arrow' || attack.projectile === 'bolt' || attack.projectile === 'spear_throw'
              ? 'arrow'
              : 'magic',
        );
      } else {
        // Melee: hit the target, plus anything caught in the swing.
        this.world.sfx('melee');
        this.world.burst(target.x - 20, target.y - 60, 'hit');
        target.takeDamage(blow, false, blowType, this.def.trait === 'shieldbreak');
        if (crit) this.world.burst(target.x - 20, target.y - 80, 'hit');
        this.applyTraitTo(target);
        if (attack.splash) {
          for (const e of this.world.enemies) {
            if (e === target || !e.alive || e.row !== this.row) continue;
            if (Math.abs(e.x - target.x) <= attack.splash) e.takeDamage(blow * 0.6, false, blowType);
          }
        }
        if (this.def.trait === 'knockback') target.knockback(26);
      }
    };

    if (this.rig) {
      this.pendingShot = fire;
      this.rig.play(attack.projectile ? 'cast' : 'attack', () => {
        this.pendingShot?.();
        this.pendingShot = undefined;
      });
    } else {
      fire();
      if (this.sprite) {
        this.world.stage.tweens.add({
          targets: this.sprite,
          scaleX: 0.94,
          scaleY: 0.92,
          duration: 90,
          yoyo: true,
        });
      }
    }
  }

  /**
   * What a blow does beyond damage.
   *
   * Each of these is the answer to one horde: a root stops a pack running,
   * a bleed makes an orc's own rage cost it, and a taunt drags something
   * out of the crowd before it reaches the wall.
   */
  private applyTraitTo(target: Enemy): void {
    if (this.def.trait === 'root') target.applySlow(0.85, ROOT_SECONDS);
    else if (this.def.trait === 'bleed') target.bleed(this.damage * BLEED_SHARE, BLEED_SECONDS);
    else if (this.def.trait === 'taunt') target.pullTo(this.x + TAUNT_REACH);
  }

  private pulseAura(): void {
    const aura = this.def.aura;
    if (!aura) return;
    if (aura.kind === 'heal') {
      for (const d of this.world.defenders) {
        if (!d.alive || d === this) continue;
        if (Phaser.Math.Distance.Between(d.x, d.y, this.x, this.y) <= aura.radius) d.heal(aura.value);
      }
      this.world.burst(this.x, this.topY, 'heal');
    } else if (aura.kind === 'slow') {
      for (const e of this.world.enemies) {
        if (!e.alive) continue;
        if (Phaser.Math.Distance.Between(e.x, e.y, this.x, this.y) <= aura.radius) e.applySlow(aura.value, 1.6);
      }
    } else if (aura.kind === 'burn') {
      for (const e of this.world.enemies) {
        if (!e.alive) continue;
        if (Phaser.Math.Distance.Between(e.x, e.y, this.x, this.y) <= aura.radius) {
          // A burn is fire whatever is producing it, so a demon shrugs at it.
          e.takeDamage(aura.value, false, 'fire');
          e.applySlow(0.25, 1.2);
        }
      }
    }
  }

  /**
   * Send this unit out through the gate. It gives up its cell - nothing is
   * held behind it while it is gone - and marches up its own lane.
   */
  goOut(): boolean {
    if (!this.alive || this.def.art.kind !== 'unit' || !this.def.attack) return false;
    if (this.sortie === 'out') return false;
    this.sortie = 'out';
    this.rig?.setFacing(1);
    return true;
  }

  /** Call it home. It walks back to its own cell and holds the line again. */
  recall(): boolean {
    if (!this.alive || this.sortie !== 'out') return false;
    this.sortie = 'returning';
    return true;
  }

  /** True once a recalled unit is standing where it started. */
  get home(): boolean {
    return this.sortie === 'held';
  }

  /**
   * Marching. A unit out in the field stops to fight whatever it can reach,
   * so this only moves it when nothing is in front of it - the attack code
   * does the rest, exactly as it does on the wall.
   */
  private march(dt: number): void {
    const speed = SORTIE_SPEED;
    if (this.sortie === 'returning') {
      this.x = Math.max(this.homeX, this.x - speed * 1.4 * dt);
      this.rig?.setFacing(-1);
      this.moveArt();
      if (this.x <= this.homeX + 1) {
        this.x = this.homeX;
        this.sortie = 'held';
        this.rig?.setFacing(1);
        this.moveArt();
      }
      return;
    }
    // Out: hold position while something is in reach, otherwise press on.
    const reach = this.def.attack?.range ?? 0;
    if (this.findTarget(reach, true)) return;
    this.x = Math.min(SORTIE_LIMIT, this.x + speed * dt);
    this.moveArt();
  }

  private moveArt(): void {
    this.rig?.setPosition(this.x, this.y);
    this.sprite?.setPosition(this.x, this.y + 6);
  }

  private findTarget(range: number, canHitAir: boolean): Enemy | undefined {
    let best: Enemy | undefined;
    for (const e of this.world.enemies) {
      if (!e.alive || e.row !== this.row) continue;
      if (e.flying && !canHitAir) continue;
      /*
       * Normally a defender looks up its lane and ignores whatever is behind
       * it. An enemy that came through a breach is behind everything, so with
       * that rule it could never be shot at all - it would stand in the
       * courtyard hitting the keep until the keep died. Units turn and fire on
       * anything that got inside.
       */
      if (!e.inside && e.x < this.x - 20) continue;
      if (Math.abs(e.x - this.x) > range) continue;
      if (!best || e.x < best.x) best = e;
    }
    return best;
  }
}

/**
 * How fast a unit marches out of the gate, and how far it will go. The limit
 * is short of the spawn line on purpose: a sortie is a raid into the field,
 * not a way to camp the enemy's own ground.
 */
const SORTIE_SPEED = 62;
const SORTIE_LIMIT = 1500;

/*
 * The numbers behind the family behaviours.
 *
 * Each is one line the player can learn and play around: a risen body comes
 * back at half, a shield eats three quarters of what hits it, a pack runs a
 * tenth faster per beast beside it, and a raging orc ends up hitting half
 * again as hard as it started.
 */
const RISEN_SHARE = FAMILY.risenShare;
const SHIELD_SHARE = FAMILY.shieldShare;
/** Plate: the same shield, a bit over half as thick. */
const PLATED_SHARE = FAMILY.platedShare;
const PACK_RADIUS = 260;
/** How far a demon steps through its portal, and how long the step takes. */
const STEP_DISTANCE = 260;
/** What a thief lifts per hit. */
const THIEF_TAKE = 12;
/** What the answering traits are worth, in seconds and in share of a blow. */
const ROOT_SECONDS = 1.6;
const BLEED_SHARE = 0.5;
const BLEED_SECONDS = 4;
const TAUNT_REACH = 150;
const TAUNT_PULL = 90;

/** How often a mason patches their own lane's section, and by how much. */
const MASON_EVERY = 3;
const MASON_MEND = 26;

/** Swings between smites, and what a crit multiplies by. Counted, not rolled. */
const SMITE_EVERY = 3;
const CRIT_MULTIPLIER = 2;

/* ----------------------------------------------------------------- enemy - */

export interface EnemyOptions {
  hpScale: number;
  damageScale: number;
}

export class Enemy {
  readonly def: EnemyDef;
  row: number;
  x: number;
  y: number;
  hp: number;
  readonly maxHp: number;
  readonly damage: number;
  alive = true;
  readonly flying: boolean;

  private readonly rig: Rig;
  private readonly bar: HealthBar;
  private slowFactor = 1;
  private slowTimer = 0;
  private frozenTimer = 0;
  private attackCooldown = 0;
  private target?: Defender;
  private hoverPhase = Math.random() * 6;
  private healTimer = 2;
  private summonTimer = 6;
  private charged = false;
  /** Undead: spent once the body has got back up. */
  private risenUsed = false;
  /** The Fallen: a shield that blunts what comes at its front, until broken. */
  private shieldHp = 0;
  /** Demons: spent once it has stepped through a portal. */
  private stepUsed = false;
  /** How hard it is currently hitting: rage climbs this as an orc bleeds. */
  private bleedRate = 0;
  private bleedTimer = 0;
  /** Set once the enemy is close enough to hit the wall. */
  atWall = false;
  /** Set once this enemy has come through a breach and is inside the keep. */
  inside = false;
  /** Set once a flanker has turned into a lane to hunt it from behind. */
  private flanking = false;

  constructor(
    private readonly world: BattleWorld,
    def: EnemyDef,
    row: number,
    x: number,
    opts: EnemyOptions,
  ) {
    this.def = def;
    this.row = row;
    this.x = x;
    this.maxHp = Math.round(def.hp * opts.hpScale);
    this.hp = this.maxHp;
    this.damage = Math.round(def.damage * opts.damageScale);
    this.flying = Boolean(def.flying);
    this.y = laneGroundY(row) - (this.flying ? 70 : 0);
    // A shield is a second, smaller pool of health that only counts against
    // blows landing on its front - and a shieldbreaker ignores it entirely.
    if (this.has('shieldwall')) this.shieldHp = Math.round(this.maxHp * SHIELD_SHARE);
    else if (this.has('shielded')) this.shieldHp = Math.round(this.maxHp * PLATED_SHARE);

    const art = characterArt(ALL_CHARACTER_ART[def.art]!);
    this.rig = new Rig(world.stage, x, this.y, art, {
      facing: -1,
      scale: def.scale ?? 1,
      phase: Math.random() * 6,
    });
    this.rig.setDepth(this.y + (this.flying ? 200 : 0));
    if (def.tint) this.rig.tintAll(def.tint);
    if (this.flying) this.rig.setShadowVisible(false);
    this.bar = new HealthBar(world.stage, def.special === 'boss' ? 220 : 96, 'red');
  }

  get topY(): number {
    return this.y - this.rig.worldHeight;
  }

  get isBoss(): boolean {
    return this.def.special === 'boss';
  }

  applySlow(factor: number, duration: number): void {
    this.slowFactor = Math.min(this.slowFactor, 1 - factor);
    this.slowTimer = Math.max(this.slowTimer, duration);
    this.rig.tintAll(0x9fd8ff);
  }

  freeze(duration: number): void {
    this.frozenTimer = Math.max(this.frozenTimer, duration);
    this.rig.tintAll(0x8fd0ff);
  }

  knockback(px: number): void {
    this.x += px;
  }

  /**
   * Takes a blow of a given kind.
   *
   * The flash colour follows the type, because a player who cannot see that
   * their fire is doing nothing to a demon has a matchup system they can only
   * learn from a wiki.
   */
  takeDamage(amount: number, ignoreArmor = false, type: DamageType = 'physical', breakShield = false): void {
    if (!this.alive) return;
    const armor = ignoreArmor ? 0 : this.def.armor;
    let dealt = damageDealt(amount, type, this.def.kind, armor);

    /*
     * A shield eats what lands on it before the body feels anything. A
     * shieldbreaker goes through it; everyone else has to take it down
     * first, which is what makes the Fallen a different fight rather than
     * a tougher one.
     */
    if (this.shieldHp > 0 && !breakShield) {
      const split = throughShield(dealt, this.shieldHp, false);
      this.shieldHp -= split.toShield;
      dealt = split.toBody;
      this.rig.flash(0x9fb6d8, 60);
      // The moment the shield finally goes is worth seeing: it is the moment
      // the fight against the Fallen turns.
      if (this.shieldHp <= 0) {
        this.shieldHp = 0;
        this.world.burst(this.x, this.y - 60, 'explosion');
        this.world.sfx('explode');
      }
    }

    this.hp -= dealt;
    const multiplier = damageMultiplier(type, this.def.kind);
    this.rig.flash(multiplier > 1.05 ? 0xfff0a0 : multiplier < 0.95 ? 0x7080a0 : 0xffffff, 70);
    if (this.hp <= 0) this.die(type);
  }

  private die(by: DamageType = 'physical'): void {
    if (!this.alive) return;

    /*
     * The dead get back up. Once, at half strength - and not at all if holy
     * or fire put them down, or if they fell on consecrated ground. That is
     * the whole argument for the Barrow Moors roster: ordinary steel kills
     * everything here twice.
     */
    if (
      risesAgain({
        risen: this.has('risen'),
        spent: this.risenUsed,
        by,
        consecrated: this.world.isConsecrated(this.row),
      })
    ) {
      this.risenUsed = true;
      this.hp = Math.max(1, Math.round(this.maxHp * RISEN_SHARE));
      this.rig.play('hurt');
      this.rig.flash(0x8f6fd0, 260);
      this.world.burst(this.x, this.y - 40, 'magic');
      this.world.sfx('hurt');
      return;
    }

    this.alive = false;
    this.rig.play('die');
    this.bar.destroy();
    this.world.burst(this.x, this.y - 50, 'blood');
    this.world.sfx('die');
    this.world.onEnemyKilled(this);
    // Powder goblins take the neighbourhood with them.
    if (this.def.special === 'bomber') {
      this.world.burst(this.x, this.y - 40, 'explosion');
      this.world.sfx('explode');
      for (const d of this.world.defenders) {
        if (d.alive && Math.abs(d.x - this.x) < 170 && d.row === this.row) d.takeDamage(this.damage);
      }
    }
    this.world.stage.time.delayedCall(700, () => this.rig.destroy());
  }

  destroy(): void {
    this.rig.destroy();
    this.bar.destroy();
  }

  update(time: number, delta: number): void {
    if (!this.alive) {
      this.rig.update(time, delta);
      return;
    }
    const dt = delta / 1000;

    if (this.bleedTimer > 0) {
      this.bleedTimer -= dt;
      this.takeDamage(this.bleedRate * dt, true);
      if (!this.alive) return;
      if (this.bleedTimer <= 0) this.bleedRate = 0;
    }

    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      if (this.slowTimer <= 0) {
        this.slowFactor = 1;
        this.rig.clearTintAll();
      }
    }
    if (this.frozenTimer > 0) {
      this.frozenTimer -= dt;
      if (this.frozenTimer <= 0) this.rig.clearTintAll();
      this.rig.update(time, 0);
      this.syncView();
      return;
    }

    // Support behaviours
    if (this.def.special === 'healer') {
      this.healTimer -= dt;
      if (this.healTimer <= 0) {
        this.healTimer = 3;
        let healed = false;
        for (const e of this.world.enemies) {
          if (e === this || !e.alive || e.hp >= e.maxHp) continue;
          if (Math.abs(e.x - this.x) > 320 || e.row !== this.row) continue;
          e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.16);
          this.world.burst(e.x, e.topY, 'magic');
          healed = true;
        }
        if (healed) this.rig.play('cast');
      }
    }
    if (this.def.special === 'summoner') {
      this.summonTimer -= dt;
      if (this.summonTimer <= 0) {
        this.summonTimer = 9;
        this.rig.play('cast', () => this.world.stage.events.emit('summon', this));
      }
    }

    this.attackCooldown -= dt;

    /*
     * Find something to hit, every frame.
     *
     * This used to keep whatever it first locked onto until that defender
     * died, which meant anything the player put down afterwards was simply
     * walked past: the enemy was still marching at a unit three columns
     * back. A line only works if a body placed in front of something is a
     * body in its way, so the front-most defender is looked up fresh.
     */
    this.target = this.findBlocker();

    if (this.flanking) {
      this.updateFlank(time, delta, dt);
      return;
    }

    /*
     * A breached lane has nothing left to stop at. The enemy walks through
     * the gap and goes for the heart of the keep instead, which is what turns
     * a breach into a second front rather than an instant loss.
     */
    const through = this.world.isBreached(this.row);
    const wallReach = through ? KEEP.x + KEEP.radius : WALL_FACE_X + this.def.range * 0.5;
    if (this.target) {
      const dist = this.x - this.target.x;
      if (dist <= this.def.range) {
        this.attackTarget(this.target);
        this.syncView();
        this.rig.update(time, delta);
        return;
      }
    } else if (this.x <= wallReach) {
      // A flanker that is through the wall turns on a lane that is still
      // held, rather than joining the queue at the heart.
      if (through && this.def.special === 'flanker' && this.beginFlank()) {
        this.syncView();
        this.rig.update(time, delta);
        return;
      }
      this.atWall = true;
      this.inside = through;
      this.attackWall();
      this.syncView();
      this.rig.update(time, delta);
      return;
    }

    /*
     * A demon that cannot get past a line does not queue behind it: it opens
     * a portal and comes out the other side, once, unless a ward is shut
     * over the lane. That is the Throne's whole shape - a front line is not
     * where the fight is.
     */
    if (this.has('stepper') && !this.stepUsed && this.target && !this.world.isWarded(this.row)) {
      this.stepUsed = true;
      this.world.burst(this.x, this.y - 50, 'magic');
      this.x = Math.max(WALL_FACE_X + 40, this.target.x - STEP_DISTANCE);
      this.world.burst(this.x, this.y - 50, 'magic');
      this.world.sfx('magic');
      this.target = undefined;
      this.syncView();
      this.rig.update(time, delta);
      return;
    }

    // Otherwise: march. Wet ground is wet ground for both sides.
    let speed = this.currentSpeed();
    if (!this.flying && this.world.tileUnder(this.row, this.x) === 'marsh') {
      speed *= 1 - TILE_EFFECT.marshSlow;
    }
    if (this.def.special === 'charger' && !this.charged && this.x < 700) {
      this.charged = true;
      speed *= 1.6;
    }
    if (this.def.special === 'leaper' && this.target && this.x - this.target.x < 260) {
      // Shadow fiends hop over the first line of defence.
      this.x -= speed * dt * 2.4;
      this.target = undefined;
    } else {
      this.x -= speed * dt;
    }
    if (this.rig.current !== 'walk' && !this.rig.isBusy) this.rig.play('walk');
    this.syncView();
    this.rig.update(time, delta);
  }

  /**
   * Turns into a lane that is still being held.
   *
   * It wants a lane with something to kill in it, and prefers the nearest,
   * so a breach on lane 0 threatens lane 1 rather than something across the
   * field. If nothing anywhere is still defended there is nothing to flank,
   * and it goes for the heart like everything else.
   */
  private beginFlank(): boolean {
    let best = -1;
    let bestDistance = Infinity;
    for (let row = 0; row < GRID.rows; row += 1) {
      if (row === this.row) continue;
      if (this.world.isBreached(row)) continue;
      if (!this.world.defenders.some((d) => d.alive && d.row === row)) continue;
      const distance = Math.abs(row - this.row);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = row;
      }
    }
    if (best < 0) return false;

    this.row = best;
    this.flanking = true;
    // Still flagged as inside: that is what lets defenders turn and shoot it,
    // and a flanker nothing can answer would just be a slower loss.
    this.inside = true;
    this.world.sfx('gate');
    return true;
  }

  /**
   * Hunting a lane from the wrong end.
   *
   * Walks back up the lane it turned into, hitting defenders from behind,
   * where every one of them is facing the other way. Once that lane is
   * cleared it turns back for the heart rather than wandering off the field.
   */
  private updateFlank(time: number, delta: number, dt: number): void {
    // Slide into the lane it turned into rather than snapping across.
    const wantY = laneGroundY(this.row);
    if (Math.abs(this.y - wantY) > 2) {
      this.y += Math.sign(wantY - this.y) * Math.min(220 * dt, Math.abs(wantY - this.y));
    }

    this.attackCooldown -= dt;

    // The nearest defender up the lane - the one whose back is turned.
    let prey: Defender | undefined;
    for (const d of this.world.defenders) {
      if (!d.alive || d.row !== this.row) continue;
      if (d.x < this.x - 20) continue;
      if (!prey || d.x < prey.x) prey = d;
    }

    if (prey) {
      if (prey.x - this.x <= this.def.range) {
        this.rig.setFacing(1);
        this.attackTarget(prey);
      } else {
        this.rig.setFacing(1);
        this.x += this.def.speed * this.slowFactor * dt;
        if (this.rig.current !== 'walk' && !this.rig.isBusy) this.rig.play('walk');
      }
    } else if (this.x > KEEP.x + KEEP.radius) {
      this.rig.setFacing(-1);
      // Lane cleared: back down the courtyard for the heart.
      this.x -= this.def.speed * this.slowFactor * dt;
      if (this.rig.current !== 'walk' && !this.rig.isBusy) this.rig.play('walk');
    } else {
      this.atWall = true;
      this.attackWall();
    }

    this.syncView();
    this.rig.update(time, delta);
  }

  private attackTarget(target: Defender): void {
    if (this.attackCooldown > 0) {
      if (!this.rig.isBusy) this.rig.play('idle');
      return;
    }
    this.attackCooldown = 1 / this.def.rate;
    if (this.def.projectile) {
      this.rig.play('cast', () => {
        this.world.spawnProjectile({
          from: { x: this.x - 24, y: this.topY + 40 },
          targetPoint: { x: target.x, y: target.topY + 30 },
          damage: this.blow,
          kind: this.def.projectile!,
          splash: 0,
          pierce: 0,
          hitsAir: true,
          row: this.row,
          hostile: true,
        });
      });
    } else {
      this.rig.play('attack', () => {
        if (!target.alive) return;
        target.takeDamage(this.blow);
        this.world.burst(target.x + 24, target.y - 60, 'hit');
        this.world.sfx('melee');
        // A thief is paid out of the purse rather than out of the defender.
        if (this.has('thief')) this.world.stealGold(THIEF_TAKE, this.x, this.topY);
        // Powder goblins detonate on contact instead of chipping away.
        if (this.def.special === 'bomber') this.takeDamage(this.hp * 2, true);
      });
    }
  }

  private attackWall(): void {
    if (this.attackCooldown > 0) {
      if (!this.rig.isBusy) this.rig.play('idle');
      return;
    }
    this.attackCooldown = 1 / this.def.rate;
    const inside = this.inside;
    this.rig.play('attack', () => {
      if (inside) this.world.damageHeart(this.blow);
      else this.world.damageWall(this.blow, this.y);
      this.world.sfx('gate');
      this.world.shake(this.isBoss ? 12 : 5);
      if (this.def.special === 'bomber') this.takeDamage(this.hp * 2, true);
    });
  }

  /** True when this enemy carries the named behaviour, alone or among many. */
  has(special: EnemySpecial): boolean {
    return this.def.special === special || Boolean(this.def.specials?.includes(special));
  }

  /**
   * Bleeding. Damage over time, and the one thing that punishes an enemy
   * for raging: rage is bought with lost health, and a bleed keeps buying.
   */
  bleed(perSecond: number, seconds: number): void {
    this.bleedRate = Math.max(this.bleedRate, perSecond);
    this.bleedTimer = Math.max(this.bleedTimer, seconds);
  }

  /** Dragged forward out of the crowd, so a taunt actually moves something. */
  pullTo(x: number): void {
    if (this.has('boss')) return;
    this.x = Math.max(x, this.x - TAUNT_PULL);
    this.syncView();
  }

  /** What is left of its shield, for the ledger and for tests. */
  get shield(): number {
    return Math.max(0, Math.round(this.shieldHp));
  }

  /**
   * How hard it hits right now.
   *
   * An orc rages: every wound it takes buys it damage, so a lane that
   * wounds without killing is a lane that made the problem worse. Bleed is
   * the answer the highlands sell you.
   */
  get blow(): number {
    return this.has('rager') ? rageBlow(this.damage, this.hp, this.maxHp) : this.damage;
  }

  /**
   * Walking speed after everything acting on it.
   *
   * A beast in company runs; alone it is only an animal. The pack bonus is
   * the reason a net or a root is worth a card slot in the highlands.
   */
  private currentSpeed(): number {
    let speed = this.def.speed * this.slowFactor;
    if (this.has('pack')) {
      let near = 0;
      for (const e of this.world.enemies) {
        if (e === this || !e.alive || !e.has('pack')) continue;
        if (Math.abs(e.x - this.x) < PACK_RADIUS && Math.abs(e.row - this.row) <= 1) near += 1;
      }
      speed = packSpeed(speed, near);
    }
    return speed;
  }

  private findBlocker(): Defender | undefined {
    // Flyers pass over the whole line: only units that can shoot stop them.
    if (this.flying) return undefined;
    return pickBlocker(this, this.world.defenders);
  }


  private syncView(): void {
    const hover = this.flying ? Math.sin(this.hoverPhase + performance.now() / 420) * 10 : 0;
    this.rig.setPosition(this.x, this.y + hover);
    this.rig.setDepth(this.y + (this.flying ? 200 : 0));
    this.bar.update(this.x, this.topY - 18, this.hp / this.maxHp, this.y + (this.flying ? 200 : 0));
  }
}

/* ------------------------------------------------------------ projectile - */

export interface ProjectileOptions {
  from: { x: number; y: number };
  target?: Enemy;
  targetPoint?: { x: number; y: number };
  damage: number;
  kind: ProjectileId;
  splash: number;
  pierce: number;
  hitsAir: boolean;
  row: number;
  /** Carried to the impact, so a holy bolt still lands as holy. */
  damageType?: DamageType;
  /** Carried too, so a shieldbreaker's bolt still ignores a shield. */
  breakShield?: boolean;
  /** Enemy projectiles damage defenders instead. */
  hostile?: boolean;
}

export class Projectile {
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly speed: number;
  private readonly arc: boolean;
  private life = 4;
  private hitCount = 0;
  private readonly hitIds = new Set<Enemy>();
  alive = true;

  constructor(
    private readonly world: BattleWorld,
    private readonly opts: ProjectileOptions,
  ) {
    this.sprite = world.stage.add.image(opts.from.x, opts.from.y, `shot.${opts.kind}`);
    this.sprite.setDepth(opts.from.y + 400);
    this.sprite.setScale(0.62);
    if (opts.hostile) this.sprite.setFlipX(true);
    this.speed = opts.kind === 'cannonball' || opts.kind === 'rock' ? 620 : 980;
    this.arc = opts.kind === 'cannonball' || opts.kind === 'rock' || opts.kind === 'bomb';
  }

  private currentTargetPoint(): { x: number; y: number } {
    if (this.opts.target && this.opts.target.alive) {
      return { x: this.opts.target.x, y: this.opts.target.topY + 40 };
    }
    return this.opts.targetPoint ?? { x: this.opts.hostile ? -100 : 2000, y: this.opts.from.y };
  }

  update(_time: number, delta: number): void {
    if (!this.alive) return;
    const dt = delta / 1000;
    this.life -= dt;
    const tp = this.currentTargetPoint();
    const dx = tp.x - this.sprite.x;
    const dy = tp.y - this.sprite.y;
    const dist = Math.hypot(dx, dy) || 1;
    const step = this.speed * dt;
    this.sprite.x += (dx / dist) * step;
    this.sprite.y += (dy / dist) * step;
    this.sprite.setRotation(this.arc ? this.sprite.rotation + dt * 9 : Math.atan2(dy, dx));

    if (this.opts.hostile) {
      for (const d of this.world.defenders) {
        if (!d.alive || d.row !== this.opts.row) continue;
        if (Math.abs(d.x - this.sprite.x) < 46 && Math.abs(d.y - 60 - this.sprite.y) < 90) {
          d.takeDamage(this.opts.damage);
          this.explode();
          return;
        }
      }
      if (this.sprite.x < 120 || this.life <= 0) this.destroy();
      return;
    }

    for (const e of this.world.enemies) {
      if (!e.alive || this.hitIds.has(e)) continue;
      if (e.row !== this.opts.row) continue;
      if (e.flying && !this.opts.hitsAir) continue;
      if (Math.abs(e.x - this.sprite.x) > 44) continue;
      if (Math.abs(e.y - 50 - this.sprite.y) > 110) continue;
      this.hitIds.add(e);
      e.takeDamage(this.opts.damage, false, this.opts.damageType, this.opts.breakShield);
      this.world.burst(this.sprite.x, this.sprite.y, this.opts.splash ? 'explosion' : 'hit');
      this.hitCount += 1;
      if (this.opts.splash > 0) {
        this.explode();
        return;
      }
      if (this.hitCount > this.opts.pierce) {
        this.destroy();
        return;
      }
    }

    if (this.sprite.x > 1300 || this.life <= 0) this.destroy();
  }

  private explode(): void {
    if (this.opts.splash > 0) {
      this.world.sfx('explode');
      this.world.shake(4);
      for (const e of this.world.enemies) {
        if (!e.alive || this.hitIds.has(e)) continue;
        const d = Phaser.Math.Distance.Between(e.x, e.y - 50, this.sprite.x, this.sprite.y);
        if (d <= this.opts.splash) {
          e.takeDamage(this.opts.damage * 0.7, false, this.opts.damageType, this.opts.breakShield);
        }
      }
      this.world.burst(this.sprite.x, this.sprite.y, 'explosion');
    }
    this.destroy();
  }

  destroy(): void {
    this.alive = false;
    this.sprite.destroy();
  }
}

export const LANE_COUNT = GRID.rows;
