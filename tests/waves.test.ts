import { describe, expect, it } from 'vitest';
import { ALL_LEVELS, CHAPTERS, generateWaves, hashString, level, levelNumber, mulberry32 } from '../src/data/levels';
import { ENEMY_BY_ID, enemy } from '../src/data/enemies';
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
  it('has four chapters, the last one premium', () => {
    expect(CHAPTERS).toHaveLength(4);
    expect(CHAPTERS.filter((c) => c.premium).map((c) => c.id)).toEqual([4]);
  });

  it('numbers levels contiguously from one', () => {
    ALL_LEVELS.forEach((l, i) => expect(levelNumber(l.id)).toBe(i + 1));
  });

  it('only puts premium levels in the premium chapter', () => {
    for (const l of ALL_LEVELS) expect(Boolean(l.premium)).toBe(l.chapter === 4);
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

  it('sends the boss only in the final wave of the final level of a chapter', () => {
    const last = generateWaves(level('c1l10'));
    const bossInFinal = last[last.length - 1]!.entries.some((e) => e.enemyId === 'orc');
    expect(bossInFinal).toBe(true);
    const midLevel = generateWaves(level('c1l5'));
    expect(midLevel.every((w) => w.entries.every((e) => e.enemyId !== 'demon_king'))).toBe(true);
  });

  it('puts the Demon King at the end of chapter 3', () => {
    const waves = generateWaves(level('c3l10'));
    expect(waves[waves.length - 1]!.entries.some((e) => e.enemyId === 'demon_king')).toBe(true);
  });

  it('marks every fifth wave and the finale as big', () => {
    const waves = generateWaves(level('c2l10'));
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
