/**
 * Pure combat maths.
 *
 * Kept free of Phaser so the rules can be unit tested and reasoned about
 * without booting a game.
 */
import type { DefenderDef, EnemyDef } from '../data/types';

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
