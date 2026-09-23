/**
 * On-demand texture streaming.
 *
 * Only the castle skin and biome a screen actually needs are rasterised, which
 * keeps texture memory small on low-end devices. Every function here is
 * idempotent and safe to await repeatedly.
 */
import type Phaser from 'phaser';
import { BACKDROP_SCALE, addTexture, ensureBiome, ensureRegionPaint, ensureUnitArt } from '../art/registry';
import { ALL_CASTLE_SKINS, REGION_WALL_SKINS, WALL_SKINS, castleGate, castleKeep, castleWall } from '../art/structures';
import type { BiomeId } from '../art/scenery';
import { DESIGN, FIELD, GRID, WALL } from '../core/layout';
import { CHAPTERS, level as levelDef } from '../data/levels';
import { defender } from '../data/defenders';
import { enemy } from '../data/enemies';
import { hero } from '../data/heroes';
import { profile } from './profile';

/**
 * Every unit one fort can put on the field: the horde it draws from, the
 * commander who holds the keep, and the cards the player is bringing.
 *
 * This is read off the level and the profile rather than off the art folder,
 * so renaming or repacking a sheet cannot silently drop a unit from the list.
 */
export function castForLevel(levelId: string): string[] {
  const lvl = levelDef(levelId);
  const ids = new Set<string>();
  const addUnit = (art: { kind: string; id?: string } | undefined): void => {
    if (art?.kind === 'unit' && art.id) ids.add(art.id);
  };

  // An enemy names its art outright; a defender's may be a structure instead.
  for (const id of lvl.pool) {
    try { ids.add(enemy(id).art); } catch { /* a pool entry with no def draws nothing */ }
  }
  if (lvl.boss) {
    try { ids.add(enemy(lvl.boss).art); } catch { /* as above */ }
  }
  const chapter = CHAPTERS.find((c) => c.id === lvl.chapter);
  if (chapter) {
    try { ids.add(hero(chapter.commander).art); } catch { /* falls back to guardian art */ }
    ids.add('guardian');
  }
  for (const id of profile.effectiveDeck()) {
    try { addUnit(defender(id).art); } catch { /* a card with no def draws nothing */ }
  }
  return [...ids];
}

export async function ensureCastleSkin(scene: Phaser.Scene, skinId: string): Promise<void> {
  const skin = ALL_CASTLE_SKINS.find((s) => s.id === skinId) ?? WALL_SKINS[0]!;
  // Exactly the lanes, so the walkway's courses line up with the ground the
  // rest of the fight happens on. The strip of wall above the lanes is drawn
  // separately - it is skyline, not somewhere anything stands.
  if (!scene.textures.exists(`wall.${skin.id}`)) {
    await addTexture(scene, `wall.${skin.id}`, castleWall(skin, WALL.width, FIELD.height, GRID.rows).svg, BACKDROP_SCALE);
  }
  if (!scene.textures.exists(`gate.${skin.id}`)) {
    await addTexture(scene, `gate.${skin.id}`, castleGate(skin, WALL.width - 18, GRID.cellH * 0.82).svg, 1);
  }
  if (!scene.textures.exists(`keep.${skin.id}`)) {
    await addTexture(scene, `keep.${skin.id}`, castleKeep(skin).svg, 1);
  }
}

/**
 * Everything a battle on this biome with this skin needs.
 *
 * Given the fort's id it also waits on that fort's cast, which is the one
 * place the drawn poses have to be in hand rather than still arriving. Units
 * the background stream has already fetched cost nothing here.
 */
export async function ensureBattleTextures(
  scene: Phaser.Scene,
  biome: BiomeId,
  skinId: string,
  levelId?: string,
): Promise<void> {
  await ensureBiome(scene, biome, DESIGN.width, FIELD.height + FIELD.horizon, GRID.rows, FIELD.horizon);
  await ensureCastleSkin(scene, REGION_WALL_SKINS[biome]?.id ?? skinId);
  await ensureRegionPaint(scene, biome);
  if (levelId) await ensureUnitArt(scene, castForLevel(levelId));
}

/** All four keeps, for the castle-skin picker. */
export async function ensureAllCastleSkins(scene: Phaser.Scene): Promise<void> {
  for (const skin of WALL_SKINS) await ensureCastleSkin(scene, skin.id);
}
