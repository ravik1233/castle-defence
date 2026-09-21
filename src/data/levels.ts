/**
 * Campaign structure and the wave generator.
 *
 * Levels declare a threat budget curve and an enemy pool rather than a hand
 * written list of spawns. The generator is seeded from the level id, so every
 * player fights exactly the same waves and balance changes are one number.
 */
import { GRID } from '../core/layout';
import { DEFENDERS } from './defenders';
import { enemy, familyOf } from './enemies';
import { showcaseEnemy } from './unlocks';
import { tilesFor } from './tiles';
import { DOCTRINE_EFFECT, doctrinesFor } from './doctrines';
import { LANE_ROLE_EFFECT, applyLaneRoles, laneRolesFor, lanesWith } from './laneRoles';
import type { ChapterDef, EnemyFamily, LevelDef, LevelModifiers } from './types';

/** Deterministic PRNG so generated waves are stable across devices. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** How much heavier than this fort's own horde a showcase may reach. */
const SHOWCASE_WEIGHT_MARGIN = 1.5;

export interface WaveEntry {
  enemyId: string;
  row: number;
  /** Seconds after the wave starts. */
  delay: number;
  /** Body size, for forts fought under a warband or a swarm. */
  scale?: number;
}

export interface Wave {
  index: number;
  entries: WaveEntry[];
  big: boolean;
  /** Seconds until the next wave is released. */
  duration: number;
}

/**
 * The regions of the continent: what is left of the human west, in the order
 * it falls back through.
 *
 * Each carries a commander and a muster. Crossing a border swaps the spells
 * the player fights with and hands them cards raised locally, so a region is
 * a change of hand rather than a change of wallpaper.
 */
/*
 * The continent, region by region.
 *
 * A region is one horde, one race holding the line against it, one
 * commander, and fifteen forts. The pool of enemies is not written out fort
 * by fort - it is drawn from the region's own family, widening as the region
 * goes on, so a region can never field something that belongs to another.
 */
