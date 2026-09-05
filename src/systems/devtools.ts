/**
 * Development helpers. None of this is reachable from the shipping UI; it
 * exists so a build can be dropped into a level with everything unlocked.
 */
import { ALL_LEVELS } from '../data/levels';
import { profile } from './profile';
import { writeSave, loadSave } from './save';

/** Grants the Crown Pack, all campaign progress and a pile of gold. */
export function unlockEverythingForTesting(): void {
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
