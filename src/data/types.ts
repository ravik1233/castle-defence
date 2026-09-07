/** Shared gameplay data types. Stats live here; art lives in `src/art`. */
import type { ProjectileId } from '../art/props';
import type { BiomeId } from '../art/scenery';

export type DefenderRole = 'melee' | 'ranged' | 'economy' | 'wall' | 'support' | 'aoe';

/**
 * What a blow is made of. Steel is the baseline; the rest trade being poor
 * against something for being strong against something else, which is what
 * makes a deck a choice rather than a shopping list of the best numbers.
 */
export type DamageType = 'physical' | 'fire' | 'frost' | 'holy';

/**
 * What an enemy is made of. Four kinds, so the whole matrix is sixteen
 * numbers a player can actually learn.
 */
export type EnemyKind = 'living' | 'armoured' | 'undead' | 'demon';

/**
 * Who the horde is, region by region.
 *
 * A region draws only from its own family, so crossing a border changes what
 * you are fighting rather than only how much of it. Each family carries one
 * behaviour of its own - see `FAMILY_TRAIT` - which is the thing the region's
 * own defenders are built to answer.
 */
export type EnemyFamily =
  | 'goblin'
  | 'undead'
  | 'orc'
  | 'beast'
  /** The water region: everything here comes out of the deep. */
  | 'drowned'
  /** Men who took the King's side. His household guard at the Throne. */
  | 'fallen'
  /** The King's own kind, held back until his own region. */
  | 'demon';

/**
 * What a cell of the field is made of.
 *
 * A flat grid means every fort plays the same. Ground that refuses to be
 * built on, slows what crosses it, or pays a building more turns placement
 * into a decision about this fort rather than a habit.
 */
export type TileKind =
  /** Ordinary ground. */
  | 'plain'
  /** Cannot be built on at all. */
  | 'rubble'
  /** Anything walking across it is slowed. */
  | 'marsh'
  /** Whoever stands here strikes harder. */
  | 'shrine'
  /** An economy building here pays more. */
  | 'seam'
  /** Nothing can stand here and only flyers cross it. */
  | 'chasm';

export interface AttackDef {
  damage: number;
  /** Defaults to physical when a unit does not say otherwise. */
  damageType?: DamageType;
  /** Attacks per second. */
  rate: number;
  /** Reach in screen pixels; melee units use roughly one cell. */
  range: number;
  projectile?: ProjectileId;
  /** Radius of splash damage on impact, 0 for single target. */
  splash?: number;
  /** Ranged units that cannot hit flyers set this to 'ground'. */
  targets?: 'ground' | 'all';
  /** Number of enemies a shot passes through. */
  pierce?: number;
}

export interface AuraDef {
  kind: 'heal' | 'slow' | 'burn' | 'rally';
  /** Radius in pixels; 0 means "whole lane". */
  radius: number;
  value: number;
  /** Seconds between pulses. */
  interval: number;
}

export interface DefenderDef {
  id: string;
  name: string;
  blurb: string;
  role: DefenderRole;
  /** Which art to use: a rigged character or a static structure texture. */
  art: { kind: 'unit'; id: string } | { kind: 'build'; key: string };
  cost: number;
  /** Seconds before the card can be played again. */
  recharge: number;
  hp: number;
  attack?: AttackDef;
  aura?: AuraDef;
  economy?: { amount: number; interval: number };
  /** Campaign level (1-based) that unlocks this card. */
  unlockLevel: number;
  premium?: boolean;
  /** Multiplicative gain per armoury upgrade level. */
  upgrade: { hp: number; damage: number };
  /**
   * Extra behaviour hooks the battle scene understands.
   *
   * `smite` and `executioner` are the only crits in the game, and both are
   * counted rather than rolled: every blow in this game is a number the
   * player could have worked out beforehand.
   */
  /**
   * A named behaviour that is not expressible as numbers. `mason` mends the
   * gate section in its own lane; the rest are combat quirks.
   */
  trait?:
    | 'thorns'
    | 'deathblast'
    | 'chain'
    | 'knockback'
    | 'smite'
    | 'executioner'
    | 'mason'
    /** Holy ground: the undead it kills in this lane do not get back up. */
    | 'consecrate'
    /** Roots what it hits in place for a moment. Answers a charging pack. */
    | 'root'
    /** Ignores a shield carried against the front. */
    | 'shieldbreak'
    /** Only hits flyers, and hits them hard. */
    | 'skyward'
    /** Bleeds what it hits, so raging enemies pay for their own rage. */
    | 'bleed'
    /** Drags the lane's front-most enemy into reach and holds its attention. */
    | 'taunt'
    /** Closes portals and cancels a demon's step. */
    | 'ward';
}

