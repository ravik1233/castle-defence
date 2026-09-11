import { describe, expect, it } from 'vitest';
import {
  bountyFor,
  damageAfterArmor,
  enemyScaling,
  pickTarget,
  sellValue,
  damageDealt,
  kindArmour,
  kindDamageShift,
  starsForKeep,
  starsForWall,
  tensionFor,
  pickBlocker,
  packSpeed,
  rageBlow,
  risesAgain,
  throughShield,
} from '../src/battle/combat';
import {
  EMBER_DEPOSITS_PER_VEIN,
  emberBounty,
  emberCost,
  musterPay,
} from '../src/battle/economy';
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

describe('damage types', () => {
  it('leaves steel as the honest baseline against flesh', () => {
    expect(kindArmour('physical', 'living')).toBe(0);
  });

  it('makes armour the answer to steel and holy the answer to armour being the answer', () => {
    expect(kindArmour('physical', 'armoured')).toBeGreaterThan(0);
    expect(kindArmour('holy', 'undead')).toBeLessThanOrEqual(-2);
  });

  it('gives every type something it is bad against', () => {
    for (const type of ['physical', 'fire', 'frost', 'holy'] as const) {
      const kinds = ['living', 'armoured', 'undead', 'demon'] as const;
      // Somewhere in the row, a body that armours itself against this blow.
      const best = Math.max(...kinds.map((k) => kindArmour(type, k)));
      expect(best).toBeGreaterThanOrEqual(0);
    }
  });

  it('does not let fire be the answer to demons', () => {
    expect(kindArmour('fire', 'demon')).toBeGreaterThan(0);
    expect(kindArmour('frost', 'demon')).toBeLessThan(0);
  });

  it('defaults to physical against living, so old data keeps working', () => {
    expect(kindArmour()).toBe(0);
    expect(damageDealt(100, undefined, undefined, 0)).toBe(100);
  });

  it('reads a matchup out to a player as damage on the blow, not armour on the body', () => {
    // The table a player sees is the negative of the armour behind it: two
    // points of weakness to holy is "+2 dmg", a point of fire armour "-1".
    expect(kindDamageShift('holy', 'undead')).toBe(-kindArmour('holy', 'undead'));
    expect(kindDamageShift('holy', 'undead')).toBeGreaterThan(0);
    expect(kindDamageShift('fire', 'demon')).toBeLessThan(0);
  });

  it('lets a body state its own fire armour instead of taking its kind figure', () => {
    // A demon is one point fireproof by kind; a forge-born one says three.
    expect(kindArmour('fire', 'demon', { fire: 3 })).toBe(3);
    // What it does not state, it takes from its kind as before.
    expect(kindArmour('frost', 'demon', { fire: 3 })).toBe(kindArmour('frost', 'demon'));
    expect(damageDealt(10, 'fire', 'demon', 0, { fire: 3 })).toBe(7);
  });

  it('adds the matchup to the body armour, under the usual floor', () => {
    // Holy against undead: two points of weakness, so twenty armour behaves
    // like eighteen and a blow of 100 lands for 82.
    expect(damageDealt(100, 'holy', 'undead', 20)).toBe(82);
    // Armoured and hit with steel: its point of plate on top of its own.
    expect(damageDealt(10, 'physical', 'armoured', 2)).toBe(7);
    // Resisted and heavily armoured still scratches rather than doing nothing.
    expect(damageDealt(10, 'physical', 'armoured', 999)).toBeGreaterThan(0);
  });
});

describe('battle income', () => {
  it('converts old roster values into small whole Ember amounts', () => {
    expect(emberCost(50)).toBe(2);
    expect(emberCost(75)).toBe(3);
    expect(emberBounty(enemy('goblin').bounty)).toBe(1);
    expect(EMBER_DEPOSITS_PER_VEIN).toBe(3);
  });

  it('pays no passive or between-wave wage', () => {
    for (let c = 1; c <= 7; c += 1) expect(musterPay(c, 999)).toBe(0);
  });
});

describe('what an enemy walks into', () => {
  /*
   * The rule: an enemy stops at the front-most defender it meets in its own
   * lane. Only a flyer passes over one, and only a leaper hops it - so this
   * is the rule everything ordinary obeys.
   */
  const at = (x: number, row = 2, alive = true) => ({ x, row, alive });

  it('stops at the nearest defender ahead, not the first one it saw', () => {
    const back = at(330);
    const front = at(930);
    expect(pickBlocker({ x: 1080, row: 2 }, [back, front])).toBe(front);
    // The order they were placed in must not decide it.
    expect(pickBlocker({ x: 1080, row: 2 }, [front, back])).toBe(front);
  });

  it('ignores anything already behind it, and other lanes', () => {
    const behind = at(1200);
    const ahead = at(400);
    const otherLane = at(930, 3);
    expect(pickBlocker({ x: 1080, row: 2 }, [behind, ahead, otherLane])).toBe(ahead);
    expect(pickBlocker({ x: 300, row: 2 }, [behind])).toBeUndefined();
  });

  it('ignores the dead', () => {
    const dead = at(930, 2, false);
    const live = at(330);
    expect(pickBlocker({ x: 1080, row: 2 }, [dead, live])).toBe(live);
  });

  it('finds nothing in an empty lane', () => {
    expect(pickBlocker({ x: 1080, row: 2 }, [])).toBeUndefined();
  });
});

describe('the six hordes', () => {
  it('brings the dead back once, and not to holy or fire', () => {
    const base = { risen: true, spent: false, by: 'physical' as const, consecrated: false };
    expect(risesAgain(base)).toBe(true);
    expect(risesAgain({ ...base, by: 'holy' })).toBe(false);
    expect(risesAgain({ ...base, by: 'fire' })).toBe(false);
    expect(risesAgain({ ...base, by: 'frost' })).toBe(true);
    // Consecrated ground puts them down whatever killed them.
    expect(risesAgain({ ...base, consecrated: true })).toBe(false);
    // And a body only gets back up the once.
    expect(risesAgain({ ...base, spent: true })).toBe(false);
    // Everything else was never getting up anyway.
    expect(risesAgain({ ...base, risen: false })).toBe(false);
  });

  it('makes an orc hit harder the more it has bled', () => {
    expect(rageBlow(100, 100, 100)).toBe(100);
    expect(rageBlow(100, 50, 100)).toBe(125);
    expect(rageBlow(100, 0, 100)).toBe(150);
    // Never more than the cap, whatever the arithmetic does at the edges.
    expect(rageBlow(100, -20, 100)).toBe(150);
  });

  it('runs a beast faster in company and no faster alone', () => {
    expect(packSpeed(100, 0)).toBe(100);
    expect(packSpeed(100, 2)).toBeCloseTo(120);
    // The bonus stops climbing, so a big wave cannot outrun the whole game.
    expect(packSpeed(100, 40)).toBeCloseTo(140);
  });

  it('puts most of a blow into a shield, and none of it for a shieldbreaker', () => {
    const onto = throughShield(100, 200, false);
    expect(onto.toShield).toBe(75);
    expect(onto.toBody).toBe(25);
    // A shield with little left cannot absorb more than it has.
    const nearly = throughShield(100, 10, false);
    expect(nearly.toShield).toBe(10);
    expect(nearly.toBody).toBe(90);
    // A shieldbreaker goes straight through.
    expect(throughShield(100, 200, true)).toEqual({ toShield: 0, toBody: 100 });
    // No shield left: everything lands.
    expect(throughShield(100, 0, false)).toEqual({ toShield: 0, toBody: 100 });
  });
});
