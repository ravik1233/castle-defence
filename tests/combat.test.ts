import { describe, expect, it } from 'vitest';
import {
  bountyFor,
  damageAfterArmor,
  enemyScaling,
  pickTarget,
  sellValue,
  starsForKeep,
  starsForWall,
  tensionFor,
} from '../src/battle/combat';
import { defender } from '../src/data/defenders';
import { enemy } from '../src/data/enemies';

describe('damageAfterArmor', () => {
  it('subtracts armour', () => {
    expect(damageAfterArmor(100, 20)).toBe(80);
  });

  it('never fully negates a hit, so tanks are not immune', () => {
    expect(damageAfterArmor(10, 500)).toBe(2);
    expect(damageAfterArmor(100, 500)).toBe(15);
  });

  it('is unchanged with no armour', () => {
    expect(damageAfterArmor(37, 0)).toBe(37);
  });
});

describe('starsForWall', () => {
  it('awards three stars only for an untouched gate', () => {
    expect(starsForWall(1000, 1000)).toBe(3);
    expect(starsForWall(999, 1000)).toBe(2);
  });

  it('drops to one star below 60%', () => {
    expect(starsForWall(600, 1000)).toBe(2);
    expect(starsForWall(599, 1000)).toBe(1);
    expect(starsForWall(1, 1000)).toBe(1);
  });
});

describe('pickTarget', () => {
  const mk = (x: number, row: number, extra: Partial<{ flying: boolean; alive: boolean }> = {}) => ({
    x,
    row,
    alive: true,
    ...extra,
  });

  it('picks the enemy closest to the wall within range', () => {
    const list = [mk(500, 0), mk(300, 0), mk(700, 0)];
    expect(pickTarget(list, { x: 100, row: 0 }, 900, true)?.x).toBe(300);
  });

  it('ignores other lanes', () => {
    const list = [mk(300, 1), mk(600, 0)];
    expect(pickTarget(list, { x: 100, row: 0 }, 900, true)?.x).toBe(600);
  });

  it('ignores enemies out of range or already past', () => {
    expect(pickTarget([mk(2000, 0)], { x: 100, row: 0 }, 400, true)).toBeUndefined();
    expect(pickTarget([mk(50, 0)], { x: 100, row: 0 }, 400, true)).toBeUndefined();
  });

  it('skips flyers when the defender cannot hit air', () => {
    const list = [mk(300, 0, { flying: true }), mk(500, 0)];
    expect(pickTarget(list, { x: 100, row: 0 }, 900, false)?.x).toBe(500);
    expect(pickTarget(list, { x: 100, row: 0 }, 900, true)?.x).toBe(300);
  });

  it('skips the dead', () => {
    expect(pickTarget([mk(300, 0, { alive: false })], { x: 0, row: 0 }, 900, true)).toBeUndefined();
  });
});

describe('difficulty and economy', () => {
  it('scales enemies up per chapter and per wave', () => {
    expect(enemyScaling(1, 0)).toBe(1);
    expect(enemyScaling(2, 0)).toBeCloseTo(1.22);
    expect(enemyScaling(1, 10)).toBeCloseTo(1.45);
    expect(enemyScaling(3, 5)).toBeGreaterThan(enemyScaling(2, 5));
  });

  it('pays more bounty in later chapters', () => {
    const goblin = enemy('goblin');
    expect(bountyFor(goblin, 1)).toBe(goblin.bounty);
    expect(bountyFor(goblin, 3)).toBeGreaterThan(goblin.bounty);
  });

  it('refunds at most half of a defender, and never nothing', () => {
    const militia = defender('militia');
    expect(sellValue(militia, 1)).toBe(Math.round(militia.cost * 0.5));
    expect(sellValue(militia, 0)).toBeGreaterThanOrEqual(10);
    expect(sellValue(militia, 1)).toBeLessThan(militia.cost);
  });

  it('raises musical tension as the wall falls and enemies close in', () => {
    expect(tensionFor({ hp: 1000, max: 1000 }, 0)).toBe(0);
    expect(tensionFor({ hp: 200, max: 1000 }, 6)).toBe(1);
    expect(tensionFor({ hp: 1000, max: 1000 }, 3)).toBeCloseTo(0.25);
  });
});

describe('starsForKeep', () => {
  const intact = { sections: [420, 420, 420, 420, 420], sectionMax: 420, heartHp: 700, heartMax: 700 };

  it('gives three stars for a siege that never touched the wall', () => {
    expect(starsForKeep(intact)).toBe(3);
  });

  it('drops to two once the wall is chipped', () => {
    expect(starsForKeep({ ...intact, sections: [420, 420, 419, 420, 420] })).toBe(2);
    expect(starsForKeep({ ...intact, sections: [420, 420, 100, 420, 420] })).toBe(2);
  });

  it('gives one star once any section is breached, however healthy the rest', () => {
    expect(starsForKeep({ ...intact, sections: [420, 420, 0, 420, 420] })).toBe(1);
  });

  it('gives one star if the heart was struck at all', () => {
    expect(starsForKeep({ ...intact, heartHp: 699 })).toBe(1);
  });
});
