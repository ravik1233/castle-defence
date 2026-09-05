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
}> = [
  {
    id: 1,
    name: 'The Broken Fields',
    biome: 'fields',
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
      ['goblin'],
      ['goblin'],
      ['goblin', 'goblin_runner'],
      ['goblin', 'goblin_runner'],
      ['goblin', 'goblin_runner', 'hobgoblin'],
      ['goblin', 'goblin_bomber', 'goblin_runner'],
      ['goblin', 'hobgoblin', 'goblin_bomber'],
      ['goblin', 'goblin_runner', 'hobgoblin', 'imp'],
      ['goblin', 'hobgoblin', 'imp', 'goblin_bomber'],
      ['goblin', 'hobgoblin', 'imp', 'goblin_runner', 'orc'],
    ],
    boss: 'orc',
  },
  {
    id: 2,
    name: 'The Ashen Woods',
    biome: 'woods',
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
      ['goblin', 'hobgoblin', 'imp'],
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
    budgetGrowth: 1.24 + tier * 0.02,
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
    modifiers:
      global === 1
        ? { fixedDeck: ['tithe', 'militia'], goldTrickle: 6 }
        : global === 2
          ? { fixedDeck: ['tithe', 'militia', 'archer'] }
          : undefined,
  };
}

export const CHAPTERS: ChapterDef[] = CHAPTER_META.map((meta, ci) => ({
  id: meta.id,
  name: meta.name,
  biome: meta.biome,
  blurb: meta.blurb,
  premium: meta.premium,
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
    let guard = 0;

    while (budget > 0 && guard < 200) {
      guard += 1;
      const affordable = pool.filter((e) => e.threat <= budget + 0.6);
      if (affordable.length === 0) break;
      // Bias toward the strongest thing affordable, so waves escalate.
      const pick =
        affordable[
          Math.min(
            affordable.length - 1,
            Math.floor(Math.pow(rand(), 0.65) * affordable.length),
          )
        ]!;
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
