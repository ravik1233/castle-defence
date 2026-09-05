/**
 * The player profile: the single mutable game state outside a battle.
 *
 * Scenes read from here and call the mutators; every mutator persists, so a
 * player who kills the app mid-session loses nothing.
 */
import { CHAPTERS, ALL_LEVELS, levelNumber } from '../data/levels';
import { DEFENDERS, MAX_UPGRADE_LEVEL, defender, upgradeCost } from '../data/defenders';
import { HEROES } from '../data/heroes';
import { WALL_SKINS } from '../art/structures';
import { defaultSave, loadSave, writeSave, type SaveData, type Settings } from './save';

/** Cosmetic skins that come with the Crown Pack. */
export const PREMIUM_SKINS = new Set(['ivory', 'obsidian', 'verdant']);

export class Profile {
  private data: SaveData;
  private listeners = new Set<() => void>();

  constructor(data = loadSave()) {
    this.data = data;
  }

  get raw(): Readonly<SaveData> {
    return this.data;
  }

  get gold(): number {
    return this.data.gold;
  }

  get settings(): Settings {
    return this.data.settings;
  }

  get hasCrownPack(): boolean {
    return this.data.crownPack;
  }

  get showAds(): boolean {
    return !this.data.crownPack;
  }

  get heroId(): string {
    return this.data.heroId;
  }

  get deck(): string[] {
    return this.data.deck;
  }

