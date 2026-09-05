/**
 * Heroes and their tap-cast spells.
 *
 * Spells are the player's direct hand in the fight: everything else is
 * placement, this is reaction. Cooldowns only - no second currency to manage
 * on a phone screen.
 */
import type { HeroDef } from './types';

export const HEROES: HeroDef[] = [
  {
    id: 'aldric',
    name: 'Sir Aldric',
    title: 'Warden of the Last Gate',
    art: 'aldric',
    blurb: 'The last commander of the old order. He has held this wall before.',
    spells: [
      {
        id: 'smite',
        name: 'Holy Smite',
        blurb: 'Calls down a pillar of light. Heavy damage in a small circle.',
        icon: 'fx.holy_ring',
        target: 'point',
        cooldown: 12,
        damage: 320,
        radius: 170,
        effect: 'smite',
        fx: 'fx.holy_ring',
      },
      {
        id: 'rally',
        name: 'Rally',
        blurb: 'Defenders attack 60% faster and shrug off damage for 8 seconds.',
        icon: 'fx.shockwave',
        target: 'global',
        cooldown: 30,
        duration: 8,
        effect: 'rally',
        fx: 'fx.shockwave',
      },
    ],
  },
  {
    id: 'seraphina',
    name: 'Seraphina',
    title: 'The Stormcaller',
    art: 'seraphina',
    blurb: 'She came down from the storm to see the world kept. Crown Pack.',
    premium: true,
    spells: [
      {
        id: 'chain',
        name: 'Chain Lightning',
        blurb: 'Arcs between up to six enemies in a lane.',
        icon: 'fx.spark',
        target: 'lane',
        cooldown: 14,
        damage: 210,
        effect: 'chain',
        fx: 'fx.spark',
      },
      {
        id: 'blizzard',
        name: 'Blizzard',
        blurb: 'Freezes everything on the field for 5 seconds.',
        icon: 'fx.frost_ring',
        target: 'global',
        cooldown: 40,
        duration: 5,
        damage: 90,
        effect: 'freeze',
        fx: 'fx.frost_ring',
      },
    ],
  },
];

export const HERO_BY_ID = new Map(HEROES.map((h) => [h.id, h]));

export function hero(id: string): HeroDef {
  const h = HERO_BY_ID.get(id);
  if (!h) throw new Error(`unknown hero ${id}`);
  return h;
}