const CHAPTER_META: Array<{
  id: number;
  name: string;
  biome: ChapterDef['biome'];
  /** Whose horde this is. Every fort here draws from it and nothing else. */
  family: EnemyFamily;
  /** Who holds this ground with you. Their units are the region's muster. */
  race: string;
  blurb: string;
  premium?: boolean;
  levels: number;
  names: string[];
  /** The commander of this horde, fought at the last fort. */
  boss: string;
  commander: string;
  unlocks: string[];
  map: { x: number; y: number };
}> = [
  {
    id: 1,
    name: 'The Broken Fields',
    biome: 'fields',
    family: 'goblin',
    race: 'Men of the Reach',
    commander: 'aldric',
    boss: 'goblin_king',
    unlocks: ['militia', 'dwarf_engineer', 'archer', 'barricade', 'guardian', 'frostmage', 'bombard', 'arbalest'],
    map: { x: 0.06, y: 0.66 },
    blurb: 'The goblins crossed the river at dawn. Everything east of here is gone.',
    levels: 15,
    names: [
      'First Light', 'The Mill Road', 'Broken Fences', 'Runners at Dusk', 'The Long Field',
      'Powder and Smoke', 'The Shield Line', 'Night Watch', 'The Thieving Hour', 'Wolfsong',
      'The Cut Bridge', 'Hobgoblin Vanguard', 'Under the Hill', 'The Warren Gate', 'Snagrat, King of Rags',
    ],
  },
  {
    id: 2,
    name: 'The Barrow Moors',
    biome: 'barrows',
    family: 'undead',
    race: 'Dwarves of Kar Duhrn',
    commander: 'bran',
    boss: 'necromancer',
    unlocks: ['dwarf_warrior', 'tithe', 'runesmith', 'gravewarden', 'dwarf_cannon'],
    map: { x: 0.205, y: 0.28 },
    blurb: 'The dead do not stay down here. The dwarves have held the barrows for eleven winters.',
    levels: 15,
    names: [
      'The Wet Ground', 'Bone Field', 'What the Rain Uncovered', 'The Second Rising', 'Ghoulmarch',
      'Ravens Over Kar Duhrn', 'The Long Barrow', 'Cold Iron', 'The Vampire of the Moor', 'Golem Work',
      'Where the Lich Waits', 'The Sunken Road', 'Nine Nights', 'The Barrow King', 'Malgrith the Necromancer',
    ],
  },
  {
    id: 3,
    name: 'The Ashen Woods',
    biome: 'woods',
    family: 'orc',
    race: 'Elves of Elarion',
    commander: 'faelith',
    boss: 'orc_warlord',
    unlocks: ['elf_ranger', 'elf_spellweaver', 'moonblade', 'treesinger', 'hawkkeeper'],
    map: { x: 0.35, y: 0.66 },
    blurb: 'They burned the forest to march through it. The elves have not forgiven it.',
    levels: 15,
    names: [
      'Under Black Branches', 'Emberfall', 'The War Drums', 'Bruteforce', 'Ash and Iron',
      'The Broken Canopy', 'Berserker Tide', 'The Sundered Grove', 'Trollbridge', 'The Long Retreat',
      'Elarion Gate', 'What the Fire Left', 'The Standing Stones', 'The Last Grove', 'Warlord Gorzak',
    ],
  },
  {
    id: 4,
    name: 'The Iron Highlands',
    biome: 'highland',
    family: 'beast',
    race: 'Wardens of the Green',
    commander: 'seraphina',
    boss: 'beastlord',
    premium: true,
    unlocks: ['warden', 'netcaster', 'houndmaster', 'ballista', 'standing_stone'],
    map: { x: 0.495, y: 0.28 },
    blurb: 'Something in the high country has stopped being afraid of us. Crown Pack.',
    levels: 15,
    names: [
      'The High Pass', 'Wolves at the Fold', 'Tusk and Stone', 'The Screaming Crag', 'Harpy Rocks',
      'Web and Bone', 'The Bear Road', 'Cairnwatch', 'The Long Howl', 'Where the Herds Went',
      'Stonefall', 'The Beast Pens', 'Antler Crown', 'The Old Hunt', 'Ursk the Beastlord',
    ],
  },
  {
    id: 5,
    name: 'The Drowned Coast',
    biome: 'coast',
    family: 'drowned',
    race: 'Tidewardens of Sael',
    commander: 'nerion',
    boss: 'tide_witch',
    premium: true,
    unlocks: ['harpooner', 'tidecaller', 'coral_ward', 'raftwright', 'deepwatch'],
    map: { x: 0.64, y: 0.66 },
    blurb: 'There is no field here. The water comes up to the wall, and things come up with it. Crown Pack.',
    levels: 15,
    names: [
      'The Tideline', 'Wrecks at Low Water', 'Crawlers on the Stone', 'Songs Under the Hull', 'The Raiding Tide',
      'Saltmarsh Gate', 'What the Nets Brought', 'The Deep Channel', 'Serpent Water', 'The Drowned Fleet',
      'Sael Harbour', 'Spring Tide', 'The Black Reef', 'The Last Pier', 'Nerelka, the Tide Witch',
    ],
  },
  {
    id: 6,
    name: 'The Fallen March',
    biome: 'abyss',
    family: 'fallen',
    race: 'The Order of the Last Gate',
    commander: 'garrick',
    boss: 'betrayer',
    premium: true,
    unlocks: ['cleric', 'monk', 'templar', 'shieldbreaker', 'reliquary'],
    map: { x: 0.785, y: 0.28 },
    blurb: 'These were our own knights. They knelt to him, and they kept their swords. Crown Pack.',
    levels: 15,
    names: [
      'The Turned Garrison', 'Cultsong', 'Crossbows on the Ridge', 'The Kneeling Field', 'Black Guard',
      'The Inquisitor', 'What They Swore', 'The Broken Oath', 'Chapterhouse', 'The Red Chapel',
      'Knights of the Pit', 'The Long Betrayal', 'Vayne\'s Banner', 'The Old Company', 'Sir Vayne, the Betrayer',
    ],
  },
  {
    id: 7,
    name: 'Throne of the Demon King',
    biome: 'throne',
    family: 'demon',
    race: 'Whoever Is Left',
    commander: 'maerwyn',
    boss: 'demon_king',
    premium: true,
    unlocks: ['warleader', 'sunspire', 'lastward', 'kingsguard', 'gatebreaker'],
    map: { x: 0.93, y: 0.62 },
    blurb: 'His own kind, at last, and his own ground. Everything you have learned is the price of entry. Crown Pack.',
    levels: 15,
    names: [
      'The Descent', 'Bone Halls', 'The Black Chorus', 'Hounds of the Pit', 'Portalfall',
      'The Long Siege', 'Where the Air Burns', 'The Balor', 'Throne Approach', 'The Kings Below',
      'Azrath, the Demon Prince', 'The Last Company', 'The King Rises', 'The Gate Itself', 'The Last Gate',
    ],
  },
];

