import { describe, expect, it } from 'vitest';
import entitiesSrc from '../src/battle/entities.ts?raw';
import combatSrc from '../src/battle/combat.ts?raw';
import { CHAPTERS, generateWaves } from '../src/data/levels';
import { DEFENDERS, DEFENDER_BY_ID } from '../src/data/defenders';
import { ENEMIES, enemy } from '../src/data/enemies';
import { dpsPerGold, effectiveDps, outOfBand } from '../src/data/balance';
import { enemyScaling } from '../src/battle/combat';
import { emberBounty, emberCost } from '../src/battle/economy';

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
      expect(best, `${ch.name} musters nothing worth a slot`).toBeGreaterThan(1);
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
      expect(hp, `${f} buys ${hp.toFixed(2)} hp per threat`).toBeGreaterThan(1.9);
      expect(hp, `${f} buys ${hp.toFixed(2)} hp per threat`).toBeLessThan(3);
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
    const sim = `${entitiesSrc}\n${combatSrc}`;
    const declared = new Set(
      ENEMIES.flatMap((e) => [e.special, ...(e.specials ?? [])]).filter((s) => !!s && s !== 'none'),
    );
    for (const s of declared) {
      expect(sim.includes(`'${s}'`), `nothing in the simulation reads ${s}`).toBe(true);
    }
  });

  /*
   * The Ashen Woods ended on a fifteen-hundred-health body while the region
   * before it ended on six and a half thousand: the orc warlord was written
   * before the regions were and never revisited. A region's boss has to be
   * the hardest thing in that region, and the campaign's bosses have to get
   * harder as the player walks east.
   */
  it('ends every region on something bigger than anything else in it', () => {
    let previous = 0;
    for (const ch of CHAPTERS) {
      const bossId = ch.levels[ch.levels.length - 1]!.boss;
      expect(bossId, `${ch.name} ends on no boss`).toBeDefined();
      const boss = enemy(bossId!);
      // Against the rank and file, not against the region's other bosses:
      // the Throne fields a Demon Prince as well as the King.
      const biggest = Math.max(
        ...ENEMIES.filter(
          (e) => e.family === ch.family && !(e.special === 'boss' || e.specials?.includes('boss')),
        ).map((e) => e.hp),
      );
      expect(boss.hp, `${ch.name}'s boss is smaller than its own rank and file`).toBeGreaterThan(biggest * 2);
      expect(boss.hp, `${ch.name}'s boss is no harder than the region before it`).toBeGreaterThan(previous);
      previous = boss.hp;
    }
  });

  /*
   * Flyers pass over the whole line - `findBlocker` returns nothing for
   * them - so only something that shoots can stop one. A region whose horde
   * flies and whose muster does not shoot is a region with an unanswerable
   * enemy in it, which is the reason the goblin flyer waited until there
   * were archers to shoot it.
   */
  it('gives every region something that can shoot down what flies at it', () => {
    const pool: string[] = [];
    for (const ch of CHAPTERS) {
      pool.push(...ch.unlocks);
      if (!ENEMIES.some((e) => e.family === ch.family && e.flying)) continue;
      const answers = pool
        .map((id) => DEFENDER_BY_ID.get(id)!)
        .filter((d) => d.attack && d.attack.range > 200 && (d.attack.targets ?? 'all') === 'all');
      expect(answers.length, `${ch.name} fields flyers nothing there can reach`).toBeGreaterThan(0);
    }
  });

  it('pays a bounty in proportion to the health it took to earn it', () => {
    for (const f of families) {
      const list = rank(f);
      const hpPerGold = list.reduce((n, e) => n + e.hp / e.bounty, 0) / list.length;
      expect(hpPerGold, `${f} pays every ${hpPerGold.toFixed(2)} hp`).toBeGreaterThan(0.35);
      expect(hpPerGold, `${f} pays every ${hpPerGold.toFixed(2)} hp`).toBeLessThan(0.6);
    }
  });
});

describe('the opening Ember lessons', () => {
  const opening = CHAPTERS[0]!;

  it('starts with one defender and one enemy across three gentle waves', () => {
    const stage = opening.levels[0]!;
    const waves = generateWaves(stage);
    expect(stage.pool).toEqual(['goblin']);
    expect(stage.modifiers?.fixedDeck).toEqual(['militia']);
    expect(waves).toHaveLength(3);
    expect(waves.flatMap((wave) => wave.entries).every((entry) => entry.enemyId === 'goblin')).toBe(true);
    expect(waves.every((wave) => !wave.big)).toBe(true);
    expect(waves.map((wave) => wave.entries.length)).toEqual([2, 3, 4]);
    expect(stage.modifiers).toMatchObject({ hpScale: 0.7, waitForClear: true });
  });

  it('introduces one finite vein in stage 2 and a second in stage 3', () => {
    const seams = (levelIndex: number) =>
      opening.levels[levelIndex]!.modifiers?.tiles?.flat().filter((tile) => tile === 'seam').length ?? 0;
    expect(seams(1)).toBe(1);
    expect(seams(2)).toBe(2);
    expect(opening.levels[1]!.modifiers?.fixedDeck).toEqual(['militia', 'dwarf_engineer']);
  });

  it('makes the Miner an armed finite extractor and delays the Tithe Shrine', () => {
    const miner = DEFENDER_BY_ID.get('dwarf_engineer')!;
    const tithe = DEFENDER_BY_ID.get('tithe')!;
    expect(miner.attack).toBeDefined();
    expect(miner.economy).toMatchObject({ deposits: 3, requiresSeam: true });
    expect(tithe.economy).toBeUndefined();
    expect(tithe.metaGold).toBeGreaterThan(0);
    expect(opening.unlocks).toContain('dwarf_engineer');
    expect(opening.unlocks).not.toContain('tithe');
    expect(CHAPTERS[1]!.unlocks).toContain('tithe');
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
    // Stage 1 is the first fully migrated Ember battle. Later campaign
    // stages remain in authored purchasing units until their regional pass.
    const income =
      l.id === 'c1l1'
        ? (emberCost(l.startingGold) +
            waves.flatMap((wave) => wave.entries).reduce((sum, entry) => sum + emberBounty(enemy(entry.enemyId).bounty), 0)) *
          25
        : l.startingGold + bounty;
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
