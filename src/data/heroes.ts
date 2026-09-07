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
    /*
     * The Ashen Woods commander. Where Aldric holds a line, Bran breaks one
     * up: his spells move enemies about rather than deleting them, which
     * suits a region full of things that come at you in a rush.
     */
    id: 'bran',
    name: 'Bran Ironbark',
    title: 'Warden of the Ashen Woods',
    art: 'monk',
    blurb: 'Held the woods for eleven winters with a hundred men and no wall.',
    spells: [
      {
        id: 'rockfall',
        name: 'Rockfall',
        blurb: 'Drops the hillside on a lane. Heavy damage, and everything left is slowed.',
        icon: 'fx.shockwave',
        target: 'lane',
        cooldown: 16,
        damage: 240,
        duration: 4,
        effect: 'freeze',
        fx: 'fx.shockwave',
      },
      {
        id: 'warhorn',
        name: 'War Horn',
        blurb: 'Every defender strikes faster for 8 seconds.',
        icon: 'fx.shockwave',
        target: 'global',
        cooldown: 34,
        duration: 8,
        effect: 'rally',
        fx: 'fx.shockwave',
      },
    ],
  },
  {
    /*
     * Elarion's commander. The elves fight orcs by never being where the
     * orc swung, so her spells move her own line rather than the enemy's.
     */
    id: 'faelith',
    name: 'Faelith of Elarion',
    title: 'Warden of the Ashen Woods',
    art: 'elf_spellweaver',
    blurb: 'She watched the woods burn for a season and did not once break formation.',
    spells: [
      {
        id: 'arrowstorm',
        name: 'Arrow Storm',
        blurb: 'A volley down one lane. Light, but it lands on everything in it.',
        icon: 'fx.spark',
        target: 'lane',
        cooldown: 14,
        damage: 180,
        effect: 'chain',
        fx: 'fx.spark',
      },
      {
        id: 'quickstep',
        name: 'Quickstep',
        blurb: 'Every defender strikes faster and takes less for 8 seconds.',
        icon: 'fx.shockwave',
        target: 'global',
        cooldown: 28,
        duration: 8,
        effect: 'rally',
        fx: 'fx.shockwave',
      },
    ],
  },
  {
    /*
     * Sael's commander, and the only one who fights on water. Both his
     * spells are about the ground itself - freezing it, or taking it away.
     */
    id: 'nerion',
    name: 'Nerion of Sael',
    title: 'Tidewarden of the Drowned Coast',
    art: 'siren',
    blurb: 'He has drowned more of the horde than the whole Order has killed.',
    premium: true,
    spells: [
      {
        id: 'undertow',
        name: 'Undertow',
        blurb: 'Drags a lane back toward the water and holds it there.',
        icon: 'fx.frost_ring',
        target: 'lane',
        cooldown: 18,
        damage: 150,
        duration: 4,
        effect: 'freeze',
        fx: 'fx.frost_ring',
      },
      {
        id: 'springtide',
        name: 'Spring Tide',
        blurb: 'The sea comes up. Heavy damage to everything on the field.',
        icon: 'fx.frost_ring',
        target: 'global',
        cooldown: 42,
        damage: 220,
        effect: 'smite',
        fx: 'fx.frost_ring',
      },
    ],
  },
  {
    /*
     * The Abyss commander, and a Crown Pack one. Her spells are the answer to
     * a region of demons: holy where everything else has been steel.
     */
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
{
    /*
     * The last region's commander. By the throne there is no line left to
     * hold, so her spells are about buying seconds rather than winning ground.
     */
    id: 'maerwyn',
    name: 'Maerwyn the Grey',
    title: 'Last Voice of the Order',
    art: 'cleric',
    blurb: 'She buried the rest of the order. She intends to bury the King.',
    premium: true,
    spells: [
      {
        id: 'sanctuary',
        name: 'Sanctuary',
        blurb: 'Mends every defender on the field and shields them briefly.',
        icon: 'fx.holy_ring',
        target: 'global',
        cooldown: 30,
        duration: 4,
        effect: 'heal',
        fx: 'fx.holy_ring',
      },
      {
        id: 'wordofending',
        name: 'Word of Ending',
        blurb: 'Holy fire down one lane. Demons and the dead feel it worst.',
        icon: 'fx.holy_ring',
        target: 'lane',
        cooldown: 22,
        damage: 300,
        effect: 'smite',
        fx: 'fx.holy_ring',
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
