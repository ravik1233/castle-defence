/**
 * The player profile: the single mutable game state outside a battle.
 *
 * Scenes read from here and call the mutators; every mutator persists, so a
 * player who kills the app mid-session loses nothing.
 */
import { CHAPTERS, ALL_LEVELS, levelNumber } from '../data/levels';
import { DEFENDERS, MAX_UPGRADE_LEVEL, defender, upgradeCost } from '../data/defenders';
import { HEROES } from '../data/heroes';
import { CONSUMABLE_BY_ID, EQUIPMENT_BY_ID, EQUIPMENT_SLOTS } from '../data/workshop';
import { hasFrames } from './artstate';
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
    // A card waiting on its art is not offered at all, whatever else the
    // player owns.
    if (def.requiresFrames && def.art.kind === 'unit' && !hasFrames(def.art.id)) return false;
    if (def.premium) return this.hasCrownPack;
    // A region hands over its own muster the moment the player reaches it, so
    // arriving somewhere new is arriving with something new to fight with.
    if (this.musteredCards().includes(defenderId)) return true;
    return def.unlockLevel <= this.campaignProgress;
  }

  /** True once the player may ride into a region at all. */
  isRegionReached(regionId: number): boolean {
    const region = CHAPTERS.find((c) => c.id === regionId);
    if (!region) return false;
    const first = region.levels[0];
    if (!first) return false;
    if (region.premium && !this.hasCrownPack) return false;
    return this.isLevelUnlocked(first.id);
  }

  /** Every region the player has reached, in campaign order. */
  reachedRegions(): typeof CHAPTERS {
    return CHAPTERS.filter((c) => this.isRegionReached(c.id));
  }

  /** Cards granted by every region the player has reached. */
  musteredCards(): string[] {
    return this.reachedRegions().flatMap((r) => r.unlocks);
  }

  /** The region the player has most recently reached. */
  currentRegion(): (typeof CHAPTERS)[number] {
    const reached = this.reachedRegions();
    return reached[reached.length - 1] ?? CHAPTERS[0]!;
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

  /*
   * A commander comes with the land they hold, so a hero is only in the
   * roster once the player has ridden into that commander's region. Crown
   * Pack commanders need the pack on top of that.
   */
  availableHeroes(): string[] {
    return HEROES.filter((h) => {
      if (h.premium && !this.hasCrownPack) return false;
      const region = CHAPTERS.find((c) => c.commander === h.id);
      return !region || this.isRegionReached(region.id);
    }).map((h) => h.id);
  }

  setHero(id: string): void {
    if (!this.availableHeroes().includes(id)) return;
    this.data.heroId = id;
    this.commit();
  }

  /* ------------------------------------------------------------ workshop - */

  get salvage(): number {
    return this.data.salvage;
  }

  addSalvage(n: number): void {
    this.data.salvage = Math.max(0, this.data.salvage + Math.round(n));
    this.commit();
  }

  ownsEquipment(id: string): boolean {
    const def = EQUIPMENT_BY_ID.get(id);
    if (!def) return false;
    if (def.premium && !this.hasCrownPack) return false;
    return this.data.ownedEquipment.includes(id);
  }

  buyEquipment(id: string): boolean {
    const def = EQUIPMENT_BY_ID.get(id);
    if (!def || this.data.ownedEquipment.includes(id)) return false;
    if (def.premium && !this.hasCrownPack) return false;
    if (this.data.salvage < def.cost) return false;
    this.data.salvage -= def.cost;
    this.data.ownedEquipment.push(id);
    this.commit();
    return true;
  }

  /** The three pieces that go to war, dropping anything no longer owned. */
  get equipped(): string[] {
    return this.data.equipped.filter((id) => this.ownsEquipment(id)).slice(0, EQUIPMENT_SLOTS);
  }

  /** Equips a piece, or takes it off if it is already in a slot. */
  toggleEquipped(id: string): boolean {
    if (!this.ownsEquipment(id)) return false;
    const current = this.equipped;
    if (current.includes(id)) {
      this.data.equipped = current.filter((e) => e !== id);
    } else {
      if (current.length >= EQUIPMENT_SLOTS) return false;
      this.data.equipped = [...current, id];
    }
    this.commit();
    return true;
  }

  stockOf(id: string): number {
    return this.data.stock[id] ?? 0;
  }

  /** Makes one of something, if there is salvage for it and room to carry it. */
  craft(id: string): boolean {
    const def = CONSUMABLE_BY_ID.get(id);
    if (!def) return false;
    if (this.stockOf(id) >= def.max) return false;
    if (this.data.salvage < def.cost) return false;
    this.data.salvage -= def.cost;
    this.data.stock[id] = this.stockOf(id) + 1;
    this.commit();
    return true;
  }

  /** Spends one, in battle. */
  useStock(id: string): boolean {
    if (this.stockOf(id) <= 0) return false;
    this.data.stock[id] = this.stockOf(id) - 1;
    this.commit();
    return true;
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
