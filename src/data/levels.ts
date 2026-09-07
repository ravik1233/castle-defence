/**
 * Campaign structure and the wave generator.
 *
 * Levels declare a threat budget curve and an enemy pool rather than a hand
 * written list of spawns. The generator is seeded from the level id, so every
 * player fights exactly the same waves and balance changes are one number.
 */
import { GRID } from '../core/layout';
import { enemy } from './enemies';
import type { ChapterDef, LevelDef } from './types';

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
const CHAPTER_META: Array<{
  id: number;
  name: string;
  biome: ChapterDef['biome'];
  blurb: string;
  premium?: boolean;
  levels: number;
  names: string[];
  pool: string[][];
  boss?: string;
  commander: string;
  unlocks: string[];
  map: { x: number; y: number };
}> = [
  {
    id: 1,
    name: 'The Broken Fields',
    biome: 'fields',
    commander: 'aldric',
    unlocks: ['militia', 'archer', 'barricade', 'guardian'],
    map: { x: 0.16, y: 0.68 },
    blurb: 'The horde crossed the river at dawn. Everything east of here is gone.',
    levels: 10,
    names: [
      'First Light',
      'The Mill Road',
      'Broken Fences',
      'Runners at Dusk',
      'The Long Field',
      'Powder and Smoke',
      'The Shield Line',
      'Night Watch',
      'Hobgoblin Vanguard',
      'The Warlord of the Fields',
    ],
    pool: [
      ['goblin', 'goblin_runner'],
      ['goblin', 'goblin_runner', 'goblin_bomber'],
      ['goblin', 'goblin_runner', 'hobgoblin'],
      ['goblin', 'goblin_bomber', 'hobgoblin', 'imp'],
      ['goblin', 'goblin_runner', 'imp', 'hobgoblin'],
      ['goblin', 'goblin_bomber', 'hobgoblin', 'imp', 'cutthroat'],
      ['goblin', 'goblin_runner', 'hobgoblin', 'cutthroat', 'shaman'],
      ['goblin', 'goblin_bomber', 'hobgoblin', 'shadow_fiend', 'orc'],
      ['goblin', 'goblin_runner', 'hobgoblin', 'cutthroat', 'shaman', 'orc'],
      ['goblin', 'hobgoblin', 'imp', 'goblin_runner', 'orc', 'shaman', 'orc_berserker'],
    ],
    boss: 'orc',
  },
  {
    id: 2,
    name: 'The Ashen Woods',
    biome: 'woods',
    commander: 'bran',
    unlocks: ['frostmage', 'bombard', 'arbalest'],
    map: { x: 0.38, y: 0.4 },
    blurb: 'They burned the forest to march through it. Something worse followed.',
    levels: 10,
    names: [
      'Under Black Branches',
      'Emberfall',
      'The Shaman Camp',
      'Bruteforce',
      'Ash and Iron',
      'The Wraith Path',
      'Berserker Tide',
      'The Sundered Grove',
      'Trollbridge',
      'Warlord Gorzak',
    ],
    pool: [
      ['goblin', 'hobgoblin', 'cutthroat'],
      ['hobgoblin', 'imp', 'goblin_bomber'],
      ['hobgoblin', 'shaman', 'goblin'],
      ['orc', 'hobgoblin', 'goblin_runner'],
      ['orc', 'shaman', 'imp'],
      ['wraith', 'hobgoblin', 'imp'],
      ['orc_berserker', 'orc', 'goblin_runner'],
      ['orc', 'wraith', 'shaman', 'shadow_fiend'],
      ['troll', 'orc', 'hobgoblin'],
      ['orc_warlord', 'orc_berserker', 'shaman', 'troll'],
    ],
    boss: 'orc_warlord',
  },
  {
    id: 3,
    name: 'The Gates of the Abyss',
    biome: 'abyss',
    commander: 'seraphina',
    unlocks: ['cleric', 'monk', 'ballista'],
    map: { x: 0.62, y: 0.62 },
    blurb: 'The ground opens here. This is where the host comes from.',
    levels: 10,
    names: [
      'The Red Threshold',
      'Fiends in the Dark',
      'Hell Unbound',
      'The Screaming Line',
      'Wraithstorm',
      'The Iron Knight',
      'Where Trolls Wake',
      'The Warlord Rally',
      'Last Bastion',
      'The Demon King',
    ],
    pool: [
      ['imp', 'shadow_fiend', 'orc'],
      ['shadow_fiend', 'wraith', 'orc_berserker'],
      ['imp', 'wraith', 'orc_berserker', 'shaman'],
      ['orc_berserker', 'troll', 'shadow_fiend'],
      ['wraith', 'shaman', 'imp', 'shadow_fiend'],
      ['demon_knight', 'orc', 'wraith'],
      ['troll', 'orc_berserker', 'shadow_fiend'],
      ['orc_warlord', 'troll', 'wraith', 'shaman'],
      ['demon_knight', 'orc_warlord', 'troll', 'wraith'],
      ['demon_knight', 'orc_warlord', 'troll', 'wraith', 'shadow_fiend'],
    ],
    boss: 'demon_king',
  },
  {
    id: 4,
    name: 'Throne of the Demon King',
    biome: 'throne',
    commander: 'maerwyn',
    unlocks: ['paladin'],
    map: { x: 0.85, y: 0.3 },
    blurb: 'He was not destroyed. He withdrew. Follow him down. Crown Pack.',
    premium: true,
    levels: 8,
    names: [
      'The Descent',
      'Bone Halls',
      'The Black Chorus',
      'Knights of the Pit',
      'The Long Siege',
      'Throne Approach',
      'The King Rises',
      'The Last Gate',
    ],
    pool: [
      ['shadow_fiend', 'wraith', 'demon_knight'],
      ['demon_knight', 'troll', 'shaman'],
      ['wraith', 'shadow_fiend', 'orc_warlord'],
      ['demon_knight', 'orc_warlord', 'troll'],
      ['demon_knight', 'wraith', 'troll', 'orc_berserker'],
      ['demon_knight', 'orc_warlord', 'wraith', 'shadow_fiend'],
      ['demon_knight', 'orc_warlord', 'troll', 'wraith'],
      ['demon_knight', 'orc_warlord', 'troll', 'wraith', 'shadow_fiend'],
    ],
    boss: 'demon_king',
  },
];

