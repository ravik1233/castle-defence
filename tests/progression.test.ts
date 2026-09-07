import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Profile } from '../src/systems/profile';
import { defaultSave } from '../src/systems/save';
import { DEFENDERS, MAX_UPGRADE_LEVEL, defender, upgradeCost, upgradedStats } from '../src/data/defenders';
import { ALL_LEVELS, level } from '../src/data/levels';
import { HEROES } from '../src/data/heroes';
import { EQUIPMENT_SLOTS, consumable, equipment, salvageFor } from '../src/data/workshop';
import { setFramedArt } from '../src/systems/artstate';

let p: Profile;
beforeEach(() => {
  p = new Profile(defaultSave());
});

describe('campaign gating', () => {
  it('starts with only the first level open', () => {
    expect(p.isLevelUnlocked('c1l1')).toBe(true);
    expect(p.isLevelUnlocked('c1l2')).toBe(false);
  });

  it('opens the next level after a win', () => {
    p.recordVictory('c1l1', 3, 6, level('c1l1').reward);
    expect(p.isLevelUnlocked('c1l2')).toBe(true);
    expect(p.isLevelUnlocked('c1l3')).toBe(false);
  });

  it('keeps the best star count when a level is replayed worse', () => {
    p.recordVictory('c1l1', 3, 6, 100);
    p.recordVictory('c1l1', 1, 6, 100);
    expect(p.levelRecord('c1l1')!.stars).toBe(3);
  });

  it('pays full reward once and a reduced one for replays', () => {
    const first = p.recordVictory('c1l1', 3, 6, 300);
    const second = p.recordVictory('c1l1', 3, 6, 300);
    expect(first).toBe(300);
    expect(second).toBeLessThan(first);
    expect(second).toBeGreaterThan(0);
  });
});

describe('crown pack entitlements', () => {
  // Cards still waiting on their drawn frames are covered on their own,
  // below: the pack pays for them but the game does not offer them yet.
  const premiumCards = DEFENDERS.filter((d) => d.premium && !d.requiresFrames).map((d) => d.id);

  it('locks premium cards, hero, skins and chapter 4 without the pack', () => {
    for (const id of premiumCards) expect(p.isCardUnlocked(id)).toBe(false);
    expect(p.availableHeroes()).toEqual(['aldric']);
    expect(p.ownsSkin('obsidian')).toBe(false);
    expect(p.isLevelUnlocked('c4l1')).toBe(false);
  });

  it('unlocks all of it with the pack', () => {
    p.grantCrownPack();
    for (const id of premiumCards) expect(p.isCardUnlocked(id)).toBe(true);
    expect(p.ownsSkin('obsidian')).toBe(true);
    expect(p.showAds).toBe(false);
  });

  it('hands over a commander only once their region is reached', () => {
    expect(p.availableHeroes()).toEqual(['aldric']);
    p.grantCrownPack();
    // The pack pays for the premium commanders; the campaign still decides
    // when they turn up.
    expect(p.availableHeroes()).toEqual(['aldric']);
    for (const l of ALL_LEVELS.slice(0, 10)) p.recordVictory(l.id, 3, l.waves, 0);
    expect(p.availableHeroes()).toEqual(['aldric', 'bran']);
    for (const l of ALL_LEVELS.slice(0, 30)) p.recordVictory(l.id, 3, l.waves, 0);
    expect(p.availableHeroes()).toEqual(HEROES.map((h) => h.id));
  });

  it("musters a region's own units the moment the player arrives", () => {
    expect(p.isCardUnlocked('frostmage')).toBe(false);
    for (const l of ALL_LEVELS.slice(0, 10)) p.recordVictory(l.id, 3, l.waves, 0);
    expect(p.currentRegion().id).toBe(2);
    expect(p.isCardUnlocked('frostmage')).toBe(true);
  });

  it('still gates premium chapter levels behind campaign progress', () => {
    p.grantCrownPack();
    expect(p.isLevelUnlocked('c4l1')).toBe(false);
    for (const l of ALL_LEVELS.slice(0, 30)) p.recordVictory(l.id, 3, l.waves, 0);
    expect(p.isLevelUnlocked('c4l1')).toBe(true);
  });

  it('survives a revoke without leaving premium content selected', () => {
    p.grantCrownPack();
    p.setSkin('obsidian');
    p.setHero('seraphina');
    p.revokeCrownPack();
    expect(p.activeSkin).toBe('stone');
    expect(p.heroId).toBe('aldric');
    expect(p.ownsSkin('obsidian')).toBe(false);
  });
});

describe('armoury', () => {
  it('charges an increasing price and caps out', () => {
    const def = defender('militia');
    p.addGold(10_000_000);
    let last = 0;
    for (let i = 0; i < MAX_UPGRADE_LEVEL; i += 1) {
      const cost = upgradeCost(def, i);
      expect(cost).toBeGreaterThan(last);
      last = cost;
      expect(p.buyUpgrade('militia')).toBe(true);
    }
    expect(p.upgradeLevel('militia')).toBe(MAX_UPGRADE_LEVEL);
    expect(p.buyUpgrade('militia')).toBe(false);
  });

  it('refuses an upgrade that cannot be afforded', () => {
    expect(p.buyUpgrade('militia')).toBe(false);
    expect(p.upgradeLevel('militia')).toBe(0);
  });

  it('makes upgraded units strictly stronger', () => {
    const def = defender('militia');
    const base = upgradedStats(def, 0);
    const maxed = upgradedStats(def, MAX_UPGRADE_LEVEL);
    expect(maxed.hp).toBeGreaterThan(base.hp);
    expect(maxed.damage).toBeGreaterThan(base.damage);
  });

  it('reports zero damage for support buildings rather than NaN', () => {
    expect(upgradedStats(defender('tithe'), 3).damage).toBe(0);
  });
});

