/**
 * Character assembly.
 *
 * `characterLayout` is the single source of truth for where each body part
 * sits relative to a character's feet. Both the runtime puppet (`Rig`) and the
 * static character sheets used for cards, portraits and the shop read from it,
 * so a pose tweak shows up everywhere at once.
 *
 * Coordinate space: origin at the feet, +x is the facing direction, +y points
 * DOWN (matching the engine), so body parts have negative y.
 */
import { Svg } from './Svg';
import type { CharacterArt, PartArt, Skeleton } from './humanoid';
import { armSpan, buildCharacter } from './humanoid';
import type { CharacterSpec } from './humanoid';

export interface PartPlacement {
  name: string;
  x: number;
  y: number;
  /** Radians, clockwise, applied around the part's pivot. */
  rotation: number;
  part: PartArt;
}

export function armLength(sk: Skeleton): number {
  return armSpan(sk);
}

/** Where the front hand ends up for a given arm rotation. */
export function handPoint(sk: Skeleton, shoulderX: number, rotation: number): { x: number; y: number } {
  const len = armLength(sk);
  const shoulderY = -sk.shoulder + (sk.shoulder - sk.hip) * 0.2;
  return {
    x: shoulderX + Math.sin(rotation) * len,
    y: shoulderY + Math.cos(rotation) * len,
  };
}

export interface RestPose {
  armBack: number;
  armFront: number;
  legBack: number;
  legFront: number;
  torso: number;
  head: number;
}

export const REST_POSE: RestPose = {
  armBack: -0.24,
  armFront: 0.44,
  legBack: 0.12,
  legFront: -0.12,
  torso: 0,
  head: 0,
};

/**
 * Extra rotation applied to a weapon on top of the arm's swing.
 * Most weapons are drawn pointing up; the bow is drawn upright and the
 * crossbow is drawn already horizontal, so both need no correction.
 */
const WEAPON_GRIP_ROTATION: Record<string, number> = {
  sword: 0.42,
  greatsword: 0.34,
  dagger: 0.5,
  axe: 0.3,
  greataxe: 0.26,
  club: -0.55,
  hammer: -0.5,
  spear: 0.12,
  staff: 0.02,
  scythe: 0.16,
  torch: 0.2,
  bow: 0,
  crossbow: 0.05,
};

/** Ordered back-to-front placement of every part of a character. */
export function characterLayout(art: CharacterArt, pose: RestPose = REST_POSE): PartPlacement[] {
  const sk = art.skeleton;
  const by = (n: string): PartArt | undefined => art.parts.find((p) => p.name === n);
  const out: PartPlacement[] = [];
  const shoulderBackX = -sk.chestWidth * 0.26;
  const shoulderFrontX = sk.chestWidth * 0.24;
  const shoulderY = -sk.shoulder + (sk.shoulder - sk.hip) * 0.2;
  const push = (name: string, x: number, y: number, rotation: number): void => {
    const part = by(name);
    if (part) out.push({ name, x, y, rotation, part });
  };

  push('wings', -sk.lean, -sk.shoulder - sk.headR * 0.1, 0);
  push('cape', -sk.lean * 1.4, -sk.shoulder - sk.headR * 0.15, 0);
  push('armBack', shoulderBackX, shoulderY, pose.armBack);
  push('legBack', -sk.hipWidth * 0.24, -sk.hip, pose.legBack);
  push('legFront', sk.hipWidth * 0.24, -sk.hip, pose.legFront);
  push('torso', 0, -sk.shoulder, pose.torso);

  // The shield is carried on the near side, guarding the chest.
  const offhand = by('offhand');
  if (offhand) {
    out.push({
      name: 'offhand',
      x: -sk.hipWidth * 0.3,
      y: -sk.shoulder + (sk.shoulder - sk.hip) * 0.42,
      rotation: -0.12,
      part: offhand,
    });
  }

  push('head', sk.lean * 0.55, -sk.neck, pose.head);
  push('armFront', shoulderFrontX, shoulderY, pose.armFront);

  const weapon = by('weapon');
  if (weapon) {
    const hand = handPoint(sk, shoulderFrontX, pose.armFront);
    const grip = WEAPON_GRIP_ROTATION[art.spec.weapon ?? ''] ?? 0;
    out.push({ name: 'weapon', x: hand.x, y: hand.y, rotation: pose.armFront + grip, part: weapon });
  }
  return out;
}

export interface ComposeOptions {
  pose?: RestPose;
  /** Extra padding around the computed bounds, in art units. */
  pad?: number;
  shadow?: boolean;
  /** Draw the aura glow behind the character. */
  aura?: boolean;
}

/** Renders a full character into one SVG - used for cards, portraits and shops. */
export function composeCharacter(art: CharacterArt, opts: ComposeOptions = {}): Svg {
  const pose = opts.pose ?? REST_POSE;
  const pad = opts.pad ?? 10;
  const placements = characterLayout(art, pose);

  // Bounds: rotate each part's box corners around its pivot.
  let minX = -art.skeleton.hipWidth;
  let maxX = art.skeleton.hipWidth;
  let minY = 0;
  let maxY = 6;
  for (const p of placements) {
    const { svg, pivotX, pivotY } = p.part;
    const px = pivotX * svg.w;
    const py = pivotY * svg.h;
    const cos = Math.cos(p.rotation);
    const sin = Math.sin(p.rotation);
    for (const [cxp, cyp] of [
      [0, 0],
      [svg.w, 0],
      [0, svg.h],
      [svg.w, svg.h],
    ] as Array<[number, number]>) {
      const dx = cxp - px;
      const dy = cyp - py;
      const x = p.x + dx * cos - dy * sin;
      const y = p.y + dx * sin + dy * cos;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  minX -= pad;
  maxX += pad;
  minY -= pad;
  maxY += pad;

  const w = Math.ceil(maxX - minX);
  const h = Math.ceil(maxY - minY);
  const ox = -minX;
  const oy = -minY;

  const doc = new Svg(w, h);
  if (opts.aura !== false && art.spec.aura) {
    doc.glow(ox, oy - art.skeleton.shoulder * 0.7, art.height * 0.52, art.spec.aura, 0.3);
  }
  if (opts.shadow !== false) {
    doc.groundShadow(ox, oy - 2, art.skeleton.hipWidth * 1.15, art.skeleton.hipWidth * 0.36);
  }
  for (const p of placements) {
    const { svg, pivotX, pivotY } = p.part;
    const px = pivotX * svg.w;
    const py = pivotY * svg.h;
    const deg = (p.rotation * 180) / Math.PI;
    doc.raw(
      `<g transform="translate(${(ox + p.x).toFixed(2)} ${(oy + p.y).toFixed(2)}) rotate(${deg.toFixed(2)}) translate(${(-px).toFixed(2)} ${(-py).toFixed(2)})">${svg.toString()}</g>`,
    );
  }
  return doc;
}

const cache = new Map<string, CharacterArt>();

/** Character art is deterministic, so build each spec at most once. */
export function characterArt(spec: CharacterSpec): CharacterArt {
  const hit = cache.get(spec.id);
  if (hit) return hit;
  const built = buildCharacter(spec);
  cache.set(spec.id, built);
  return built;
}
