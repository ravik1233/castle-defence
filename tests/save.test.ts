import { beforeEach, describe, expect, it } from 'vitest';
import { SAVE_KEY, SAVE_VERSION, clearSave, defaultSave, loadSave, migrate, writeSave } from '../src/systems/save';

beforeEach(() => {
  clearSave();
});

describe('save', () => {
  it('starts from a sane default', () => {
    const s = defaultSave();
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.gold).toBe(0);
    expect(s.crownPack).toBe(false);
    expect(s.deck.length).toBeGreaterThan(0);
    expect(s.settings.sfx).toBe(true);
  });

  it('round-trips through storage', () => {
    const s = defaultSave();
    s.gold = 4321;
    s.levels['c1l1'] = { stars: 3, bestWave: 6 };
    writeSave(s);
    const back = loadSave();
    expect(back.gold).toBe(4321);
    expect(back.levels['c1l1']).toEqual({ stars: 3, bestWave: 6 });
  });

  it('survives a corrupt save rather than throwing', () => {
    localStorage.setItem(SAVE_KEY, '{not json');
    expect(loadSave().gold).toBe(0);
    localStorage.setItem(SAVE_KEY, 'null');
    expect(loadSave().version).toBe(SAVE_VERSION);
  });

  it('fills in fields a partial save is missing', () => {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, gold: 99 }));
    const s = loadSave();
    expect(s.gold).toBe(99);
    expect(s.settings.music).toBe(true);
    expect(s.deck.length).toBeGreaterThan(0);
    expect(s.stats.kills).toBe(0);
  });

  it('migrates a v1 save without losing progress or purchases', () => {
    const old = {
      version: 1,
      gold: 500,
      crownPack: true,
      levels: { c1l1: { stars: 2, bestWave: 5 } },
      upgrades: { militia: 3 },
      heroId: 'aldric',
      deck: ['tithe', 'militia'],
      settings: { sfx: false, music: true, haptics: true, bigUi: false },
    };
    const s = migrate(old);
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.gold).toBe(500);
    expect(s.crownPack).toBe(true);
    expect(s.levels['c1l1']!.stars).toBe(2);
    expect(s.upgrades.militia).toBe(3);
    expect(s.settings.sfx).toBe(false);
    // Fields introduced after v1 must exist.
    expect(s.ownedSkins).toContain('stone');
    expect(s.stats).toBeDefined();
  });

  it('migrates a v2 save', () => {
    const s = migrate({ version: 2, gold: 10, ownedSkins: ['stone', 'ivory'], activeSkin: 'ivory' });
    expect(s.version).toBe(SAVE_VERSION);
    expect(s.activeSkin).toBe('ivory');
    expect(s.stats.battles).toBe(0);
  });

  it('treats an unknown future version as current rather than resetting', () => {
    const s = migrate({ version: 999, gold: 77, crownPack: true });
    expect(s.gold).toBe(77);
    expect(s.crownPack).toBe(true);
  });
});
