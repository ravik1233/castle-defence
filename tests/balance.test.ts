import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHAPTERS, generateWaves } from '../src/data/levels';
import { DEFENDERS, DEFENDER_BY_ID } from '../src/data/defenders';
import { ENEMIES, enemy } from '../src/data/enemies';
import { dpsPerGold, effectiveDps, outOfBand } from '../src/data/balance';
import { enemyScaling } from '../src/battle/combat';
import { musterPay } from '../src/battle/economy';

describe('what a card is worth', () => {
  /*
   * The failure this guards against actually happened: a fifty-gold militia
   * led damage-per-gold in every one of the hundred and five forts, so the
   * deck was never a decision. Bands are how that stays fixed.
   */
  it('keeps every card inside the band its role is paid in', () => {
    for (const d of DEFENDERS) {
      expect(outOfBand(d), `${d.id} (${d.role}): ${outOfBand(d).join('; ')}`).toEqual([]);
    }
  });

  it('lets no card lead damage per gold by a wide margin', () => {
    const ranked = DEFENDERS.filter((d) => effectiveDps(d) > 0)
      .map((d) => ({ id: d.id, v: dpsPerGold(d) }))
      .sort((a, b) => b.v - a.v);
    const best = ranked[0]!;
    const fifth = ranked[4]!;
    // The best attacker may be the best, but not by half again over the field.
    expect(best.v / fifth.v, `${best.id} leads ${fifth.id}`).toBeLessThan(1.5);
  });

  it('gives every region something worth changing the deck for', () => {
    let previousBest = 0;
    for (const ch of CHAPTERS) {
      const best = Math.max(...ch.unlocks.map((id) => dpsPerGold(DEFENDER_BY_ID.get(id)!)));
      expect(best, `${ch.name} musters nothing worth a slot`).toBeGreaterThan(12);
      previousBest = Math.max(previousBest, best);
    }
    expect(previousBest).toBeGreaterThan(0);
  });
});

describe('what a threat point buys', () => {
  const families = [...new Set(ENEMIES.map((e) => e.family))].filter(Boolean) as string[];
  const rank = (f: string) => ENEMIES.filter((e) => e.family === f && e.special !== 'boss' && !e.specials?.includes('boss'));

  /*
   * The wave generator spends threat. If a point of it buys twice the health
   * in one region as another, that region is twice as hard for reasons
   * nobody chose - which is exactly how the orc region ended up harder than
   * the Demon King's.
   */
  it('buys about the same health whatever the horde', () => {
    const perFamily = families.map((f) => {
      const list = rank(f);
      return { f, hp: list.reduce((n, e) => n + e.hp / e.threat, 0) / list.length };
    });
    for (const { f, hp } of perFamily) {
      expect(hp, `${f} buys ${hp.toFixed(0)} hp per threat`).toBeGreaterThan(75);
      expect(hp, `${f} buys ${hp.toFixed(0)} hp per threat`).toBeLessThan(120);
    }
  });

  /*
   * Four of the seven hordes shipped with five or six bodies, which meant a
   * region's first eleven forts fielded the same two enemies. Depth is not a
   * nicety here: the pool is what makes fort nine a different fight to fort
   * three.
   */
  it('gives every horde enough bodies to field a different fight each fort', () => {
    for (const f of families) {
      const roster = ENEMIES.filter((e) => e.family === f);
      const rank = roster.filter((e) => !(e.special === 'boss' || e.specials?.includes('boss')));
      expect(rank.length, `${f} fields only ${rank.length} bodies below its boss`).toBeGreaterThanOrEqual(8);
      // And they cannot all do the same job.
      const jobs = new Set(rank.map((e) => [e.flying ? 'fly' : '', e.range > 300 ? 'shoot' : '', e.special ?? '', ...(e.specials ?? [])].join('/')));
      expect(jobs.size, `${f} fields ${rank.length} bodies doing ${jobs.size} jobs`).toBeGreaterThanOrEqual(6);
    }
  });

  it('fields something that flies and something that shoots in every horde', () => {
    for (const f of families) {
      const roster = ENEMIES.filter((e) => e.family === f);
      expect(roster.some((e) => e.flying), `${f} has nothing that flies`).toBe(true);
      expect(roster.some((e) => e.range > 300), `${f} has nothing that shoots`).toBe(true);
    }
  });

  /*
   * `shielded` was declared on five enemies and read by nothing: the ledger
   * said they carried a shield and the simulation had never heard of it. A
   * behaviour the player is told about has to exist.
   */
  it('reads every behaviour it lets an enemy declare', () => {
    const sim = [readFileSync('src/battle/entities.ts', 'utf8'), readFileSync('src/battle/combat.ts', 'utf8')].join('\n');
    const declared = new Set(ENEMIES.flatMap((e) => [e.special, ...(e.specials ?? [])]).filter((s): s is string => !!s && s !== 'none'));
    for (const s of declared) {
      expect(sim.includes(`'${s}'`), `nothing in the simulation reads ${s}`).toBe(true);
    }
  });

  it('pays a bounty in proportion to the health it took to earn it', () => {
    for (const f of families) {
      const list = rank(f);
      const hpPerGold = list.reduce((n, e) => n + e.hp / e.bounty, 0) / list.length;
      expect(hpPerGold, `${f} pays every ${hpPerGold.toFixed(0)} hp`).toBeGreaterThan(14);
      expect(hpPerGold, `${f} pays every ${hpPerGold.toFixed(0)} hp`).toBeLessThan(24);
    }
  });
});