/**
 * What a fort of this region fields.
 *
 * The family's own members, ordered by how much trouble they are, revealed a
 * few at a time so a region opens with its rank and file and ends with
 * everything it has. The commander never appears in the pool - it is fought
 * once, at the last fort.
 */
function poolFor(family: EnemyFamily, boss: string, index: number, total: number): string[] {
  const roster = familyOf(family)
    .filter((e) => e.id !== boss && e.special !== 'boss' && !e.specials?.includes('boss'))
    .sort((a, b) => a.threat - b.threat);
  if (!roster.length) return ['goblin'];
  /*
   * Widen slowly, then all at once at the end.
   *
   * A linear reveal adds the region's heaviest body around the halfway fort,
   * which doubles the pressure between one fort and the next - it reads as
   * the game breaking rather than tightening. Easing it means the big
   * arrivals land late, where the player is ready for them.
   */
  const progress = index / Math.max(1, total - 1);
  const share = Math.min(1, 0.45 + Math.pow(progress, 1.35) * 0.55);
  const shown = Math.max(2, Math.round(roster.length * share));
  /*
   * Drop the weakest as the region goes on, so late forts are not padded with
   * something the player stopped noticing ten forts ago - but one at a time,
   * and late. Dropping two at once used to halve a region's difficulty in a
   * single fort, which reads as the game breaking rather than relenting.
   */
  const from = index > total * 0.75 ? Math.min(1, roster.length - shown) : 0;
  return roster.slice(from, from + shown).map((e) => e.id);
}

/**
 * The rules and the ground one fort is fought on.
 *
 * Order matters here. The doctrines are settled first because a lane role is
 * not allowed to contradict one - a sally port in a fort that forbids
 * sorties would advertise a gate the player may not use - and the roles are
 * cut into the ground last, so a flooded gate stays flooded rather than
 * being handed back its dry cells by the terrain's own guarantees.
 */
function rulesFor(meta: (typeof CHAPTER_META)[number], i: number): LevelModifiers {
  const levelId = `c${meta.id}l${i + 1}`;
  const doctrines = doctrinesFor(meta.family, i, meta.id);
  const laneRoles = laneRolesFor(levelId, i, meta.id, doctrines);
  return {
    tiles: applyLaneRoles(tilesFor(levelId, meta.biome, i), laneRoles),
    doctrines,
    laneRoles,
  };
}

/**
 * The card this fort exists to give a job to, and what it puts in front of it.
 *
 * A showcase is simply the fort after a card arrived. Where several arrived
 * at once - the Crown Pack rides alongside the free cards in region 1 - the
 * free one is showcased, because a fort built around a card the player may
 * not own teaches them nothing.
 */
/**
 * What the player is told before they pick a deck.
 *
 * A showcase names what is coming and what it just handed them, and stops
 * there. It does not say "use the Archer": the fort is built so the new card
 * is the neat answer and two or three other answers still work, and a
 * briefing that gave the order would throw that away and turn a fort into a
 * tutorial step.
 */
function briefFor(f: {
  first: boolean;
  last: boolean;
  opening: boolean;
  waves: number;
  blurb: string;
  spotlight?: LevelDef['spotlight'];
}): string {
  if (f.first) return 'Goblin Grunts are testing the gate. Every kill releases Ember for reinforcements.';
  if (f.opening) return f.blurb;
  if (f.last) return 'Their commander is here. If the gate falls, there is nothing behind it.';
  if (f.spotlight?.enemy) {
    const card = DEFENDERS.find((d) => d.id === f.spotlight!.card);
    const foe = enemy(f.spotlight.enemy);
    if (card) return `${foe.name}s in numbers. The ${card.name} you just raised has an answer - it is not the only one.`;
  }
  return `Hold the gate. Wave ${f.waves} is the last.`;
}

