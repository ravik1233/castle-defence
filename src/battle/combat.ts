/**
 * Pure combat maths.
 *
 * Kept free of Phaser so the rules can be unit tested and reasoned about
 * without booting a game.
 */
import type { DamageType, DefenderDef, EnemyDef, EnemyKind } from '../data/types';

/** Armour is flat reduction with a floor, so big hits still hurt tanks. */
export function damageAfterArmor(damage: number, armor: number): number {
  return Math.max(Math.ceil(damage * 0.15), Math.round(damage - armor));
}

export interface CombatantState {
  hp: number;
  maxHp: number;
}

export function applyDamage(state: CombatantState, damage: number, armor = 0): number {
  const dealt = Math.min(state.hp, damageAfterArmor(damage, armor));
  state.hp -= dealt;
  return dealt;
}

export function isDead(state: CombatantState): boolean {
  return state.hp <= 0;
}

/**
 * Star rating from the share of wall health left at the end.
 * Three stars means the gate was never touched at all.
 */
export function starsForWall(wallHp: number, wallMax: number): number {
  const pct = wallHp / wallMax;
  if (pct >= 0.9999) return 3;
  if (pct >= 0.6) return 2;
  return 1;
}

/** How a keep came through a siege. */
export interface KeepState {
  /** Health of each gate section, one per lane. A breached section is 0. */
  sections: number[];
  sectionMax: number;
  /** The heart of the keep. Losing it loses the battle. */
  heartHp: number;
  heartMax: number;
}

/**
 * Star rating for a siege.
 *
 * The wall is what the player is asked to hold, so it carries the rating -
 * but a breach is not the same as losing, and a keep whose heart was struck
 * has been through something the score should show. Three stars means no
 * section was ever breached and the wall is close to untouched.
 */
export function starsForKeep(keep: KeepState): number {
  if (keep.heartHp < keep.heartMax) return 1;
  const breached = keep.sections.filter((hp) => hp <= 0).length;
  if (breached > 0) return 1;
  const total = keep.sections.reduce((a, b) => a + b, 0);
  const pct = total / (keep.sectionMax * keep.sections.length);
  if (pct >= 0.9999) return 3;
  if (pct >= 0.6) return 2;
  return 1;
}

/* ------------------------------------------------------------- damage ---- */

/**
 * What each damage type does to each kind of enemy.
 *
 * Sixteen numbers, chosen to be learnable rather than exhaustive. Steel is
 * the honest baseline that is never terrible and never exciting; everything
 * else is good against something and bad against something, so bringing the
 * wrong deck into a chapter is a mistake the player can understand and fix.
 *
 * There is no randomness anywhere in here on purpose. Every blow in this game
 * is a number the player could have worked out in advance.
 */
const TYPE_TABLE: Record<DamageType, Record<EnemyKind, number>> = {
  //          living  armoured  undead  demon
  physical: { living: 1, armoured: 0.7, undead: 1, demon: 1 },
  // Burns flesh, does little to something that lives in fire.
  fire: { living: 1.3, armoured: 1, undead: 1.1, demon: 0.6 },
  // Bites hardest into things that run hot; a corpse does not feel the cold.
  frost: { living: 1, armoured: 1, undead: 0.7, demon: 1.4 },
  // The answer to what should not exist, and no better than steel on a man.
  holy: { living: 1, armoured: 0.9, undead: 1.7, demon: 1.5 },
};

/** The multiplier for a blow of this type against this kind of enemy. */
export function damageMultiplier(type: DamageType = 'physical', kind: EnemyKind = 'living'): number {
  return TYPE_TABLE[type][kind];
}

/**
 * What a blow actually takes off, in the order it happens: the type matchup
 * scales the blow, then armour comes off the top under the usual floor.
 *
 * One armour rule for the whole game, so a resisted hit and a plain hit are
 * still governed by the same arithmetic.
 */
export function damageDealt(
  raw: number,
  type: DamageType | undefined,
  kind: EnemyKind | undefined,
  armor: number,
): number {
  return damageAfterArmor(raw * damageMultiplier(type, kind), armor);
}

/**
 * Difficulty scaling applied to every enemy in a level.
 * Chapters ramp, and later waves inside a level ramp a little more.
 */
export function enemyScaling(chapter: number, waveIndex: number): number {
  return (1 + (chapter - 1) * 0.22) * (1 + waveIndex * 0.045);
}

export interface TargetLike {
  x: number;
  row: number;
  flying?: boolean;
  alive: boolean;
}

