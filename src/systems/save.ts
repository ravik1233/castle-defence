/**
 * Persistence.
 *
 * localStorage is used directly: it is durable inside the Capacitor WebView on
 * both Android and iOS, needs no plugin, and keeps the web build identical to
 * the store build. The schema is versioned and migrated forward on load, so an
 * update never wipes a player's campaign.
 */

export const SAVE_KEY = 'lastgate.save.v1';
export const SAVE_VERSION = 4;

export interface LevelRecord {
  /** 1-3, based on how much wall health survived. */
  stars: number;
  bestWave: number;
}

export interface Settings {
  sfx: boolean;
  music: boolean;
  haptics: boolean;
  /** Larger cards and buttons for small screens. */
  bigUi: boolean;
  /** 'auto' picks a tier from the device and the measured frame rate. */
  quality: 'auto' | 'high' | 'low';
}

export interface SaveData {
  version: number;
  gold: number;
  levels: Record<string, LevelRecord>;
  /** Armoury upgrade level per defender id. */
  upgrades: Record<string, number>;
  heroId: string;
  deck: string[];
  crownPack: boolean;
  ownedSkins: string[];
  activeSkin: string;
  settings: Settings;
  stats: {
    kills: number;
    battles: number;
    victories: number;
    goldEarned: number;
  };
  /** Set the first time the player finishes level 1. */
  tutorialDone: boolean;
  adFreeUntil: number;
  lastPlayed: number;
}

export function defaultSave(): SaveData {
  return {
    version: SAVE_VERSION,
    gold: 0,
    levels: {},
    upgrades: {},
    heroId: 'aldric',
    deck: ['tithe', 'militia', 'archer', 'barricade'],
    crownPack: false,
    ownedSkins: ['stone'],
    activeSkin: 'stone',
    settings: { sfx: true, music: true, haptics: true, bigUi: false, quality: 'auto' },
    stats: { kills: 0, battles: 0, victories: 0, goldEarned: 0 },
    tutorialDone: false,
    adFreeUntil: 0,
    lastPlayed: Date.now(),
  };
}

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migrations run in order from the stored version up to SAVE_VERSION.
 * Each one must be safe to run on a partially-populated object.
 */
const MIGRATIONS: Record<number, Migration> = {
  1: (d) => ({ ...d, ownedSkins: ['stone'], activeSkin: 'stone', version: 2 }),
  2: (d) => ({
    ...d,
    stats: { kills: 0, battles: 0, victories: 0, goldEarned: 0, ...(d.stats as object) },
    version: 3,
  }),
  3: (d) => ({
    ...d,
    settings: { quality: 'auto', ...(d.settings as object) },
    version: 4,
  }),
};

export function migrate(raw: Record<string, unknown>): SaveData {
  let data = { ...raw };
  let version = typeof data.version === 'number' ? data.version : 1;
  while (version < SAVE_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) break;
    data = step(data);
    version = typeof data.version === 'number' ? data.version : version + 1;
  }
  // Fill any field a partial or corrupted save is missing.
  const base = defaultSave();
  return {
    ...base,
    ...data,
    version: SAVE_VERSION,
    settings: { ...base.settings, ...((data.settings as object) ?? {}) },
    stats: { ...base.stats, ...((data.stats as object) ?? {}) },
    levels: (data.levels as SaveData['levels']) ?? {},
    upgrades: (data.upgrades as SaveData['upgrades']) ?? {},
    deck: Array.isArray(data.deck) && data.deck.length ? (data.deck as string[]) : base.deck,
    ownedSkins: Array.isArray(data.ownedSkins) ? (data.ownedSkins as string[]) : base.ownedSkins,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return defaultSave();
    return migrate(parsed as Record<string, unknown>);
  } catch {
    // A corrupt save must never brick the game.
    return defaultSave();
  }
}

export function writeSave(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, lastPlayed: Date.now() }));
  } catch {
    // Private mode or a full quota: the session still plays, it just won't persist.
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
