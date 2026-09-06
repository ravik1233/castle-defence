/**
 * Picks the best available image to represent a defender on a card.
 *
 * Order of preference:
 *   1. a painted whole-body sprite, if a painted pack supplied one
 *   2. the generated head, which reads better than a shrunken whole body
 *   3. the structure texture, for buildings
 */
import type Phaser from 'phaser';
import type { DefenderDef } from '../data/types';
import { fullSpriteKey } from '../objects/Rig';

export interface Portrait {
  key: string;
  /** True when the image is a whole figure rather than a head crop. */
  whole: boolean;
}

export function portraitFor(scene: Phaser.Scene, def: DefenderDef): Portrait | undefined {
  if (def.art.kind === 'build') {
    return scene.textures.exists(def.art.key) ? { key: def.art.key, whole: true } : undefined;
  }
  const painted = fullSpriteKey(def.art.id);
  if (scene.textures.exists(painted)) return { key: painted, whole: true };
  const head = `unit.${def.art.id}.head`;
  return scene.textures.exists(head) ? { key: head, whole: false } : undefined;
}
