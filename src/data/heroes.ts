/**
 * Commanders and the spells they ride with.
 *
 * Spells are the player's direct hand in the fight: everything else is
 * placement, this is reaction. Cooldowns only - no second currency to manage
 * on a phone screen.
 *
 * A commander carries four and takes two into a fort. That is the whole
 * decision: they used to carry exactly two, which meant the hand was the
 * commander and there was nothing to choose. Four is enough that a fort's
 * doctrines and lane roles can make one pair better than another - a
 * Sanctuary against a bombardment, a Word of Ending against something that
 * keeps getting back up - and few enough that a player can hold all four in
 * their head.
 *
 * Every spell is built from the five effects the battle already implements
 * (smite, chain, freeze, heal, rally). What makes them different is what
 * they are pointed at, what they cost in seconds, and what they are worth
 * when they land - not new combat code.
 */
import { spellIconKey } from '../art/spells';
import type { HeroDef, SpellDef } from './types';

type Seed = Omit<SpellDef, 'icon'>;

/** Turns the table below into spells, deriving each sigil from its own id. */
const spell = (s: Seed): SpellDef => ({ ...s, icon: spellIconKey(s.id) });

const ROSTERS: Record<string, Seed[]> = {
  /*
   * Aldric holds. Everything he has is about a line staying where it is: a
   * pillar on whatever broke through, a shout to keep the rest swinging, a
   * roof over the whole wall, and one lance for the thing he cannot reach.
   */
  aldric: [
    { id: 'smite', name: 'Holy Smite', blurb: 'Calls down a pillar of light. Heavy damage in a small circle.',
      motif: 'sunburst', tone: 'holy', target: 'point', cooldown: 12, damage: 27, radius: 170, effect: 'smite', fx: 'fx.holy_ring' },
    { id: 'rally', name: 'Rally', blurb: 'Defenders attack 60% faster and shrug off damage for 8 seconds.',
      motif: 'banner', tone: 'holy', target: 'global', cooldown: 30, duration: 8, effect: 'rally', fx: 'fx.shockwave' },
    { id: 'bulwark', name: 'Bulwark', blurb: 'A roof of light over the whole wall. Your line is mended and takes less for 5 seconds.',
      motif: 'dome', tone: 'holy', target: 'global', cooldown: 32, duration: 5, damage: 14, effect: 'heal', fx: 'fx.holy_ring' },
    { id: 'lanceoflight', name: 'Lance of Light', blurb: 'One shaft of light down a lane, passing through everything in it.',
      motif: 'bolt', tone: 'holy', target: 'lane', cooldown: 16, damage: 16, effect: 'chain', fx: 'fx.holy_ring' },
  ],

  /*
   * Bran breaks a rush up rather than deleting it - the Barrow Moors come at
   * you in a mass, and a lane that is slowed is a lane your own line can
   * finish.
   */
  bran: [
    { id: 'rockfall', name: 'Rockfall', blurb: 'Drops the hillside on a lane. Heavy damage, and everything left is slowed.',
      motif: 'boulder', tone: 'stone', target: 'lane', cooldown: 16, damage: 20, duration: 4, effect: 'freeze', fx: 'fx.shockwave' },
    { id: 'warhorn', name: 'War Horn', blurb: 'The horn of Kar Duhrn. Your line swings faster and harder for 8 seconds.',
      motif: 'horn', tone: 'stone', target: 'global', cooldown: 34, duration: 8, effect: 'rally', fx: 'fx.shockwave' },
    { id: 'stonefast', name: 'Stonefast', blurb: 'Dwarf-work on every wall at once: the line is mended and hardened for 5 seconds.',
      motif: 'shieldwall', tone: 'stone', target: 'global', cooldown: 34, duration: 5, damage: 16, effect: 'heal', fx: 'fx.shockwave' },
    { id: 'emberforge', name: 'Ember Forge', blurb: 'A forge-blast on one spot. Burns hot enough to go through plate.',
      motif: 'hammer', tone: 'flame', target: 'point', cooldown: 15, damage: 24, radius: 150, effect: 'smite', fx: 'fx.ember' },
  ],

  /*
   * Faelith fights a wood, not a wall. Hers slow, scatter and keep her own
   * people moving - the Ashen Woods answer is never to stand still.
   */
  faelith: [
    { id: 'arrowstorm', name: 'Arrow Storm', blurb: 'A volley down one lane. Every body in it takes a shaft.',
      motif: 'arrows', tone: 'life', target: 'lane', cooldown: 14, damage: 15, effect: 'chain', fx: 'fx.spark' },
    { id: 'quickstep', name: 'Quickstep', blurb: 'The wood lends its speed. Everything of yours acts faster for 8 seconds.',
      motif: 'dash', tone: 'life', target: 'global', cooldown: 28, duration: 8, effect: 'rally', fx: 'fx.shockwave' },
    { id: 'thornsnare', name: 'Thornsnare', blurb: 'Thorns come up across a lane. What is caught bleeds and barely moves.',
      motif: 'net', tone: 'life', target: 'lane', cooldown: 17, damage: 12, duration: 5, effect: 'freeze', fx: 'fx.spark' },
    { id: 'greenmend', name: 'Greenmend', blurb: 'Elarion closes what was opened. The whole line is mended.',
      motif: 'chalice', tone: 'life', target: 'global', cooldown: 30, duration: 4, damage: 18, effect: 'heal', fx: 'fx.heal' },
  ],

  /*
   * Nerion buys time with water. Nothing of his kills quickly; everything of
   * his means the thing arrives later and in worse order than it meant to.
   */
  nerion: [
    { id: 'undertow', name: 'Undertow', blurb: 'The sea takes a lane out from under them. Damage, and what stands is dragged.',
      motif: 'wave', tone: 'tide', target: 'lane', cooldown: 18, damage: 12, duration: 4, effect: 'freeze', fx: 'fx.frost_ring' },
    { id: 'springtide', name: 'Spring Tide', blurb: 'The whole coast rises at once. Everything on the field takes it.',
      motif: 'tide', tone: 'tide', target: 'global', cooldown: 42, damage: 18, effect: 'smite', fx: 'fx.frost_ring' },
    { id: 'harpoonvolley', name: 'Harpoon Volley', blurb: 'Sael irons down one lane, through one body into the next.',
      motif: 'arrows', tone: 'tide', target: 'lane', cooldown: 15, damage: 17, effect: 'chain', fx: 'fx.spark' },
    { id: 'deepcalm', name: 'Deep Calm', blurb: 'Still water over the whole fort. Your line is mended and steadied.',
      motif: 'chalice', tone: 'tide', target: 'global', cooldown: 31, duration: 4, damage: 16, effect: 'heal', fx: 'fx.heal' },
  ],

  /*
   * Seraphina is the only commander whose answer to everything is more of
   * it. Hers are the widest and the slowest to come back.
   */
  seraphina: [
    { id: 'chain', name: 'Chain Lightning', blurb: 'Jumps from body to body down a lane.',
      motif: 'bolt', tone: 'storm', target: 'lane', cooldown: 14, damage: 18, effect: 'chain', fx: 'fx.spark' },
    { id: 'blizzard', name: 'Blizzard', blurb: 'The whole field freezes. Everything slows, and keeps taking cold.',
      motif: 'snowflake', tone: 'frost', target: 'global', cooldown: 40, duration: 5, damage: 8, effect: 'freeze', fx: 'fx.frost_ring' },
    { id: 'thunderclap', name: 'Thunderclap', blurb: 'One crack of air on one spot. Wide, and it does not care about armour.',
      motif: 'sunburst', tone: 'storm', target: 'point', cooldown: 14, damage: 23, radius: 200, effect: 'smite', fx: 'fx.shockwave' },
    { id: 'stormward', name: 'Stormward', blurb: 'A charged sky over the fort. The line is mended and shielded for 4 seconds.',
      motif: 'dome', tone: 'storm', target: 'global', cooldown: 33, duration: 4, damage: 15, effect: 'heal', fx: 'fx.shockwave' },
  ],

  /*
   * Garrick came off the Fallen March, where the enemy is men in plate. His
   * are single heavy blows and the discipline to survive theirs.
   */
  garrick: [
    { id: 'breakingblow', name: 'Breaking Blow', blurb: 'One blow on one spot, hard enough to open armour.',
      motif: 'hammer', tone: 'shadow', target: 'point', cooldown: 18, damage: 22, radius: 180, effect: 'smite', fx: 'fx.shockwave' },
    { id: 'closeranks', name: 'Close Ranks', blurb: 'The March closes up. Your line is mended and holds for 5 seconds.',
      motif: 'shieldwall', tone: 'shadow', target: 'global', cooldown: 34, duration: 5, damage: 18, effect: 'heal', fx: 'fx.holy_ring' },
    { id: 'sundering', name: 'Sundering', blurb: 'Runs the length of a lane, splitting shields as it goes.',
      motif: 'bolt', tone: 'shadow', target: 'lane', cooldown: 16, damage: 19, effect: 'chain', fx: 'fx.shadowbolt' },
    { id: 'nofalter', name: 'No Falter', blurb: 'Nobody steps back. Everything of yours strikes faster for 7 seconds.',
      motif: 'banner', tone: 'shadow', target: 'global', cooldown: 32, duration: 7, effect: 'rally', fx: 'fx.shockwave' },
  ],

  /*
   * Maerwyn is the last of the order, and it shows: two of hers are mercies
   * and two are endings. Against the Throne both are needed.
   */
  maerwyn: [
    { id: 'sanctuary', name: 'Sanctuary', blurb: 'Holy ground over the whole fort. Your line is mended and blunted against.',
      motif: 'dome', tone: 'shadow', target: 'global', cooldown: 30, duration: 4, damage: 16, effect: 'heal', fx: 'fx.holy_ring' },
    { id: 'wordofending', name: 'Word of Ending', blurb: 'One word down a lane. What it names does not get back up.',
      motif: 'rune', tone: 'shadow', target: 'lane', cooldown: 22, damage: 25, effect: 'smite', fx: 'fx.holy_ring' },
    { id: 'greyveil', name: 'Grey Veil', blurb: 'A grey comes over the field. Everything in it slows and forgets its hurry.',
      motif: 'moon', tone: 'shadow', target: 'global', cooldown: 38, duration: 5, damage: 9, effect: 'freeze', fx: 'fx.frost_ring' },
    { id: 'lastrite', name: 'Last Rite', blurb: 'The order says its own words. Your line swings faster for 7 seconds.',
      motif: 'flame', tone: 'holy', target: 'global', cooldown: 31, duration: 7, effect: 'rally', fx: 'fx.holy_ring' },
  ],
};