function spotlightFor(
  global: number,
  meta: (typeof CHAPTER_META)[number],
  pool: string[],
): LevelDef['spotlight'] {
  const arrived = DEFENDERS.filter((d) => d.unlockLevel === global - 1);
  if (!arrived.length) return undefined;
  const card = arrived.find((d) => !d.premium) ?? arrived[0]!;
  /*
   * Chosen from the region's whole horde rather than from this fort's
   * current pool, because a showcase is allowed to *introduce* the thing it
   * teaches - and usually has to. The pool widens slowly over a region, so
   * asking it for a flyer at fort four gets you the heaviest footsoldier
   * instead and the Archer's own fort teaches nothing about shooting up.
   */
  const roster = familyOf(meta.family).filter(
    (e) => e.id !== meta.boss && e.special !== 'boss' && !e.specials?.includes('boss'),
  );
  /*
   * A lesson may be half again as heavy as the fort's current top body, and
   * no heavier.
   *
   * The margin is what lets a showcase teach at all: the Archer's fort needs
   * the Goblin Glider, which is 1.3x the heaviest thing the Broken Fields
   * field by then, and with no margin it fell back to a plain Grunt and
   * taught nothing about shooting upward. Two and a bit times, on the other
   * hand, is a Balor in the Throne's second fort. The line sits between.
   */
  const ceiling = Math.max(...pool.map((id) => enemy(id).threat)) * SHOWCASE_WEIGHT_MARGIN;
  return { card: card.id, enemy: showcaseEnemy(card, roster, ceiling) };
}

function buildLevel(
  chapterIdx: number,
  meta: (typeof CHAPTER_META)[number],
  i: number,
): LevelDef {
  const global = CHAPTER_META.slice(0, chapterIdx).reduce((n, c) => n + c.levels, 0) + i + 1;
  const last = i === meta.levels - 1;
  const first = global === 1;
  const waves = first ? 3 : 6 + Math.min(7, Math.floor(i * 0.5)) + (last ? 2 : 0);
  const tier = chapterIdx;
  const pool = first ? ['goblin'] : poolFor(meta.family, meta.boss, i, meta.levels);
  const spotlight = first || global === 2 ? undefined : spotlightFor(global, meta, pool);
  // A fort that teaches a card against an enemy the region has not shown yet
  // brings that enemy forward. This is the only way the pool ever widens out
  // of order, and it is the point: the lesson arrives with its subject.
  if (spotlight?.enemy && !pool.includes(spotlight.enemy)) pool.push(spotlight.enemy);
  return {
    id: `c${meta.id}l${i + 1}`,
    chapter: meta.id,
    index: i + 1,
    name: meta.names[i] ?? `Wave ${i + 1}`,
    biome: meta.biome,
    waves,
    budgetStart: first ? 1.4 : 8 + i * 2.2 + tier * 5,
    budgetGrowth: first ? 1.12 : 1.22 + tier * 0.02,
    pool,
    boss: last ? meta.boss : undefined,
    spotlight,
    // Five Ember buys two Militia with one point of breathing room.
    startingGold: first ? 125 : 165 + Math.min(90, i * 7) + tier * 18,
    reward: 120 + i * 30 + tier * 90 + (last ? 400 : 0),
    premium: meta.premium,
    brief: briefFor({ first, last, opening: i === 0, waves, blurb: meta.blurb, spotlight }),
    /*
     * Every fort is fought on its own ground. The tutorial is the exception:
     * it is flat, because the first thing a player learns should not be an
     * exception to a rule they have not been told yet.
     */
    modifiers:
      first
        ? { fixedDeck: ['militia'], hpScale: 0.7, waitForClear: true }
        : global === 2
          ? { fixedDeck: ['militia', 'dwarf_engineer'], tiles: tilesFor('c1l2', meta.biome, i) }
        : rulesFor(meta, i),
  };
}

export const CHAPTERS: ChapterDef[] = CHAPTER_META.map((meta, ci) => ({
  id: meta.id,
  name: meta.name,
  biome: meta.biome,
  family: meta.family,
  race: meta.race,
  blurb: meta.blurb,
  premium: meta.premium,
  commander: meta.commander,
  unlocks: meta.unlocks,
  map: meta.map,
  levels: Array.from({ length: meta.levels }, (_, i) => buildLevel(ci, meta, i)),
}));

