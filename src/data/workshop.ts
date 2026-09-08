/**
 * Fort equipment and the things the workshop makes.
 *
 * Ember is spent inside a battle. Gold is permanent progression currency,
 * while salvage is what the field gives the workshop. Everything here is bought
 * with salvage from earlier fights.
 *
 * Equipment is permanent once bought and three pieces go to war. Workshop
 * stock is one-use: carried into a battle, spent there, gone.
 */

export interface EquipmentDef {
  id: string;
  name: string;
  blurb: string;
  /** What it costs in salvage, once. */
  cost: number;
  icon: string;
  premium?: boolean;
}

export interface ConsumableDef {
  id: string;
  name: string;
  blurb: string;
  /** Salvage per unit made. */
  cost: number;
  icon: string;
  /** Nobody carries more than this into one battle. */
  max: number;
}

/** How much the gates hold with reinforcement, and the rest of the numbers. */
export const EQUIPMENT_EFFECT = {
  reinforced: { sectionHp: 1.3 },
  cellars: { startingGold: 90 },
  oil: { gateBurn: 26 },
  horn: { cardRecharge: 0.85 },
  watchfires: { enemySlow: 0.12 },
  garrison: { garrisonDps: 1.6 },
} as const;

export const EQUIPMENT: EquipmentDef[] = [
  {
    id: 'reinforced',
    name: 'Reinforced Gates',
    blurb: 'Every gate section holds 30% more before it falls.',
    cost: 40,
    icon: 'icon.shield',
  },
  {
    id: 'cellars',
    name: 'Deep Cellars',
    blurb: 'Start each battle with 4 more Ember.',
    cost: 35,
    icon: 'fx.ember',
  },
  {
    id: 'oil',
    name: 'Boiling Oil',
    blurb: 'Anything hacking at a gate section burns for 26 a second.',
    cost: 55,
    icon: 'fx.ember',
  },
  {
    id: 'horn',
    name: 'Signal Horn',
    blurb: 'Defender cards answer 15% sooner.',
    cost: 45,
    icon: 'fx.shockwave',
  },
  {
    id: 'watchfires',
    name: 'Watchfires',
    blurb: 'The horde comes on 12% slower. They can see you waiting.',
    cost: 50,
    icon: 'fx.spark',
  },
  {
    id: 'garrison',
    name: 'Keep Garrison',
    blurb: 'The garrison inside the keep shoots 60% harder at anything through the wall.',
    cost: 60,
    icon: 'icon.sword',
    premium: true,
  },
];

export const CONSUMABLES: ConsumableDef[] = [
  {
    id: 'oilbarrel',
    name: 'Barrel of Oil',
    blurb: 'Sets one lane alight. Heavy damage to everything standing in it.',
    cost: 18,
    icon: 'fx.ember',
    max: 3,
  },
  {
    id: 'repairkit',
    name: 'Field Repair Kit',
    blurb: 'Rebuilds a fallen section on the spot, for nothing.',
    cost: 22,
    icon: 'icon.hammer',
    max: 3,
  },
  {
    id: 'draught',
    name: "Warhorn Draught",
    blurb: 'Every defender strikes faster for 10 seconds.',
    cost: 16,
    icon: 'fx.shockwave',
    max: 3,
  },
];

export const EQUIPMENT_BY_ID = new Map(EQUIPMENT.map((e) => [e.id, e]));
export const CONSUMABLE_BY_ID = new Map(CONSUMABLES.map((c) => [c.id, c]));

/** How many pieces of equipment go into one battle. */
export const EQUIPMENT_SLOTS = 3;

export function equipment(id: string): EquipmentDef {
  const e = EQUIPMENT_BY_ID.get(id);
  if (!e) throw new Error(`unknown equipment ${id}`);
  return e;
}

export function consumable(id: string): ConsumableDef {
  const c = CONSUMABLE_BY_ID.get(id);
  if (!c) throw new Error(`unknown consumable ${id}`);
  return c;
}

/**
 * Salvage dragged off a won field: what was killed, how well the wall held,
 * and a bonus for the first time a fort is taken.
 */
export function salvageFor(opts: { kills: number; stars: number; firstClear: boolean }): number {
  return Math.round(opts.kills * 0.35 + opts.stars * 6 + (opts.firstClear ? 12 : 0));
}