export const HEROES: HeroDef[] = [
  {
    id: 'aldric',
    name: 'Sir Aldric',
    title: 'Warden of the Last Gate',
    art: 'aldric',
    blurb: 'The last commander of the old order. He has held this wall before.',
    spells: ROSTERS.aldric!.map(spell),
  },
  {
    id: 'bran',
    name: 'Bran Ironbark',
    title: 'Hearthwarden of Kar Duhrn',
    art: 'bran',
    blurb: 'Held the woods for eleven winters with a hundred men and no wall.',
    spells: ROSTERS.bran!.map(spell),
  },
  {
    id: 'faelith',
    name: 'Faelith of Elarion',
    title: 'Warden of the Ashen Woods',
    art: 'faelith',
    blurb: 'She has buried more of her own than the Reach ever mustered.',
    spells: ROSTERS.faelith!.map(spell),
  },
  {
    id: 'nerion',
    name: 'Nerion of Sael',
    title: 'Tidewarden of the Drowned Coast',
    art: 'nerion',
    blurb: 'Keeps the sea on his side of the argument, most days.',
    spells: ROSTERS.nerion!.map(spell),
  },
  {
    id: 'seraphina',
    name: 'Seraphina',
    title: 'The Stormcaller',
    art: 'seraphina',
    blurb: 'Came down off the highland with the weather behind her.',
    spells: ROSTERS.seraphina!.map(spell),
  },
  {
    id: 'garrick',
    name: 'Ser Garrick Vane',
    title: 'Marshal of the Fallen March',
    art: 'garrick',
    blurb: 'Fought the men he trained. Does not speak about it.',
    spells: ROSTERS.garrick!.map(spell),
  },
  {
    id: 'maerwyn',
    name: 'Maerwyn the Grey',
    title: 'Last Voice of the Order',
    art: 'maerwyn',
    blurb: 'The order is one woman now, and she is at the Throne.',
    spells: ROSTERS.maerwyn!.map(spell),
  },
];

export const HERO_BY_ID = new Map(HEROES.map((h) => [h.id, h]));

export function hero(id: string): HeroDef {
  const h = HERO_BY_ID.get(id);
  if (!h) throw new Error(`unknown hero ${id}`);
  return h;
}

/** Every spell in the game, for the ledger and for building their sigils. */
export const ALL_SPELLS: SpellDef[] = HEROES.flatMap((h) => h.spells);