export const ALL_LEVELS: LevelDef[] = CHAPTERS.flatMap((c) => c.levels);
export const LEVEL_BY_ID = new Map(ALL_LEVELS.map((l) => [l.id, l]));

export function level(id: string): LevelDef {
  const l = LEVEL_BY_ID.get(id);
  if (!l) throw new Error(`unknown level ${id}`);
  return l;
}

/** 1-based campaign position, used for card unlocks. */
export function levelNumber(id: string): number {
  return ALL_LEVELS.findIndex((l) => l.id === id) + 1;
}

/**
 * Builds the full wave list for a level.
 *
 * Each wave spends a threat budget on the level's enemy pool, spreading spawns
 * across rows and time. Every fifth wave is a "big" wave with extra budget and
 * a warning banner; the final wave of a chapter adds its boss.
 */
export function generateWaves(def: LevelDef): Wave[] {
  /*
   * First Light is a hand-authored lesson: one familiar enemy, new lanes
   * revealed one at a time, and enough kills to fund the next Militia. Each
   * wave clears before the next muster so the lesson cannot silently stack
   * all of its pressure while the first Grunts are still crossing the field.
   */
  if (def.id === 'c1l1') {
    return [
      {
        index: 0,
        big: false,
        duration: 12,
        entries: [
          { enemyId: 'goblin', row: 2, delay: 1 },
          { enemyId: 'goblin', row: 1, delay: 5 },
        ],
      },
      {
        index: 1,
        big: false,
        duration: 14,
        entries: [
          { enemyId: 'goblin', row: 2, delay: 1 },
          { enemyId: 'goblin', row: 1, delay: 4.5 },
          { enemyId: 'goblin', row: 3, delay: 8 },
        ],
      },
      {
        index: 2,
        big: false,
        duration: 16,
        entries: [1, 2, 3, 2].map((row, i) => ({ enemyId: 'goblin', row, delay: 1 + i * 3.2 })),
      },
    ];
  }
  const rand = mulberry32(hashString(def.id));
  const waves: Wave[] = [];

  for (let w = 0; w < def.waves; w += 1) {
    const big = (w + 1) % 5 === 0 || w === def.waves - 1;
    const finale = w === def.waves - 1;
    let budget = def.budgetStart * Math.pow(def.budgetGrowth, w) * (big ? 1.55 : 1);

    /*
     * A showcase fort has to actually show the thing.
     *
     * Waves are spent on whatever the budget can afford, biased to the
     * strongest - which is emergent and good, and also means a fort built to
     * teach the Archer can roll six waves of ground troops and teach nothing
     * at all. So the spotlight enemy is taken out of the budget first, before
     * a single ordinary spawn is chosen, and only what is left is spent the
     * usual way. It is a reservation, not an addition: the fort stays worth
     * what its budget says it is worth.
     */
    const spotlit = def.spotlight?.enemy ? enemy(def.spotlight.enemy) : undefined;
    const spotlitCount = spotlit ? (big ? 3 : 2) : 0;
    const reserved = spotlit ? Math.min(budget * 0.6, spotlit.threat * spotlitCount) : 0;
    budget -= reserved;

    /*
     * A warband is half as many at twice the size; a swarm is the reverse.
     * The budget is the same either way - what changes is whether the answer
     * is one heavy blow or something that hits a whole lane.
     */
    const doctrines = def.modifiers?.doctrines ?? [];
    const bodyScale = doctrines.includes('warband')
      ? DOCTRINE_EFFECT.warbandSize
      : doctrines.includes('swarm')
        ? DOCTRINE_EFFECT.swarmSize
        : 1;
    const entries: WaveEntry[] = [];
    // Later enemies in the pool only appear once the budget can carry them.
    const pool = def.pool.map(enemy).sort((a, b) => a.threat - b.threat);
    /*
     * Bigger bodies walk in over a longer window and smaller ones flood.
     * A warband is meant to be heavy blows arriving steadily - packed into
     * the same seconds as a normal wave it stops being a different shape of
     * fight and becomes simply an unpayable one.
     */
    const spawnWindow = Math.min(26, (9 + w * 1.1) * Math.sqrt(bodyScale));

    /**
     * A wave picks two or three featured enemy types up front and then spends
     * its budget across them. Choosing per-spawn instead produced waves of one
     * repeated enemy, which is what made the early game feel empty.
     */
    const affordableNow = pool.filter((e) => e.threat <= budget + 0.6);
    const featured: typeof pool = [];
    if (affordableNow.length > 0) {
      // The headline enemy is the strongest the budget allows...
      featured.push(affordableNow[affordableNow.length - 1]!);
      // ...backed by cheaper types so the lane reads as a mixed horde.
      const rest = affordableNow.slice(0, -1);
      const wanted = Math.min(rest.length, budget > 8 ? 2 : 1);
      for (let i = 0; i < wanted; i += 1) {
        const pick = rest.splice(Math.floor(rand() * rest.length), 1)[0];
        if (pick) featured.push(pick);
      }
    }

    // A wave is a crowd, not a mob: past this the lane is unreadable and the
    // frame rate suffers, so remaining budget is simply dropped.
    const MAX_SPAWNS_PER_WAVE = 28;

    let guard = 0;
    let previous = '';
    while (budget > 0 && guard < 200 && entries.length < MAX_SPAWNS_PER_WAVE) {
      guard += 1;
      const affordable = featured.filter((e) => e.threat <= budget + 0.6);
      if (affordable.length === 0) break;
      // Weighted by threat, so a big budget buys tougher enemies rather than
      // an unmanageable number of cheap ones.
      const total = affordable.reduce((n, e) => n + e.threat, 0);
      let roll = rand() * total;
      let pick = affordable[affordable.length - 1]!;
      for (const candidate of affordable) {
        roll -= candidate.threat;
        if (roll <= 0) {
          pick = candidate;
          break;
        }
      }
      // Avoid long runs of the same enemy when there is a choice.
      if (pick.id === previous && affordable.length > 1) {
        pick = affordable.filter((e) => e.id !== previous)[
          Math.floor(rand() * (affordable.length - 1))
        ]!;
      }
      previous = pick.id;
      // A body that is twice the size costs the wave twice as much, so the
      // horde's weight is the same and only its shape changes.
      budget -= pick.threat * bodyScale;
      entries.push({
        enemyId: pick.id,
        row: Math.floor(rand() * GRID.rows),
        delay: rand() * spawnWindow,
        scale: bodyScale === 1 ? undefined : bodyScale,
      });
    }

    /*
     * The reserved spawns, spread down the lanes rather than stacked in one,
     * so the lesson is "these are in the sky" and not "lane three is lost".
     */
    if (spotlit) {
      for (let n = 0; n < spotlitCount; n += 1) {
        entries.push({
          enemyId: spotlit.id,
          row: Math.floor(rand() * GRID.rows),
          delay: rand() * spawnWindow,
          scale: bodyScale === 1 ? undefined : bodyScale,
        });
      }
    }

    /*
     * A rich seam is paid for in bodies. The extra is added after the budget
     * is spent rather than taken out of it, because the whole trade is that
     * the lane is worth more Ember *and* more dangerous - if it came out of
     * the wave's own budget the lane would be free money.
     */
    for (const row of lanesWith(def.modifiers?.laneRoles, 'seam')) {
      const drawn = pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
      for (let n = 0; n < LANE_ROLE_EFFECT.seamExtraPerWave && drawn; n += 1) {
        entries.push({ enemyId: drawn.id, row, delay: rand() * spawnWindow, scale: bodyScale === 1 ? undefined : bodyScale });
      }
    }

    if (finale && def.boss) {
      const bossDef = enemy(def.boss);
      entries.push({
        enemyId: bossDef.id,
        row: Math.floor(GRID.rows / 2),
        delay: bossDef.special === 'boss' ? 6 : 3,
      });
    }

    entries.sort((a, b) => a.delay - b.delay);
    const lastDelay = entries.length ? entries[entries.length - 1]!.delay : 0;
    waves.push({
      index: w,
      entries,
      big,
      duration: Math.max(14, lastDelay + (big ? 16 : 10)),
    });
  }
  return waves;
}

/** Total threat of a level - used by the level select to show difficulty. */
export function levelThreat(def: LevelDef): number {
  return generateWaves(def).reduce(
    (sum, w) => sum + w.entries.reduce((s, e) => s + enemy(e.enemyId).threat, 0),
    0,
  );
}
