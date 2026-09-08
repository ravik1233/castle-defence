/**
 * What this fort demands that the last one did not.
 *
 * A hundred and five forts that differ only in what is walking at you are a
 * hundred and five of the same decision. A doctrine is a rule that changes
 * how the fort has to be played: the gate is already open, or the night is
 * dark and nothing shoots far, or fallen enemies release no Ember. It is
 * declared before the player picks a deck, because a rule you
 * discover at wave four is not strategy, it is a surprise.
 *
 * Doctrines are drawn from the fort's own id, so every player meets the same
 * demand at the same fort, and weighted by region, so the country and the
 * horde and the rule tend to agree with each other.
 */
import type { EnemyFamily } from './types';

export type DoctrineId =
  | 'breached'
  | 'night'
  | 'forcedmarch'
  | 'noquarter'
  | 'frozenground'
  | 'bombardment'
  | 'warband'
  | 'swarm'
  | 'sappers'
  | 'thinsupply'
  | 'standingorders'
  | 'holdtheline';

export interface DoctrineDef {
  id: DoctrineId;
  name: string;
  /** What it does, in the words the player is given before they commit. */
  blurb: string;
  /** The counter-play, so the briefing teaches rather than only warns. */
  answer: string;
}

export const DOCTRINES: Record<DoctrineId, DoctrineDef> = {
  breached: {
    id: 'breached',
    name: 'Breached Gate',
    blurb: 'One lane is already open. They walk straight into the courtyard.',
    answer: 'Rebuild it early, or hold the gap with something that can take a hit.',
  },
  night: {
    id: 'night',
    name: 'Night Assault',
    blurb: 'Nobody can see far. Every defender shoots a quarter shorter.',
    answer: 'Melee and traps do not care how dark it is.',
  },
  forcedmarch: {
    id: 'forcedmarch',
    name: 'Forced March',
    blurb: 'They come on fast: every muster is half as long.',
    answer: 'Cheap bodies early beat an expensive line you never finish paying for.',
  },
  noquarter: {
    id: 'noquarter',
    name: 'No Quarter',
    blurb: 'Fallen enemies release no Ember.',
    answer: 'Bring a Miner or extra starting Ember, then spend carefully.',
  },
  frozenground: {
    id: 'frozenground',
    name: 'Frozen Ground',
    blurb: 'Ember veins are frozen and cannot be mined.',
    answer: 'Rely on kill Ember and the reserve you brought with you.',
  },
  bombardment: {
    id: 'bombardment',
    name: 'Bombardment',
    blurb: 'Their engines never stop. Every wave batters the wall from out of reach.',
    answer: 'Repairs, and a lane you have not left thin.',
  },
  warband: {
    id: 'warband',
    name: 'Warband',
    blurb: 'Half as many, twice the size. Chip damage will not do it.',
    answer: 'Burst, armour-piercing, and anything that hits hard once.',
  },
  swarm: {
    id: 'swarm',
    name: 'Swarm',
    blurb: 'Twice as many, half the size. They come in a wall of bodies.',
    answer: 'Splash, pierce, and something that hits a whole lane at once.',
  },
  sappers: {
    id: 'sappers',
    name: 'Sappers',
    blurb: 'They came for the gate itself, and hit it twice as hard.',
    answer: 'Kill them before they arrive; a repair kit is worth its salvage here.',
  },
  thinsupply: {
    id: 'thinsupply',
    name: 'Thin Supply',
    blurb: 'The road is cut. Every card costs a quarter more.',
    answer: 'Protect Ember veins, make fewer placements, and spend carefully.',
  },
  standingorders: {
    id: 'standingorders',
    name: 'Standing Orders',
    blurb: 'One of your own cards is spoken for elsewhere and cannot be played here.',
    answer: 'Whatever you were leaning on, lean on something else.',
  },
  holdtheline: {
    id: 'holdtheline',
    name: 'Hold the Line',
    blurb: 'No selling, and no sorties. What you put down is what you have.',
    answer: 'Place slowly. Nothing here can be taken back.',
  },
};

/** How much each rule bites, in one place so the briefing cannot lie. */
export const DOCTRINE_EFFECT = {
  nightRange: 0.75,
  forcedMarchMuster: 0.5,
  thinSupplyCost: 1.25,
  sapperWallDamage: 2,
  warbandCount: 0.5,
  warbandSize: 2,
  swarmCount: 2,
  swarmSize: 0.5,
} as const;

