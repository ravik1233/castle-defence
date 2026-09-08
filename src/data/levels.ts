/**
 * Campaign structure and the wave generator.
 *
 * Levels declare a threat budget curve and an enemy pool rather than a hand
 * written list of spawns. The generator is seeded from the level id, so every
 * player fights exactly the same waves and balance changes are one number.
 */
import { GRID } from '../core/layout';
import { enemy, familyOf } from './enemies';
import { tilesFor } from './tiles';
import type { ChapterDef, EnemyFamily, LevelDef } from './types';

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

export interface WaveEntry {
  enemyId: string;
  row: number;
  /** Seconds after the wave starts. */
  delay: number;
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
    unlocks: ['tithe', 'militia', 'archer', 'barricade', 'guardian', 'frostmage', 'bombard', 'arbalest'],
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
    unlocks: ['dwarf_warrior', 'dwarf_engineer', 'runesmith', 'gravewarden', 'dwarf_cannon'],
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
    commander: 'maerwyn',
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

function buildLevel(
  chapterIdx: number,
  meta: (typeof CHAPTER_META)[number],
  i: number,
): LevelDef {
  const global = CHAPTER_META.slice(0, chapterIdx).reduce((n, c) => n + c.levels, 0) + i + 1;
  const last = i === meta.levels - 1;
  const waves = 6 + Math.min(7, Math.floor(i * 0.5)) + (last ? 2 : 0);
  const tier = chapterIdx;
  return {
    id: `c${meta.id}l${i + 1}`,
    chapter: meta.id,
    index: i + 1,
    name: meta.names[i] ?? `Wave ${i + 1}`,
    biome: meta.biome,
    waves,
    budgetStart: 8 + i * 2.2 + tier * 5,
    budgetGrowth: 1.22 + tier * 0.02,
    pool: poolFor(meta.family, meta.boss, i, meta.levels),
    boss: last ? meta.boss : undefined,
    startingGold: 165 + Math.min(90, i * 7) + tier * 18,
    reward: 120 + i * 30 + tier * 90 + (last ? 400 : 0),
    premium: meta.premium,
    brief:
      i === 0
        ? meta.blurb
        : last
          ? 'Their commander is here. If the gate falls, there is nothing behind it.'
          : `Hold the gate. Wave ${waves} is the last.`,
    /*
     * Every fort is fought on its own ground. The tutorial is the exception:
     * it is flat, because the first thing a player learns should not be an
     * exception to a rule they have not been told yet.
     */
    modifiers:
      global === 1
        ? { fixedDeck: ['tithe', 'militia', 'archer'], goldTrickle: 6 }
        : { tiles: tilesFor(`c${meta.id}l${i + 1}`, meta.biome, i) },
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
  const rand = mulberry32(hashString(def.id));
  const waves: Wave[] = [];

  for (let w = 0; w < def.waves; w += 1) {
    const big = (w + 1) % 5 === 0 || w === def.waves - 1;
    const finale = w === def.waves - 1;
    let budget = def.budgetStart * Math.pow(def.budgetGrowth, w) * (big ? 1.55 : 1);

    const entries: WaveEntry[] = [];
    // Later enemies in the pool only appear once the budget can carry them.
    const pool = def.pool.map(enemy).sort((a, b) => a.threat - b.threat);
    const spawnWindow = Math.min(22, 9 + w * 1.1);

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
      budget -= pick.threat;
      entries.push({
        enemyId: pick.id,
        row: Math.floor(rand() * GRID.rows),
        delay: rand() * spawnWindow,
      });
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
