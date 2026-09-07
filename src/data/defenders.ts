/**
 * The defender roster.
 *
 * Costs are tuned around a tithe shrine producing 25 gold every 7s, so an
 * economy-first opening pays for itself in roughly two waves.
 */
import type { DefenderDef } from './types';

export const DEFENDERS: DefenderDef[] = [
  {
    id: 'tithe',
    name: 'Tithe Shrine',
    blurb: 'Faithful villagers leave offerings. Your only source of steady gold.',
    role: 'economy',
    art: { kind: 'build', key: 'build.tithe' },
    cost: 50,
    recharge: 6,
    hp: 200,
    economy: { amount: 25, interval: 7 },
    unlockLevel: 1,
    upgrade: { hp: 0.12, damage: 0 },
  },
  {
    id: 'militia',
    name: 'Militia',
    blurb: 'A farmer with a spear and no plan. Cheap, and there are many.',
    role: 'melee',
    art: { kind: 'unit', id: 'militia' },
    cost: 50,
    recharge: 4,
    hp: 260,
    attack: { damage: 22, rate: 1.1, range: 110 },
    unlockLevel: 1,
    upgrade: { hp: 0.14, damage: 0.16 },
  },
  {
    id: 'archer',
    name: 'Archer',
    blurb: 'Fires down the lane. Cannot hit what walks over her.',
    role: 'ranged',
    art: { kind: 'unit', id: 'archer' },
    cost: 100,
    recharge: 5,
    hp: 180,
    attack: { damage: 26, rate: 1.25, range: 900, projectile: 'arrow', targets: 'all' },
    unlockLevel: 2,
    upgrade: { hp: 0.1, damage: 0.18 },
  },
  {
    id: 'barricade',
    name: 'Barricade',
    blurb: 'Timber, iron and spite. Buys you the seconds you need.',
    role: 'wall',
    art: { kind: 'build', key: 'build.barricade' },
    cost: 50,
    recharge: 8,
    hp: 900,
    unlockLevel: 3,
    upgrade: { hp: 0.2, damage: 0 },
    trait: 'thorns',
  },
  {
    id: 'guardian',
    name: 'Guardian',
    blurb: 'Shield wall of one. Holds a lane while the archers work.',
    role: 'melee',
    art: { kind: 'unit', id: 'guardian' },
    cost: 150,
    recharge: 8,
    hp: 720,
    attack: { damage: 34, rate: 0.85, range: 120 },
    unlockLevel: 4,
    upgrade: { hp: 0.18, damage: 0.14 },
  },
  {
    id: 'frostmage',
    name: 'Frost Adept',
    blurb: 'Chills the lane. Slowed enemies die to everything else.',
    role: 'support',
    art: { kind: 'unit', id: 'frostmage' },
    cost: 175,
    recharge: 12,
    hp: 200,
    attack: { damageType: 'frost', damage: 16, rate: 0.8, range: 820, projectile: 'frostbolt', targets: 'all' },
    aura: { kind: 'slow', radius: 300, value: 0.45, interval: 1 },
    unlockLevel: 5,
    upgrade: { hp: 0.1, damage: 0.14 },
  },
  {
    id: 'arbalest',
    name: 'Arbalest',
    blurb: 'A bolt that goes through the first three things it meets.',
    role: 'ranged',
    art: { kind: 'unit', id: 'arbalest' },
    cost: 200,
    recharge: 10,
    hp: 220,
    attack: { damage: 52, rate: 0.62, range: 900, projectile: 'bolt', pierce: 3, targets: 'all' },
    // A bolt made for plate: doubled against anything armoured.
    trait: 'executioner',
    unlockLevel: 7,
    upgrade: { hp: 0.1, damage: 0.2 },
  },
  {
    id: 'cleric',
    name: 'Cleric',
    blurb: 'Mends the line. Keep her behind something large.',
    role: 'support',
    art: { kind: 'unit', id: 'cleric' },
    cost: 200,
    recharge: 14,
    hp: 240,
    aura: { kind: 'heal', radius: 340, value: 34, interval: 2 },
    attack: { damageType: 'holy', damage: 18, rate: 0.7, range: 640, projectile: 'holybolt', targets: 'all' },
    unlockLevel: 8,
    upgrade: { hp: 0.12, damage: 0.16 },
  },
  {
    id: 'bombard',
    name: 'Bombard',
    blurb: 'Slow, loud, and devastating to a packed lane.',
    role: 'aoe',
    art: { kind: 'build', key: 'build.bombard' },
    cost: 275,
    recharge: 16,
    hp: 420,
    attack: { damageType: 'fire', damage: 70, rate: 0.4, range: 820, projectile: 'cannonball', splash: 150, targets: 'ground' },
    unlockLevel: 6,
    upgrade: { hp: 0.14, damage: 0.2 },
  },
  {
    id: 'monk',
    name: 'Warrior Monk',
    blurb: 'Sweeping strikes hit everything in front of him.',
    role: 'melee',
    art: { kind: 'unit', id: 'monk' },
    cost: 250,
    recharge: 12,
    hp: 560,
    attack: { damage: 42, rate: 1.0, range: 150, splash: 120 },
    unlockLevel: 10,
    upgrade: { hp: 0.16, damage: 0.18 },
    trait: 'knockback',
  },
  {
    id: 'ballista',
    name: 'Ballista',
    blurb: 'Reaches the far edge of the field and hits like a falling tree.',
    role: 'ranged',
    art: { kind: 'build', key: 'build.ballista' },
    cost: 325,
    recharge: 18,
    hp: 380,
    attack: { damage: 120, rate: 0.34, range: 1200, projectile: 'spear_throw', pierce: 2, targets: 'all' },
    unlockLevel: 12,
    upgrade: { hp: 0.12, damage: 0.22 },
  },

  /* ------------------------------------------------ Crown Pack exclusives - */
  {
    id: 'pyromancer',
    name: 'Pyromancer',
    blurb: 'Lobs fire that lingers. Crown Pack.',
    role: 'aoe',
    art: { kind: 'unit', id: 'pyromancer' },
    cost: 275,
    recharge: 14,
    hp: 220,
    attack: { damageType: 'fire', damage: 46, rate: 0.7, range: 760, projectile: 'fireball', splash: 170, targets: 'all' },
    unlockLevel: 1,
    premium: true,
    upgrade: { hp: 0.1, damage: 0.2 },
  },
  {
    id: 'brazier',
    name: 'Warding Brazier',
    blurb: 'Burns and slows everything that walks past it. Crown Pack.',
    role: 'support',
    art: { kind: 'build', key: 'build.brazier' },
    cost: 200,
    recharge: 12,
    hp: 340,
    aura: { kind: 'burn', radius: 260, value: 22, interval: 1 },
    unlockLevel: 1,
    premium: true,
    upgrade: { hp: 0.14, damage: 0.18 },
  },
  {
    id: 'paladin',
    name: 'Paladin',
    blurb: 'The line does not break where he stands. Crown Pack.',
    role: 'melee',
    art: { kind: 'unit', id: 'paladin' },
    cost: 375,
    recharge: 20,
    hp: 1100,
    attack: { damage: 62, rate: 0.95, range: 140, splash: 110 },
    unlockLevel: 1,
    premium: true,
    upgrade: { hp: 0.2, damage: 0.18 },
    // Every third swing comes down holy and doubled. Countable, so it can be
    // played around rather than merely hoped for.
    trait: 'smite',
  },
];

export const DEFENDER_BY_ID = new Map(DEFENDERS.map((d) => [d.id, d]));

export function defender(id: string): DefenderDef {
  const d = DEFENDER_BY_ID.get(id);
  if (!d) throw new Error(`unknown defender ${id}`);
  return d;
}

/** Stats after armoury upgrades. Level 0 is the base card. */
export function upgradedStats(def: DefenderDef, level: number): { hp: number; damage: number } {
  const hp = Math.round(def.hp * (1 + def.upgrade.hp * level));
  const damage = def.attack ? Math.round(def.attack.damage * (1 + def.upgrade.damage * level)) : 0;
  return { hp, damage };
}

export const MAX_UPGRADE_LEVEL = 5;

/** Gold price of the next armoury upgrade. */
export function upgradeCost(def: DefenderDef, currentLevel: number): number {
  return Math.round(def.cost * 3 * Math.pow(1.75, currentLevel));
}