export type EnemySpecial =
  | 'none'
  | 'bomber'
  | 'healer'
  | 'summoner'
  | 'charger'
  | 'leaper'
  | 'boss'
  | 'shielded'
  /**
   * Goes through a breach like anything else, then turns into a neighbouring
   * lane and comes at its defenders from behind, where none of them are
   * facing. Punishes leaving a lane open far more sharply than a plain
   * attack on the keep does.
   */
  | 'flanker'
  /** Undead: gets back up once, unless holy or fire put it down. */
  | 'risen'
  /** Orcs: hits harder the more it has bled. */
  | 'rager'
  /** Beasts: faster while other beasts are near it. */
  | 'pack'
  /** The Fallen: a shield that blunts everything coming at its front. */
  | 'shieldwall'
  /** Demons: steps through a portal past whatever is blocking it, once. */
  | 'stepper'
  /** Goblins: takes gold off the player when it lands a hit. */
  | 'thief';

export interface EnemyDef {
  id: string;
  name: string;
  art: string;
  hp: number;
  /** Pixels per second walking toward the wall. */
  speed: number;
  damage: number;
  /** Attacks per second. */
  rate: number;
  range: number;
  /** Flat damage reduction per hit. */
  armor: number;
  /** What it is made of, for damage type multipliers. Defaults to living. */
  kind?: EnemyKind;
  flying?: boolean;
  /** Gold awarded on death. */
  bounty: number;
  /** Cost against a wave's budget; drives the wave generator. */
  threat: number;
  /** Which horde it belongs to. Drives which region it turns up in. */
  family?: EnemyFamily;
  special?: EnemySpecial;
  /** A second behaviour, so a boss can rage and summon both. */
  specials?: EnemySpecial[];
  projectile?: ProjectileId;
  scale?: number;
  /** Tint applied to elite variants. */
  tint?: number;
}

export type SpellTarget = 'point' | 'lane' | 'global';

export interface SpellDef {
  id: string;
  name: string;
  blurb: string;
  icon: string;
  target: SpellTarget;
  cooldown: number;
  damage?: number;
  radius?: number;
  duration?: number;
  effect?: 'burn' | 'freeze' | 'heal' | 'rally' | 'smite' | 'chain' | 'wall';
  fx: string;
}

export interface HeroDef {
  id: string;
  name: string;
  title: string;
  art: string;
  blurb: string;
  spells: SpellDef[];
  premium?: boolean;
}

/**
 * A region of the continent: one of the places humanity still holds.
 *
 * A region is not just a set of levels with a different backdrop. It has a
 * commander, whose spells are the player's hand in every fight fought there,
 * and it opens up units raised locally. Crossing a border changes how the
 * game is played, not only what it looks like.
 */
export interface RegionDef {
  id: number;
  name: string;
  /** The hero who commands here. Their spells replace the last one's. */
  commander: string;
  /** Defenders this region musters, granted on arrival. */
  unlocks: string[];
  /** Where it sits on the continent, as a fraction of the map. */
  map: { x: number; y: number };
  premium?: boolean;
}

export interface LevelModifiers {
  /** Rows that start blocked by rubble. */
  blockedCells?: Array<[row: number, col: number]>;
  /** Multiplier on all enemy hp for this level. */
  hpScale?: number;
  /** Extra gold trickle per second (used on tutorial levels). */
  goldTrickle?: number;
  /** Cards the player may not use, e.g. a "no economy" challenge. */
  bannedCards?: string[];
  /** Only these cards are available. */
  fixedDeck?: string[];
}

export interface LevelDef {
  id: string;
  chapter: number;
  index: number;
  name: string;
  biome: BiomeId;
  waves: number;
  /** Threat budget of wave 1 and the growth per wave. */
  budgetStart: number;
  budgetGrowth: number;
  pool: string[];
  boss?: string;
  startingGold: number;
  reward: number;
  premium?: boolean;
  modifiers?: LevelModifiers;
  /** One-line briefing shown before the fight. */
  brief: string;
}

export interface ChapterDef {
  id: number;
  name: string;
  biome: BiomeId;
  blurb: string;
  premium?: boolean;
  levels: LevelDef[];
  /** Whose horde holds this ground. Every fort here fields it and nothing else. */
  family: EnemyFamily;
  /** Who holds the wall with you. Named on the map and in the briefing. */
  race: string;
  /** The hero who commands here, and whose spells the player fights with. */
  commander: string;
  /** Defenders this region musters, granted on arrival. */
  unlocks: string[];
  /** Where it sits on the continent, as a fraction of the map. */
  map: { x: number; y: number };
}