  get activeSkin(): string {
    return this.data.activeSkin;
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private commit(): void {
    writeSave(this.data);
    for (const fn of this.listeners) fn();
  }

  /* ------------------------------------------------------------ progress - */

  /** Highest campaign level the player may enter (1-based). */
  get campaignProgress(): number {
    let n = 1;
    for (const lvl of ALL_LEVELS) {
      if (this.data.levels[lvl.id]) n = Math.max(n, levelNumber(lvl.id) + 1);
    }
    return Math.min(n, ALL_LEVELS.length);
  }

  isLevelUnlocked(levelId: string): boolean {
    const lvl = ALL_LEVELS.find((l) => l.id === levelId);
    if (!lvl) return false;
    if (lvl.premium && !this.hasCrownPack) return false;
    return levelNumber(levelId) <= this.campaignProgress;
  }

  levelRecord(levelId: string): { stars: number; bestWave: number } | undefined {
    return this.data.levels[levelId];
  }

  chapterStars(chapterId: number): { earned: number; total: number } {
    const chapter = CHAPTERS.find((c) => c.id === chapterId);
    if (!chapter) return { earned: 0, total: 0 };
    let earned = 0;
    for (const l of chapter.levels) earned += this.data.levels[l.id]?.stars ?? 0;
    return { earned, total: chapter.levels.length * 3 };
  }

  recordVictory(levelId: string, stars: number, wave: number, reward: number): number {
    const prev = this.data.levels[levelId];
    const firstClear = !prev;
    this.data.levels[levelId] = {
      stars: Math.max(prev?.stars ?? 0, stars),
      bestWave: Math.max(prev?.bestWave ?? 0, wave),
    };
    // Replays pay a third, so grinding is possible but slow.
    const payout = firstClear ? reward : Math.round(reward * 0.34);
    this.data.gold += payout;
    this.data.stats.victories += 1;
    this.data.stats.battles += 1;
    this.data.stats.goldEarned += payout;
    this.commit();
    return payout;
  }

  recordDefeat(levelId: string, wave: number): void {
    const prev = this.data.levels[levelId];
    if (prev) prev.bestWave = Math.max(prev.bestWave, wave);
    this.data.stats.battles += 1;
    this.commit();
  }

  addKills(n: number): void {
    this.data.stats.kills += n;
    this.commit();
  }

  /* ---------------------------------------------------------------- gold - */

  addGold(n: number): void {
    this.data.gold += n;
    this.data.stats.goldEarned += Math.max(0, n);
    this.commit();
  }

  spendGold(n: number): boolean {
    if (this.data.gold < n) return false;
    this.data.gold -= n;
    this.commit();
    return true;
  }

  /* ------------------------------------------------------------ armoury - */

  upgradeLevel(defenderId: string): number {
    return this.data.upgrades[defenderId] ?? 0;
  }

  canUpgrade(defenderId: string): boolean {
    const def = defender(defenderId);
    const lvl = this.upgradeLevel(defenderId);
    return lvl < MAX_UPGRADE_LEVEL && this.data.gold >= upgradeCost(def, lvl);
  }

  buyUpgrade(defenderId: string): boolean {
    const def = defender(defenderId);
    const lvl = this.upgradeLevel(defenderId);
    if (lvl >= MAX_UPGRADE_LEVEL) return false;
    const cost = upgradeCost(def, lvl);
    if (!this.spendGold(cost)) return false;
    this.data.upgrades[defenderId] = lvl + 1;
    this.commit();
    return true;
  }

  /* --------------------------------------------------------------- cards - */

  /**
   * Crown Pack defenders are available the moment the pack is bought - that is
   * what was sold. Their gold cost is what keeps them out of the first levels.
   */
  isCardUnlocked(defenderId: string): boolean {
    const def = defender(defenderId);
    if (def.premium) return this.hasCrownPack;
    return def.unlockLevel <= this.campaignProgress;
  }

  availableCards(): string[] {
    return DEFENDERS.filter((d) => this.isCardUnlocked(d.id)).map((d) => d.id);
  }

  /** Cards newly unlocked by reaching a campaign level. */
  cardsUnlockedAt(levelNo: number): string[] {
    return DEFENDERS.filter(
      (d) => d.unlockLevel === levelNo && (!d.premium || this.hasCrownPack),
    ).map((d) => d.id);
  }

  setDeck(deck: string[]): void {
    this.data.deck = deck.slice(0, 6);
    this.commit();
  }

  /** Deck entries that are still legal, padded with whatever is unlocked. */
  effectiveDeck(): string[] {
    const unlocked = this.availableCards();
    const kept = this.data.deck.filter((id) => unlocked.includes(id));
    for (const id of unlocked) {
      if (kept.length >= 6) break;
      if (!kept.includes(id)) kept.push(id);
    }
    return kept.slice(0, 6);
  }

  /* -------------------------------------------------------------- heroes - */

  availableHeroes(): string[] {
    return HEROES.filter((h) => !h.premium || this.hasCrownPack).map((h) => h.id);
  }

  setHero(id: string): void {
    if (!this.availableHeroes().includes(id)) return;
    this.data.heroId = id;
    this.commit();
  }

  /* --------------------------------------------------------------- skins - */

  ownsSkin(id: string): boolean {
    if (this.data.ownedSkins.includes(id)) return true;
    return PREMIUM_SKINS.has(id) && this.hasCrownPack;
  }

  availableSkins(): string[] {
    return WALL_SKINS.filter((s) => this.ownsSkin(s.id)).map((s) => s.id);
  }

  setSkin(id: string): void {
    if (!this.ownsSkin(id)) return;
    this.data.activeSkin = id;
    this.commit();
  }

  /* ---------------------------------------------------------- purchasing - */

  grantCrownPack(): void {
    if (this.data.crownPack) return;
    this.data.crownPack = true;
    for (const skin of PREMIUM_SKINS) {
      if (!this.data.ownedSkins.includes(skin)) this.data.ownedSkins.push(skin);
    }
    this.commit();
  }

  /** Debug/QA only - never reachable from the shipping UI. */
  revokeCrownPack(): void {
    this.data.crownPack = false;
    this.data.ownedSkins = this.data.ownedSkins.filter((s) => !PREMIUM_SKINS.has(s));
    if (PREMIUM_SKINS.has(this.data.activeSkin)) this.data.activeSkin = 'stone';
    if (this.data.heroId !== 'aldric') this.data.heroId = 'aldric';
    this.commit();
  }

  updateSettings(patch: Partial<Settings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
    this.commit();
  }

  markTutorialDone(): void {
    this.data.tutorialDone = true;
    this.commit();
  }

  /** Wipes campaign progress but keeps entitlements the player paid for. */
  resetProgress(): void {
    const keepPack = this.data.crownPack;
    const keepSettings = this.data.settings;
    this.data = { ...defaultSave(), crownPack: keepPack, settings: keepSettings };
    if (keepPack) this.grantCrownPack();
    this.commit();
  }
}

/** Process-wide profile instance. */
export const profile = new Profile();
