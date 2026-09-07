/**
 * Development helpers. None of this is reachable from the shipping UI; it
 * exists so a build can be dropped into a level with everything unlocked.
 */
import { ALL_LEVELS, CHAPTERS } from '../data/levels';
import { profile } from './profile';
import { writeSave, loadSave } from './save';

/**
 * Grants the Crown Pack, all campaign progress and a pile of gold.
 * Never reachable in a shipping build - the caller is gated on the QA flag.
 */
export function unlockEverythingForTesting(): void {
  if (!import.meta.env.DEV && !__QA_BUILD__) return;
  const data = loadSave();
  for (const lvl of ALL_LEVELS) {
    data.levels[lvl.id] = { stars: 3, bestWave: lvl.waves };
  }
  data.gold = 250000;
  data.crownPack = true;
  data.ownedSkins = ['stone', 'ivory', 'obsidian', 'verdant'];
  writeSave(data);
  // The live profile is already constructed, so mirror the change into it.
  profile.grantCrownPack();
  profile.addGold(250000 - profile.gold);
  for (const lvl of ALL_LEVELS) profile.recordVictory(lvl.id, 3, lvl.waves, 0);
}

/**
 * Marches the campaign as far as a region's first fort and no further, so a
 * tester can see that region's commander and muster without the whole game
 * being open. The Crown Pack comes with it, since two regions need it.
 */
export function reachRegionForTesting(regionId: number): void {
  if (!import.meta.env.DEV && !__QA_BUILD__) return;
  profile.grantCrownPack();
  for (const region of CHAPTERS) {
    if (region.id >= regionId) break;
    for (const lvl of region.levels) profile.recordVictory(lvl.id, 3, lvl.waves, 0);
  }
}
