/**
 * On-demand texture streaming.
 *
 * Only the castle skin and biome a screen actually needs are rasterised, which
 * keeps texture memory small on low-end devices. Every function here is
 * idempotent and safe to await repeatedly.
 */
import type Phaser from 'phaser';
import { BACKDROP_SCALE, addTexture, ensureBiome } from '../art/registry';
import { WALL_SKINS, castleGate, castleKeep, castleWall } from '../art/structures';
import type { BiomeId } from '../art/scenery';
import { DESIGN, FIELD, GRID, WALL } from '../core/layout';

export async function ensureCastleSkin(scene: Phaser.Scene, skinId: string): Promise<void> {
  const skin = WALL_SKINS.find((s) => s.id === skinId) ?? WALL_SKINS[0]!;
  if (scene.textures.exists(`wall.${skin.id}`)) return;
  await addTexture(scene, `wall.${skin.id}`, castleWall(skin, WALL.width, FIELD.height + FIELD.horizon).svg, BACKDROP_SCALE);
  await addTexture(scene, `gate.${skin.id}`, castleGate(skin, WALL.gateWidth, 240).svg);
  await addTexture(scene, `keep.${skin.id}`, castleKeep(skin).svg, 1);
}

/** Everything a battle on this biome with this skin needs. */
export async function ensureBattleTextures(
  scene: Phaser.Scene,
  biome: BiomeId,
  skinId: string,
): Promise<void> {
  await ensureBiome(scene, biome, DESIGN.width, FIELD.height + FIELD.horizon, GRID.rows);
  await ensureCastleSkin(scene, skinId);
}

/** All four keeps, for the castle-skin picker. */
export async function ensureAllCastleSkins(scene: Phaser.Scene): Promise<void> {
  for (const skin of WALL_SKINS) await ensureCastleSkin(scene, skin.id);
}
