/**
 * What a card is worth, and what the game expects it to be worth.
 *
 * A lane defender lives or dies on one number: value per gold. If one card
 * leads that number everywhere, the deck stops being a decision - and that
 * is exactly what had happened here, with a fifty-gold militia out-damaging
 * every elite in the game per coin spent, in all one hundred and five forts.
 *
 * So the design targets are written down and checked. A card may sit outside
 * its band, but only deliberately and only where the code says why.
 */
import type { DefenderDef, DefenderRole } from './types';

/**
 * Damage a second, after the things that multiply it.
 *
 * Splash and pierce are worth real money in a lane defender - a bombard that
 * hits three bodies is doing three times the work - so they count here rather
 * than being admired in the card text.
 */
export function effectiveDps(def: DefenderDef): number {
  const a = def.attack;
  if (!a) return 0;
  let dps = a.damage * a.rate;
  // A splash of one cell over hits roughly two extra bodies in a packed lane.
  if (a.splash) dps *= 1 + Math.min(1.4, a.splash / 110);
  if (a.pierce) dps *= 1 + a.pierce * 0.3;
  // Counted crits and situational multipliers, averaged over a fight.
  if (def.trait === 'smite') dps *= 1.33;
  if (def.trait === 'executioner' || def.trait === 'skyward') dps *= 1.15;
  // A burn aura is damage whether or not the unit swings.
  if (def.aura?.kind === 'burn') dps += def.aura.value / def.aura.interval;
  return dps;
}

/** Damage a second per hundred gold: the number the deck is chosen on. */
export function dpsPerGold(def: DefenderDef): number {
  return (effectiveDps(def) / def.cost) * 100;
}

/** Health per hundred gold: what a blocker is actually being bought for. */
export function hpPerGold(def: DefenderDef): number {
  return (def.hp / def.cost) * 100;
}

/** Seconds before an economy building has paid for itself. */
export function payback(def: DefenderDef): number {
  if (!def.economy) return Infinity;
  return (def.cost / def.economy.amount) * def.economy.interval;
}

/**
 * The band each role is meant to live in.
 *
 * Melee is paid in health rather than damage; a wall is paid only in health;
 * support is bought for what its aura does, so it only has to clear a floor.
 * Nothing is allowed to lead both bands at once - that is what makes a card
 * an auto-include rather than a choice.
 */
export const BANDS: Record<DefenderRole, { dps?: [number, number]; hp?: [number, number]; payback?: number }> = {
  melee: { dps: [14, 30], hp: [300, 560] },
  ranged: { dps: [24, 40], hp: [90, 260] },
  aoe: { dps: [28, 52], hp: [100, 260] },
  support: { dps: [0, 26], hp: [100, 320] },
  wall: { dps: [0, 0], hp: [700, 1400] },
  economy: { payback: 26 },
};

/** Every way a card sits outside what the design says it should be. */
export function outOfBand(def: DefenderDef): string[] {
  const band = BANDS[def.role];
  const bad: string[] = [];
  if (band.dps) {
    const v = dpsPerGold(def);
    if (v < band.dps[0]) bad.push(`dps/100g ${v.toFixed(1)} below ${band.dps[0]}`);
    if (v > band.dps[1]) bad.push(`dps/100g ${v.toFixed(1)} above ${band.dps[1]}`);
  }
  if (band.hp) {
    const v = hpPerGold(def);
    if (v < band.hp[0]) bad.push(`hp/100g ${v.toFixed(0)} below ${band.hp[0]}`);
    if (v > band.hp[1]) bad.push(`hp/100g ${v.toFixed(0)} above ${band.hp[1]}`);
  }
  if (band.payback !== undefined && payback(def) > band.payback) {
    bad.push(`pays back in ${payback(def).toFixed(0)}s, over ${band.payback}s`);
  }
  return bad;
}
