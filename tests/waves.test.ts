import { describe, expect, it } from 'vitest';
import { ALL_LEVELS, CHAPTERS, generateWaves, hashString, level, levelNumber, mulberry32 } from '../src/data/levels';
import { ENEMY_BY_ID, enemy } from '../src/data/enemies';
import { DEFENDERS, DEFENDER_BY_ID } from '../src/data/defenders';
import { HERO_BY_ID } from '../src/data/heroes';
import { GRID } from '../src/core/layout';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(hashString('c1l1'));
    const b = mulberry32(hashString('c1l1'));
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('produces different streams for different seeds', () => {
    expect(mulberry32(hashString('c1l1'))()).not.toBe(mulberry32(hashString('c1l2'))());
  });

  it('stays in [0,1)', () => {
    const r = mulberry32(12345);
    for (let i = 0; i < 500; i += 1) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('campaign shape', () => {
  it('has seven regions, the first three free and the rest paid', () => {
    expect(CHAPTERS).toHaveLength(7);
    expect(CHAPTERS.filter((c) => !c.premium).map((c) => c.id)).toEqual([1, 2, 3]);
    expect(CHAPTERS.filter((c) => c.premium).map((c) => c.id)).toEqual([4, 5, 6, 7]);
  });

  it('gives every region fifteen forts', () => {
    for (const c of CHAPTERS) expect(c.levels).toHaveLength(15);
  });

  /*
   * The point of a region is that it is one horde. A fort that fields
   * something from another family would make the region's own defenders -
   * consecration, shieldbreaking, nets - beside the point.
   */
  it('fields only its own family in every fort of a region', () => {
    for (const c of CHAPTERS) {
      for (const l of c.levels) {
        for (const id of l.pool) {
          expect(ENEMY_BY_ID.get(id)?.family, `${l.id} fields ${id}`).toBe(c.family);
        }
      }
    }
  });

  it('ends every region with its own commander, and only there', () => {
    for (const c of CHAPTERS) {
      const bosses = c.levels.filter((l) => l.boss);
      expect(bosses).toHaveLength(1);
      expect(bosses[0]!.id).toBe(c.levels[c.levels.length - 1]!.id);
      expect(ENEMY_BY_ID.get(bosses[0]!.boss!)?.family).toBe(c.family);
    }
    // Six commanders under the King, and the King himself at the end.
    const bosses = CHAPTERS.map((c) => c.levels[c.levels.length - 1]!.boss);
    expect(new Set(bosses).size).toBe(7);
    expect(bosses[bosses.length - 1]).toBe('demon_king');
  });

  it("never puts a commander in an ordinary fort's pool", () => {
    for (const l of ALL_LEVELS) {
      for (const id of l.pool) expect(ENEMY_BY_ID.get(id)?.special).not.toBe('boss');
    }
  });

  it('numbers levels contiguously from one', () => {
    ALL_LEVELS.forEach((l, i) => expect(levelNumber(l.id)).toBe(i + 1));
  });

  it('only puts premium levels in the premium regions', () => {
    for (const l of ALL_LEVELS) expect(Boolean(l.premium)).toBe(l.chapter >= 4);
  });

  it('references only real enemies in every pool', () => {
    for (const l of ALL_LEVELS) {
      for (const id of l.pool) expect(ENEMY_BY_ID.has(id)).toBe(true);
      if (l.boss) expect(ENEMY_BY_ID.has(l.boss)).toBe(true);
    }
  });
});

describe('generateWaves', () => {
  it('is deterministic', () => {
    const a = generateWaves(level('c2l3'));
    const b = generateWaves(level('c2l3'));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces the declared number of waves, each with spawns', () => {
    for (const l of ALL_LEVELS) {
      const waves = generateWaves(l);
      expect(waves).toHaveLength(l.waves);
      for (const w of waves) expect(w.entries.length).toBeGreaterThan(0);
    }
  });

  it('keeps every spawn inside the grid and on a non-negative timeline', () => {
    for (const l of ALL_LEVELS) {
      for (const w of generateWaves(l)) {
        for (const e of w.entries) {
          expect(e.row).toBeGreaterThanOrEqual(0);
          expect(e.row).toBeLessThan(GRID.rows);
          expect(e.delay).toBeGreaterThanOrEqual(0);
          expect(e.delay).toBeLessThanOrEqual(w.duration);
        }
      }
    }
  });

  it('orders spawns by time', () => {
    for (const w of generateWaves(level('c3l7'))) {
      const delays = w.entries.map((e) => e.delay);
      expect([...delays].sort((a, b) => a - b)).toEqual(delays);
    }
  });

  it('escalates threat across a level', () => {
    const threat = (id: string) =>
      generateWaves(level(id)).map((w) => w.entries.reduce((s, e) => s + enemy(e.enemyId).threat, 0));
    const t = threat('c2l6');
    expect(t[t.length - 1]).toBeGreaterThan(t[0]!);
  });

  it('sends the commander only in the final wave of the final fort', () => {
    const last = generateWaves(level('c1l15'));
    expect(last[last.length - 1]!.entries.some((e) => e.enemyId === 'goblin_king')).toBe(true);
    const midLevel = generateWaves(level('c1l5'));
    expect(midLevel.every((w) => w.entries.every((e) => e.enemyId !== 'goblin_king'))).toBe(true);
  });

  it('puts the Demon King at the very end of the campaign', () => {
    const waves = generateWaves(level('c7l15'));
    expect(waves[waves.length - 1]!.entries.some((e) => e.enemyId === 'demon_king')).toBe(true);
  });

  it('marks every fifth wave and the finale as big', () => {
    const waves = generateWaves(level('c2l15'));
    expect(waves[4]!.big).toBe(true);
    expect(waves[waves.length - 1]!.big).toBe(true);
    expect(waves[0]!.big).toBe(false);
  });

  it('gets harder chapter over chapter', () => {
    const total = (id: string) =>
      generateWaves(level(id)).reduce(
        (s, w) => s + w.entries.reduce((n, e) => n + enemy(e.enemyId).threat, 0),
        0,
      );
    expect(total('c2l1')).toBeGreaterThan(total('c1l1'));
    expect(total('c3l1')).toBeGreaterThan(total('c2l1'));
  });
});

describe('who holds each region', () => {
  /*
   * The shape the campaign was designed to: eight cards to learn the game
   * with, then five per region after it. If a card drifts out of a muster it
   * becomes unobtainable, and if a muster gains one the curve moves - so the
   * count is asserted rather than trusted.
   */
  it('musters eight in the first region and five in every one after', () => {
    expect(CHAPTERS[0]!.unlocks).toHaveLength(8);
    for (const c of CHAPTERS.slice(1)) expect(c.unlocks, c.name).toHaveLength(5);
  });

  it('musters only cards that exist, and never the same card twice', () => {
    const seen = new Set<string>();
    for (const c of CHAPTERS) {
      for (const id of c.unlocks) {
        expect(DEFENDER_BY_ID.has(id), `${c.name} musters unknown ${id}`).toBe(true);
        expect(seen.has(id), `${id} is mustered twice`).toBe(false);
        seen.add(id);
      }
    }
  });

  it("opens a mustered card exactly when its region does, at its region's price", () => {
    for (const c of CHAPTERS) {
      const first = levelNumber(c.levels[0]!.id);
      for (const id of c.unlocks) {
        const def = DEFENDER_BY_ID.get(id)!;
        expect(def.unlockLevel, `${id} unlocks at ${def.unlockLevel}, region opens at ${first}`).toBe(first);
        expect(Boolean(def.premium), `${id} price`).toBe(Boolean(c.premium));
      }
    }
  });

  it('gives every region a commander and a race of its own', () => {
    for (const c of CHAPTERS) {
      expect(c.race.length).toBeGreaterThan(3);
      expect(HERO_BY_ID.has(c.commander), `${c.name} has no commander`).toBe(true);
    }
    // Six lieutenants under the King, each holding their own ground.
    expect(new Set(CHAPTERS.map((c) => c.family)).size).toBe(7);
  });

  it('leaves every card that is not mustered as a Crown Pack extra', () => {
    const mustered = new Set(CHAPTERS.flatMap((c) => c.unlocks));
    for (const d of DEFENDERS) {
      if (mustered.has(d.id)) continue;
      expect(d.premium, `${d.id} is in no muster and is not premium`).toBe(true);
    }
  });
});