describe('the shape of the campaign', () => {
  /** Income against the pressure of the heaviest wave: higher is gentler. */
  function ease(levelId: string): number {
    const ch = CHAPTERS.find((c) => c.levels.some((l) => l.id === levelId))!;
    const l = ch.levels.find((x) => x.id === levelId)!;
    const pool = CHAPTERS.filter((c) => c.id <= ch.id).flatMap((c) => c.unlocks);
    const best = Math.max(...pool.map((id) => dpsPerGold(DEFENDER_BY_ID.get(id)!)));
    const waves = generateWaves(l);
    let bounty = 0;
    let peak = 0;
    waves.forEach((w, wi) => {
      let hp = 0;
      for (const e of w.entries) {
        const def = enemy(e.enemyId);
        // A warband fields half as many bodies at twice the size; the weight
        // is the same either way, and the measurement has to know that.
        const body = e.scale ?? 1;
        hp += def.hp * enemyScaling(l.chapter, wi) * body;
        bounty += Math.round(def.bounty * body * (1 + (l.chapter - 1) * 0.08));
      }
      peak = Math.max(peak, hp / Math.max(1, w.duration));
    });
    const income = l.startingGold + musterPay(l.chapter) * (waves.length - 1) + bounty;
    return ((income / 100) * best) / Math.max(1, peak);
  }

  it('never sets a fort the player cannot pay for', () => {
    for (const ch of CHAPTERS) {
      for (const l of ch.levels) {
        expect(ease(l.id), `${l.id} (${l.name}) is unaffordable`).toBeGreaterThan(1.2);
      }
    }
  });

  it('opens gently and ends hard', () => {
    const first = ease('c1l1');
    const last = ease('c7l15');
    expect(first, 'the first fort should be forgiving').toBeGreaterThan(2.5);
    expect(last, 'the last fort should not be').toBeLessThan(first * 0.75);
  });

  it('never doubles the difficulty between one fort and the next', () => {
    for (const ch of CHAPTERS) {
      for (let i = 1; i < ch.levels.length; i += 1) {
        const before = ease(ch.levels[i - 1]!.id);
        const now = ease(ch.levels[i]!.id);
        const step = before / now;
        expect(step, `${ch.levels[i]!.id} is ${step.toFixed(1)}x the fort before it`).toBeLessThan(2.4);
      }
    }
  });
});
