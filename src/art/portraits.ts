/**
 * Picks the best available image to represent a defender on a card.
 *
 * Order of preference:
 *   1. the idle frame, when an artist drew an animation strip for the unit
 *   2. a painted whole-body sprite, if a painted pack supplied one
 *   3. the generated head, which reads better than a shrunken whole body
 *   4. the structure texture, for buildings
 */
import type Phaser from 'phaser';
import type { DefenderDef } from '../data/types';
import { fullSpriteKey } from '../objects/Rig';

export interface Portrait {
  key: string;
  frame?: number;
  /** True when the image is a whole figure rather than a head crop. */
  whole: boolean;
}

/**
 * The best image for a bare art id. Commanders borrow unit art, so this is
 * the half of `portraitFor` that knows nothing about cards.
 */
export function portraitForArt(scene: Phaser.Scene, artId: string): Portrait | undefined {
  const sheet = `unit.${artId}.sheet`;
  if (scene.textures.exists(sheet)) return { key: sheet, frame: 0, whole: true };
  const idle = `unit.${artId}.frame0`;
  if (scene.textures.exists(idle)) return { key: idle, whole: true };
  const painted = fullSpriteKey(artId);
  if (scene.textures.exists(painted)) return { key: painted, whole: true };
  const head = `unit.${artId}.head`;
  return scene.textures.exists(head) ? { key: head, whole: false } : undefined;
}

export function portraitFor(scene: Phaser.Scene, def: DefenderDef): Portrait | undefined {
  if (def.art.kind === 'build') {
    return scene.textures.exists(def.art.key) ? { key: def.art.key, whole: true } : undefined;
  }
  // Frames first. A unit with drawn frames has no whole-body sprite and no
  // parts to crop a head from, so without this its card comes out blank.
  return portraitForArt(scene, def.art.id);
}