/**
 * Picks the enemy a defender should shoot: the one nearest the wall that is
 * still in range and that this defender is able to hit.
 */
/**
 * What an enemy marching down a lane runs into: the front-most living
 * defender in its own lane that is still ahead of it.
 *
 * This is looked up fresh every frame rather than remembered. An enemy that
 * keeps its first choice walks straight past anything the player puts down
 * afterwards, which makes placing a body in front of something pointless -
 * and that is the whole game.
 */
/**
 * The numbers behind the six hordes, in one place.
 *
 * These are the whole of what makes a region play differently, so they are
 * worth being able to read at a glance - and worth testing without a battle
 * running around them.
 */
export const FAMILY = {
  /** Undead come back at half, unless holy or fire put them down. */
  risenShare: 0.5,
  /** A shield is this much of the body's health, and eats this much of a blow. */
  shieldShare: 0.45,
  shieldAbsorb: 0.75,
  /**
   * Plate is the same idea, smaller: what an orc ironback or a barnacle hulk
   * carries. The Fallen's wall stays theirs by being nearly twice as thick.
   */
  platedShare: 0.25,
  /** A beast runs this much faster per packmate, up to this much. */
  packStep: 0.1,
  packMax: 0.4,
  /** A raging orc ends up hitting this much harder than it started. */
  rageMax: 0.5,
} as const;

/** Whether a body of this kind gets back up after a blow of this type. */
export function risesAgain(opts: {
  risen: boolean;
  spent: boolean;
  by: DamageType;
  consecrated: boolean;
}): boolean {
  if (!opts.risen || opts.spent || opts.consecrated) return false;
  return opts.by !== 'holy' && opts.by !== 'fire';
}

/** How hard a rager hits at this much health left. */
export function rageBlow(base: number, hp: number, maxHp: number): number {
  const lost = 1 - Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
  return Math.round(base * (1 + lost * FAMILY.rageMax));
}

/** How fast a beast moves with this many packmates beside it. */
export function packSpeed(base: number, near: number): number {
  return base * (1 + Math.min(FAMILY.packMax, Math.max(0, near) * FAMILY.packStep));
}

/**
 * How a blow splits between a shield and the body behind it. A shieldbreaker
 * ignores the shield entirely, which is the only way through it in one hit.
 */
export function throughShield(
  damage: number,
  shield: number,
  breakShield: boolean,
): { toShield: number; toBody: number } {
  if (shield <= 0 || breakShield) return { toShield: 0, toBody: damage };
  const toShield = Math.min(shield, damage * FAMILY.shieldAbsorb);
  return { toShield, toBody: damage - toShield };
}

export function pickBlocker<T extends { x: number; row: number; alive: boolean }>(
  from: { x: number; row: number },
  defenders: readonly T[],
): T | undefined {
  let best: T | undefined;
  for (const d of defenders) {
    if (!d.alive || d.row !== from.row) continue;
    // Behind it already: an enemy does not turn round for anything.
    if (d.x > from.x) continue;
    if (!best || d.x > best.x) best = d;
  }
  return best;
}

export function pickTarget<T extends TargetLike>(
  candidates: readonly T[],
  from: { x: number; row: number },
  range: number,
  canHitAir: boolean,
  laneLocked = true,
): T | undefined {
  let best: T | undefined;
  for (const c of candidates) {
    if (!c.alive) continue;
    if (laneLocked && c.row !== from.row) continue;
    if (c.flying && !canHitAir) continue;
    if (c.x < from.x) continue;
    if (c.x - from.x > range) continue;
    if (!best || c.x < best.x) best = c;
  }
  return best;
}

/** Gold awarded for a kill, scaled a little by chapter so late levels pay. */
export function bountyFor(def: EnemyDef, chapter: number): number {
  return Math.round(def.bounty * (1 + (chapter - 1) * 0.15));
}

/** Refund when the player sells a placed defender. */
export function sellValue(def: DefenderDef, hpFraction: number): number {
  return Math.max(10, Math.round(def.cost * 0.5 * Math.max(0.4, hpFraction)));
}

export interface WallState {
  hp: number;
  max: number;
}

/** How tense the music should be, 0..1. */
export function tensionFor(wall: WallState, enemiesNearWall: number): number {
  const hpPart = 1 - wall.hp / wall.max;
  const pressure = Math.min(1, enemiesNearWall / 6);
  return Math.min(1, hpPart * 0.7 + pressure * 0.5);
}
