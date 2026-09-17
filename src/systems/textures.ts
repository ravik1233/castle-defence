/**
 * On-demand texture streaming.
 *
 * Only the castle skin and biome a screen actually needs are rasterised, which
 * keeps texture memory small on low-end devices. Every function here is
 * idempotent and safe to await repeatedly.
 */
import type Phaser from 'phaser';
import { BACKDROP_SCALE, addTexture, ensureBiome } from '../art/registry';
import { ALL_CASTLE_SKINS, REGION_WALL_SKINS, WALL_SKINS, castleGate, castleKeep, castleWall } from '../art/structures';
import type { BiomeId } from '../art/scenery';
import { DESIGN, FIELD, GRID, WALL } from '../core/layout';

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

/** Everything a battle on this biome with this skin needs. */
export async function ensureBattleTextures(
  scene: Phaser.Scene,
  biome: BiomeId,
  skinId: string,
): Promise<void> {
  await ensureBiome(scene, biome, DESIGN.width, FIELD.height + FIELD.horizon, GRID.rows, FIELD.horizon);
  await ensureCastleSkin(scene, REGION_WALL_SKINS[biome]?.id ?? skinId);
}

/** All four keeps, for the castle-skin picker. */
export async function ensureAllCastleSkins(scene: Phaser.Scene): Promise<void> {
  for (const skin of WALL_SKINS) await ensureCastleSkin(scene, skin.id);
}