/**
 * Which rules suit which country and which horde.
 *
 * These five are a region's signature - the thing its horde is known for.
 * Two more are drawn from everything else, so a region has a character
 * without having only five ideas across fifteen forts.
 */
const BY_FAMILY: Record<EnemyFamily, DoctrineId[]> = {
  goblin: ['swarm', 'forcedmarch', 'thinsupply', 'standingorders', 'breached'],
  undead: ['night', 'noquarter', 'frozenground', 'warband', 'holdtheline'],
  orc: ['warband', 'sappers', 'breached', 'bombardment', 'forcedmarch'],
  beast: ['swarm', 'night', 'forcedmarch', 'standingorders', 'holdtheline'],
  drowned: ['thinsupply', 'frozenground', 'sappers', 'noquarter', 'breached'],
  fallen: ['warband', 'bombardment', 'standingorders', 'holdtheline', 'night'],
  demon: ['bombardment', 'breached', 'sappers', 'warband', 'noquarter'],
};

const ALL: DoctrineId[] = Object.keys(DOCTRINES) as DoctrineId[];

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * The order a region deals its rules out in.
 *
 * Drawing each fort's rule independently sounds fair and plays badly: over
 * fifteen forts the same rule lands five or six times by pure chance, and a
 * region that is "the frozen one" seven forts running is one idea, not
 * fifteen. So a region deals from a deck instead. The first pass is its five
 * signature rules alone, so a player arriving in a country learns what that
 * horde is known for; after that two rules borrowed from elsewhere are
 * shuffled in, so the back half of a region can still surprise someone who
 * thinks they have it read.
 *
 * No rule repeats until the rest of the deck has been dealt, and each pass
 * is shuffled separately, so going round again is not the same run again.
 */
function orderFor(family: EnemyFamily): DoctrineId[] {
  const signature = BY_FAMILY[family];
  const seed = hash(`${family}:deck`);
  const rest = ALL.filter((d) => !signature.includes(d));
  const wild = [...new Set([rest[seed % rest.length]!, rest[(seed >>> 7) % rest.length]!])];
  const full = [...signature, ...wild];
  const passes = [
    shuffle(signature, hash(`${family}:pass:0`)),
    shuffle(full, hash(`${family}:pass:1`)),
    shuffle(full, hash(`${family}:pass:2`)),
  ];
  const out: DoctrineId[] = [];
  for (const pass of passes) {
    // A shuffled pass can open on the rule the last one closed with; a
    // single rotation is enough to keep two forts running from matching.
    if (out.length && pass[0] === out[out.length - 1]) pass.push(pass.shift()!);
    out.push(...pass);
  }
  return out;
}

/** Fisher-Yates against a seeded stream, so every player is dealt the same hand. */
function shuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * The rules this fort is fought under.
 *
 * The first forts of the campaign have none - a player learning which way
 * the enemies walk does not also need a rule about it. After that a fort
 * carries one, and the hard end of a region carries two.
 */
export function doctrinesFor(family: EnemyFamily, index: number, chapter: number): DoctrineId[] {
  // The opening of the whole game is taught, not tested.
  if (chapter === 1 && index < 3) return [];
  const deck = orderFor(family);
  // The region's forts eat the deck in order, so a fort that poses two rules
  // takes two cards rather than peeking at a neighbour's. Without this the
  // second rule is drawn from the same few places every time and one rule
  // ends up carrying a third of the region.
  let cursor = 0;
  for (let i = 0; i < index; i += 1) cursor += ruleCount(i, chapter);
  const first = deck[cursor % deck.length]!;
  if (ruleCount(index, chapter) === 1) return [first];
  for (let step = 1; step < deck.length; step += 1) {
    const next = deck[(cursor + step) % deck.length]!;
    if (next !== first && !cancels(first, next)) return [first, next];
  }
  return [first];
}

/** How many rules a fort carries: none while the game is teaching, two at the hard end. */
function ruleCount(index: number, chapter: number): number {
  if (chapter === 1 && index < 3) return 0;
  return index >= 9 && index % 2 === 1 ? 2 : 1;
}

/** Rules that would undo each other, and so are never set together. */
function cancels(a: DoctrineId, b: DoctrineId): boolean {
  const pairs: Array<[DoctrineId, DoctrineId]> = [
    ['warband', 'swarm'],
    ['noquarter', 'frozenground'],
  ];
  return pairs.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
}