function buildLevel(
  chapterIdx: number,
  meta: (typeof CHAPTER_META)[number],
  i: number,
): LevelDef {
  const global = CHAPTER_META.slice(0, chapterIdx).reduce((n, c) => n + c.levels, 0) + i + 1;
  const last = i === meta.levels - 1;
  const waves = 6 + Math.min(6, Math.floor(i * 0.8)) + (last ? 2 : 0);
  const tier = chapterIdx;
  return {
    id: `c${meta.id}l${i + 1}`,
    chapter: meta.id,
    index: i + 1,
    name: meta.names[i] ?? `Wave ${i + 1}`,
    biome: meta.biome,
    waves,
    budgetStart: 3 + i * 1.5 + tier * 7,
    budgetGrowth: 1.2 + tier * 0.025,
    pool: meta.pool[i] ?? meta.pool[meta.pool.length - 1]!,
    boss: last ? meta.boss : undefined,
    startingGold: 175 + Math.min(125, i * 10) + tier * 25,
    reward: 120 + i * 30 + tier * 90 + (last ? 400 : 0),
    premium: meta.premium,
    brief:
      i === 0
        ? meta.blurb
        : last
          ? 'Their commander is here. If the gate falls, there is nothing behind it.'
          : `Hold the gate. Wave ${waves} is the last.`,
    // Only the tutorial level dictates a deck.
    modifiers: global === 1 ? { fixedDeck: ['tithe', 'militia', 'archer'], goldTrickle: 6 } : undefined,
  };
}

export const CHAPTERS: ChapterDef[] = CHAPTER_META.map((meta, ci) => ({
  id: meta.id,
  name: meta.name,
  biome: meta.biome,
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
