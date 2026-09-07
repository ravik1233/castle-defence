/**
 * The ground a fort is fought on.
 *
 * A flat grid means every fort is the same fort with a different backdrop.
 * Here each one gets its own map of ground: rock that cannot be built on,
 * marsh that slows whatever crosses it, old shrines worth standing on, ore
 * worth mining, cover worth hiding in, and - on the Drowned Coast - water,
 * where only what floats can be put at all.
 *
 * It is generated from the fort's own id, so it is the same ground for every
 * player on every device, and it leans on the region's country: the moors
 * are wet, the highlands are rock, the coast is mostly sea.
 */
import { GRID } from '../core/layout';
import type { BiomeId } from '../art/scenery';
import type { TileKind } from './types';

/** Deterministic PRNG, same one the wave generator uses. */
function rng(seed: number): () => number {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * How much of each kind of ground a region's country tends to have.
 *
 * The coast is the odd one: it is mostly water, which is what makes the
 * region a different game rather than a different palette.
 */
const COUNTRY: Record<BiomeId, Partial<Record<TileKind, number>>> = {
  fields: { tallgrass: 0.14, shrine: 0.04, rubble: 0.05 },
  barrows: { marsh: 0.2, shrine: 0.06, rubble: 0.06 },
  woods: { tallgrass: 0.2, rubble: 0.07, marsh: 0.05 },
  highland: { highground: 0.16, rubble: 0.12, seam: 0.05 },
  coast: { water: 0.34, marsh: 0.14, rubble: 0.04 },
  abyss: { rubble: 0.16, shrine: 0.05, highground: 0.06 },
  throne: { rubble: 0.18, highground: 0.08, shrine: 0.04 },
};

/**
 * The ground for one fort.
 *
 * The column nearest the wall is always left plain: a fort where the player
 * cannot put anything in front of their own gate is not a hard fort, it is
 * a broken one.
 */
export function tilesFor(levelId: string, biome: BiomeId, index: number): TileKind[][] {
  const rand = rng(hash(`${levelId}:ground`));
  const country = COUNTRY[biome] ?? {};
  // Later forts in a region are rougher country than the first ones.
  const roughness = 0.75 + Math.min(0.5, index * 0.03);

  const rows: TileKind[][] = [];
  for (let row = 0; row < GRID.rows; row += 1) {
    const cells: TileKind[] = [];
    for (let col = 0; col < GRID.cols; col += 1) {
      if (col === 0) {
        cells.push('plain');
        continue;
      }
      let kind: TileKind = 'plain';
      let roll = rand();
      for (const [k, share] of Object.entries(country) as Array<[TileKind, number]>) {
        const chance = share * roughness;
        if (roll < chance) {
          kind = k;
          break;
        }
        roll -= chance;
      }
      cells.push(kind);
    }
    rows.push(cells);
  }

  /*
   * Every lane keeps dry ground to build on, however the dice fell.
   *
   * Two cells, not one: a region whose ground can only be held by the units
   * that region sells would be a region the player cannot enter with the
   * deck they arrived with, and that is a wall, not a difficulty.
   */
  const DRY_PER_LANE = 2;
  for (const cells of rows) {
    let dry = cells.filter((c) => canStandOn(c, false)).length;
    for (let col = cells.length - 1; col >= 0 && dry < DRY_PER_LANE; col -= 1) {
      if (canStandOn(cells[col]!, false)) continue;
      cells[col] = 'plain';
      dry += 1;
    }
  }
  return rows;
}

/** True when a unit of this kind may be put on this ground. */
export function canStandOn(kind: TileKind, aquatic = false): boolean {
  if (kind === 'rubble' || kind === 'highground') return false;
  if (kind === 'water') return aquatic;
  return true;
}

/** What the ground is called, for the briefing and the ledger. */
export const TILE_NAME: Record<TileKind, string> = {
  plain: 'open ground',
  rubble: 'rubble',
  marsh: 'marsh',
  shrine: 'old shrine',
  seam: 'ore seam',
  highground: 'high ground',
  tallgrass: 'tall grass',
  water: 'open water',
};