describe('deck', () => {
  it('never hands a battle a locked or premium card', () => {
    const deck = p.effectiveDeck();
    for (const id of deck) expect(p.isCardUnlocked(id)).toBe(true);
    expect(deck.length).toBeGreaterThan(0);
    expect(deck.length).toBeLessThanOrEqual(6);
  });

  it('drops cards that became invalid and refills from what is unlocked', () => {
    p.setDeck(['paladin', 'militia']);
    const deck = p.effectiveDeck();
    expect(deck).not.toContain('paladin');
    expect(deck).toContain('militia');
  });

  it('caps the deck at six', () => {
    p.grantCrownPack();
    for (const l of ALL_LEVELS) p.recordVictory(l.id, 3, l.waves, 0);
    p.setDeck(DEFENDERS.map((d) => d.id));
    expect(p.deck).toHaveLength(6);
  });
});

describe('gold', () => {
  it('will not go negative', () => {
    p.addGold(100);
    expect(p.spendGold(150)).toBe(false);
    expect(p.gold).toBe(100);
    expect(p.spendGold(100)).toBe(true);
    expect(p.gold).toBe(0);
  });
});

describe('workshop', () => {
  it('pays salvage for what the field gives up', () => {
    const first = salvageFor({ kills: 40, stars: 3, firstClear: true });
    const again = salvageFor({ kills: 40, stars: 3, firstClear: false });
    expect(first).toBeGreaterThan(again);
    expect(again).toBeGreaterThan(0);
    expect(salvageFor({ kills: 80, stars: 3, firstClear: false })).toBeGreaterThan(again);
    expect(Number.isInteger(first)).toBe(true);
  });

  it('refuses equipment it cannot pay for, and charges once', () => {
    expect(p.buyEquipment('reinforced')).toBe(false);
    p.addSalvage(100);
    const before = p.salvage;
    expect(p.buyEquipment('reinforced')).toBe(true);
    expect(p.salvage).toBe(before - equipment('reinforced').cost);
    expect(p.buyEquipment('reinforced')).toBe(false);
    expect(p.ownsEquipment('reinforced')).toBe(true);
  });

  it('keeps premium equipment behind the pack even when it is paid for', () => {
    p.addSalvage(500);
    expect(p.buyEquipment('garrison')).toBe(false);
    p.grantCrownPack();
    expect(p.buyEquipment('garrison')).toBe(true);
    expect(p.ownsEquipment('garrison')).toBe(true);
    p.revokeCrownPack();
    expect(p.ownsEquipment('garrison')).toBe(false);
  });

  it('takes three pieces to war and no more', () => {
    p.addSalvage(1000);
    for (const id of ['reinforced', 'cellars', 'oil', 'horn']) p.buyEquipment(id);
    for (const id of ['reinforced', 'cellars', 'oil']) expect(p.toggleEquipped(id)).toBe(true);
    expect(p.equipped).toHaveLength(EQUIPMENT_SLOTS);
    expect(p.toggleEquipped('horn')).toBe(false);
    // Taking one off makes room for another.
    expect(p.toggleEquipped('oil')).toBe(true);
    expect(p.toggleEquipped('horn')).toBe(true);
    expect(p.equipped).toContain('horn');
    expect(p.equipped).not.toContain('oil');
  });

  it('crafts up to what a person can carry, and spends what it makes', () => {
    p.addSalvage(1000);
    const def = consumable('oilbarrel');
    for (let i = 0; i < def.max; i += 1) expect(p.craft('oilbarrel')).toBe(true);
    expect(p.stockOf('oilbarrel')).toBe(def.max);
    expect(p.craft('oilbarrel')).toBe(false);
    expect(p.useStock('oilbarrel')).toBe(true);
    expect(p.stockOf('oilbarrel')).toBe(def.max - 1);
    // Craft again now there is room.
    expect(p.craft('oilbarrel')).toBe(true);
  });

  it('never spends stock it does not have', () => {
    expect(p.useStock('repairkit')).toBe(false);
    expect(p.stockOf('repairkit')).toBe(0);
  });
});

describe('cards waiting on art', () => {
  const pending = DEFENDERS.filter((d) => d.requiresFrames);

  afterEach(() => setFramedArt([]));

  it('has some, and none of them are offered while their frames are missing', () => {
    expect(pending.length).toBeGreaterThan(0);
    p.grantCrownPack();
    for (const d of pending) expect(p.isCardUnlocked(d.id)).toBe(false);
  });

  it('offers them the moment the frames are installed', () => {
    p.grantCrownPack();
    setFramedArt(pending.map((d) => (d.art.kind === 'unit' ? d.art.id : '')));
    for (const d of pending) expect(p.isCardUnlocked(d.id)).toBe(true);
  });

  it('still keeps them behind the pack once the art exists', () => {
    setFramedArt(pending.map((d) => (d.art.kind === 'unit' ? d.art.id : '')));
    for (const d of pending) expect(p.isCardUnlocked(d.id)).toBe(false);
  });

  it('never deals one into a deck', () => {
    p.grantCrownPack();
    p.setDeck(pending.map((d) => d.id));
    for (const id of p.effectiveDeck()) expect(pending.some((d) => d.id === id)).toBe(false);
  });
});
