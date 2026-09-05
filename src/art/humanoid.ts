/**
 * Parametric humanoid art generator.
 *
 * Every fighter in the game - goblin, orc, paladin, the Demon King - is one
 * `CharacterSpec` fed through this file. Each character is emitted as a set of
 * separate part textures (head, torso, arms, legs, weapon...) with pivot
 * points, so `Rig` can animate them like a cut-out puppet: no spritesheets,
 * smooth at any resolution, and recolourable at runtime.
 *
 * Art direction rules encoded here, applied uniformly so the cast reads as one
 * family:
 *   - exaggerated proportions: big head, big hands, small feet
 *   - chunky dark outline on every silhouette shape
 *   - vertical light-to-shadow ramp (key light from the upper left)
 *   - one saturated accent colour per character to carry its identity
 */
import { darken, lighten, mix, withAlpha } from '../core/color';
import { Svg, draw } from './Svg';

export type Build = 'small' | 'lean' | 'broad' | 'huge';
export type HeadShape = 'round' | 'square' | 'long' | 'skull';
export type Ears = 'none' | 'pointy' | 'big' | 'torn';
export type Horns = 'none' | 'small' | 'curved' | 'crown' | 'antler';
export type Jaw = 'none' | 'tusks' | 'fangs' | 'beard';
export type Headgear = 'none' | 'cap' | 'full' | 'crown' | 'hood' | 'wizard' | 'plume';
export type WeaponKind =
  | 'none'
  | 'sword'
  | 'greatsword'
  | 'axe'
  | 'greataxe'
  | 'club'
  | 'spear'
  | 'bow'
  | 'staff'
  | 'dagger'
  | 'hammer'
  | 'scythe'
  | 'torch'
  | 'crossbow';
export type Offhand = 'none' | 'shield' | 'buckler' | 'orb' | 'lantern';
export type Wings = 'none' | 'bat' | 'feather';

export interface CharacterSpec {
  id: string;
  /** Art-space height in px, feet to crown (before the helmet). */
  height: number;
  build: Build;
  /** Skin / hide colour. */
  skin: string;
  /** Tunic, robe or under-layer. */
  cloth: string;
  /** Armour plate; omit for unarmoured characters. */
  metal?: string;
  /** The one saturated identity colour: trims, gems, magic. */
  accent: string;
  /** Eye colour (or glow colour when `glowEyes`). */
  eye?: string;
  glowEyes?: boolean;
  head?: {
    shape?: HeadShape;
    ears?: Ears;
    horns?: Horns;
    jaw?: Jaw;
    gear?: Headgear;
    /** Positive looks angry, negative looks noble/calm. */
    brow?: number;
    hair?: string;
  };
  weapon?: WeaponKind;
  offhand?: Offhand;
  cape?: string;
  wings?: Wings;
  /** Faint magical aura drawn behind the body. */
  aura?: string;
}

export interface PartArt {
  /** Suffix appended to the character id to form the texture key. */
  name: string;
  svg: Svg;
  /** Pivot in 0..1 texture space; the rig rotates the part around this. */
  pivotX: number;
  pivotY: number;
}

export interface Skeleton {
  /** All distances are in art px measured UP from the ground line. */
  hip: number;
  shoulder: number;
  neck: number;
  headCenter: number;
  headR: number;
  shoulderSpread: number;
  legThickness: number;
  armThickness: number;
  hipWidth: number;
  chestWidth: number;
  /** Horizontal offset of the front-facing limbs (character faces +x). */
  lean: number;
}

export interface CharacterArt {
  id: string;
  spec: CharacterSpec;
  skeleton: Skeleton;
  parts: PartArt[];
  height: number;
}

const BUILDS: Record<Build, { limb: number; chest: number; headScale: number; hip: number }> = {
  small: { limb: 0.104, chest: 0.34, headScale: 0.215, hip: 0.26 },
  lean: { limb: 0.096, chest: 0.34, headScale: 0.185, hip: 0.25 },
  broad: { limb: 0.13, chest: 0.46, headScale: 0.18, hip: 0.35 },
  huge: { limb: 0.163, chest: 0.55, headScale: 0.17, hip: 0.42 },
};

export function skeletonFor(spec: CharacterSpec): Skeleton {
  const h = spec.height;
  const b = BUILDS[spec.build];
  return {
    hip: h * 0.34,
    shoulder: h * 0.66,
    neck: h * 0.685,
    headCenter: h * (0.66 + b.headScale * 0.78),
    headR: h * b.headScale,
    shoulderSpread: h * b.chest * 0.5,
    legThickness: h * b.limb * 1.15,
    armThickness: h * b.limb,
    hipWidth: h * b.hip,
    chestWidth: h * b.chest,
    lean: h * 0.03,
  };
}

/* ------------------------------------------------------------------ head - */

function drawHorns(svg: Svg, kind: Horns, R: number, cx: number, cy: number, color: string): void {
  const o = { width: R * 0.14, color: darken(color, 0.55) };
  const horn = (sx: number, len: number, curl: number, thick: number, tiltX: number): string => {
    const bx = cx + sx * R * 0.72 + tiltX;
    const by = cy - R * 0.55;
    const tipX = bx + sx * len * curl;
    const tipY = by - len;
    const c1x = bx + sx * len * 0.15;
    const c1y = by - len * 0.6;
    return (
      `M ${bx - sx * thick} ${by + thick * 0.4} ` +
      `Q ${c1x - sx * thick * 0.4} ${c1y} ${tipX} ${tipY} ` +
      `Q ${c1x + sx * thick * 0.8} ${c1y + thick * 0.2} ${bx + sx * thick} ${by + thick * 0.5} Z`
    );
  };
  if (kind === 'small') {
    for (const s of [-1, 1]) svg.path(horn(s, R * 0.55, 0.35, R * 0.17, 0), color, o);
  } else if (kind === 'curved') {
    for (const s of [-1, 1]) svg.path(horn(s, R * 1.05, 0.75, R * 0.23, 0), color, o);
  } else if (kind === 'crown') {
    for (const s of [-1, 1]) {
      svg.path(horn(s, R * 1.45, 0.62, R * 0.26, 0), color, o);
      svg.path(horn(s, R * 0.85, 1.15, R * 0.16, s * R * 0.18), color, o);
    }
  } else if (kind === 'antler') {
    for (const s of [-1, 1]) {
      svg.path(horn(s, R * 1.2, 0.55, R * 0.14, 0), color, o);
      svg.path(horn(s, R * 0.6, 1.4, R * 0.1, s * R * 0.3), color, o);
    }
  }
}

function drawHeadgear(
  svg: Svg,
  gear: Headgear,
  R: number,
  cx: number,
  cy: number,
  metal: string,
  accent: string,
): void {
  const mo = { width: R * 0.13 };
  switch (gear) {
    case 'cap':
      svg.path(
        `M ${cx - R * 1.02} ${cy - R * 0.18} Q ${cx} ${cy - R * 1.5} ${cx + R * 1.02} ${cy - R * 0.18} ` +
          `Q ${cx} ${cy - R * 0.62} ${cx - R * 1.02} ${cy - R * 0.18} Z`,
        metal,
        mo,
      );
      svg.sheen(
        `M ${cx - R * 0.7} ${cy - R * 0.5} Q ${cx - R * 0.3} ${cy - R * 1.15} ${cx + R * 0.1} ${cy - R * 1.05} ` +
          `Q ${cx - R * 0.3} ${cy - R * 0.85} ${cx - R * 0.55} ${cy - R * 0.4} Z`,
        0.32,
      );
      break;
    case 'full':
      svg.path(
        `M ${cx - R * 1.05} ${cy + R * 0.1} Q ${cx - R * 1.05} ${cy - R * 1.35} ${cx} ${cy - R * 1.35} ` +
          `Q ${cx + R * 1.05} ${cy - R * 1.35} ${cx + R * 1.05} ${cy + R * 0.1} ` +
          `L ${cx + R * 0.72} ${cy + R * 0.1} L ${cx + R * 0.72} ${cy - R * 0.25} ` +
          `L ${cx - R * 0.72} ${cy - R * 0.25} L ${cx - R * 0.72} ${cy + R * 0.1} Z`,
        metal,
        mo,
      );
      // nose guard
      svg.path(
        `M ${cx + R * 0.5} ${cy - R * 0.3} L ${cx + R * 0.74} ${cy - R * 0.3} ` +
          `L ${cx + R * 0.74} ${cy + R * 0.45} Q ${cx + R * 0.62} ${cy + R * 0.6} ${cx + R * 0.5} ${cy + R * 0.45} Z`,
        metal,
        { width: R * 0.1 },
      );
      break;
    case 'crown':
      svg.path(
        `M ${cx - R * 0.95} ${cy - R * 0.6} L ${cx - R * 0.95} ${cy - R * 1.35} ` +
          `L ${cx - R * 0.5} ${cy - R * 0.95} L ${cx} ${cy - R * 1.6} ` +
          `L ${cx + R * 0.5} ${cy - R * 0.95} L ${cx + R * 0.95} ${cy - R * 1.35} ` +
          `L ${cx + R * 0.95} ${cy - R * 0.6} Z`,
        accent,
        { width: R * 0.12 },
      );
      svg.circle(cx, cy - R * 0.85, R * 0.14, '#ff4d6d', { width: R * 0.07 });
      break;
    case 'hood':
      // Drawn as a cowl that arcs over the crown and falls behind the jaw, so
      // the face stays readable at gameplay size.
      svg.path(
        `M ${cx - R * 1.18} ${cy + R * 0.95} Q ${cx - R * 1.35} ${cy - R * 0.95} ${cx - R * 0.2} ${cy - R * 1.28} ` +
          `Q ${cx + R * 0.95} ${cy - R * 1.15} ${cx + R * 0.98} ${cy - R * 0.42} ` +
          `L ${cx + R * 0.5} ${cy - R * 0.5} Q ${cx + R * 0.3} ${cy - R * 0.98} ${cx - R * 0.32} ${cy - R * 0.86} ` +
          `Q ${cx - R * 0.88} ${cy - R * 0.66} ${cx - R * 0.66} ${cy + R * 0.95} Z`,
        accent,
        { width: R * 0.13 },
      );
      break;
    case 'wizard':
      svg.path(
        `M ${cx - R * 1.15} ${cy - R * 0.55} Q ${cx - R * 0.3} ${cy - R * 0.95} ${cx + R * 1.1} ${cy - R * 0.5} ` +
          `Q ${cx + R * 0.55} ${cy - R * 1.2} ${cx + R * 0.15} ${cy - R * 2.6} ` +
          `Q ${cx - R * 0.35} ${cy - R * 1.3} ${cx - R * 1.15} ${cy - R * 0.55} Z`,
        accent,
        { width: R * 0.13 },
      );
      svg.circle(cx + R * 0.18, cy - R * 2.55, R * 0.16, '#ffd76a', { width: R * 0.06 });
      break;
    case 'plume':
      svg.path(
        `M ${cx - R * 1.02} ${cy - R * 0.2} Q ${cx} ${cy - R * 1.45} ${cx + R * 1.02} ${cy - R * 0.2} ` +
          `Q ${cx} ${cy - R * 0.6} ${cx - R * 1.02} ${cy - R * 0.2} Z`,
        metal,
        mo,
      );
      svg.path(
        `M ${cx - R * 0.1} ${cy - R * 1.25} Q ${cx - R * 0.95} ${cy - R * 2.3} ${cx - R * 1.5} ${cy - R * 1.5} ` +
          `Q ${cx - R * 0.7} ${cy - R * 1.6} ${cx - R * 0.05} ${cy - R * 0.95} Z`,
        accent,
        { width: R * 0.1 },
      );
      break;
    default:
      break;
  }
}

function drawHead(spec: CharacterSpec, sk: Skeleton): PartArt {
  const R = sk.headR;
  const box = R * 5.2;
  const cx = box / 2;
  const cy = box * 0.54;
  const svg = draw(box, box, (s) => {
    const h = spec.head ?? {};
    const shape = h.shape ?? 'round';
    const outline = { width: R * 0.15 };
    const eyeColor = spec.eye ?? '#2b2f45';

    if (h.horns && h.horns !== 'none') {
      drawHorns(s, h.horns, R, cx, cy, spec.metal ? mix(spec.metal, '#efe6d2', 0.35) : '#d9cfbb');
    }

    // ears sit behind the skull
    if (h.ears === 'pointy' || h.ears === 'big' || h.ears === 'torn') {
      const len = h.ears === 'big' ? R * 0.95 : h.ears === 'torn' ? R * 0.75 : R * 0.66;
      for (const sgn of [-1, 1]) {
        const bx = cx + sgn * R * 0.78;
        const tipX = bx + sgn * len * 1.15;
        const tipY = cy - len * 0.5;
        const notch =
          h.ears === 'torn'
            ? `L ${bx + sgn * len * 0.55} ${cy - len * 0.32} L ${bx + sgn * len * 0.62} ${cy - len * 0.6} `
            : '';
        s.path(
          `M ${bx} ${cy + R * 0.18} ${notch}L ${tipX} ${tipY} Q ${bx + sgn * len * 0.2} ${cy - R * 0.1} ${bx} ${cy - R * 0.35} Z`,
          spec.skin,
          outline,
        );
      }
    }

    if (h.hair) {
      s.path(
        `M ${cx - R * 1.12} ${cy + R * 0.72} Q ${cx - R * 1.3} ${cy - R * 0.9} ${cx - R * 0.25} ${cy - R * 1.2} ` +
          `Q ${cx + R * 0.85} ${cy - R * 1.12} ${cx + R * 0.82} ${cy - R * 0.62} ` +
          `Q ${cx + R * 0.35} ${cy - R * 0.92} ${cx - R * 0.3} ${cy - R * 0.78} ` +
          `Q ${cx - R * 0.9} ${cy - R * 0.58} ${cx - R * 0.74} ${cy + R * 0.7} Z`,
        h.hair,
        { width: R * 0.12 },
      );
    }

    // skull
    if (shape === 'square') {
      s.rect(cx - R, cy - R * 0.95, R * 2, R * 1.95, R * 0.42, spec.skin, outline);
    } else if (shape === 'long') {
      s.ellipse(cx, cy, R * 0.88, R * 1.08, spec.skin, outline);
    } else if (shape === 'skull') {
      s.path(
        `M ${cx - R * 0.95} ${cy - R * 0.25} Q ${cx - R * 0.95} ${cy - R} ${cx} ${cy - R} ` +
          `Q ${cx + R * 0.95} ${cy - R} ${cx + R * 0.95} ${cy - R * 0.2} ` +
          `Q ${cx + R * 0.95} ${cy + R * 0.45} ${cx + R * 0.5} ${cy + R * 0.62} ` +
          `L ${cx + R * 0.42} ${cy + R * 1.05} L ${cx - R * 0.42} ${cy + R * 1.05} ` +
          `L ${cx - R * 0.5} ${cy + R * 0.62} Q ${cx - R * 0.95} ${cy + R * 0.45} ${cx - R * 0.95} ${cy - R * 0.25} Z`,
        spec.skin,
        outline,
      );
    } else {
      s.ellipse(cx, cy, R, R * 0.96, spec.skin, outline);
    }

    // brow ridge, angled by mood
    const brow = h.brow ?? 0;
    if (brow !== 0) {
      const dy = R * 0.12 * Math.sign(brow);
      s.flat(
        `M ${cx - R * 0.62} ${cy - R * 0.2 - dy} Q ${cx} ${cy - R * 0.5} ${cx + R * 0.72} ${cy - R * 0.16 + dy} ` +
          `L ${cx + R * 0.72} ${cy - R * 0.02 + dy} Q ${cx} ${cy - R * 0.3} ${cx - R * 0.62} ${cy - R * 0.02 - dy} Z`,
        darken(spec.skin, 0.5),
      );
    }

    // eyes - the character faces +x, so both eyes are pushed right
    const eyes: Array<[number, number]> = [
      [cx + R * 0.12, cy + R * 0.05],
      [cx + R * 0.62, cy + R * 0.03],
    ];
    for (const [ex, ey] of eyes) {
      if (spec.glowEyes) {
        s.glow(ex, ey, R * 0.42, eyeColor, 0.9);
        s.circle(ex, ey, R * 0.15, lighten(eyeColor, 0.6), { depth: 0 });
      } else {
        s.ellipse(ex, ey, R * 0.19, R * 0.22, '#fdfbf5', { depth: 0, width: R * 0.05 });
        s.circle(ex + R * 0.04, ey + R * 0.02, R * 0.1, eyeColor, { depth: 0 });
        s.circle(ex + R * 0.09, ey - R * 0.05, R * 0.035, '#ffffff', { depth: 0 });
      }
    }

    // jaw features
    if (h.jaw === 'tusks') {
      for (const [tx, scale] of [
        [cx + R * 0.16, 1],
        [cx + R * 0.66, 0.85],
      ] as Array<[number, number]>) {
        s.path(
          `M ${tx - R * 0.1} ${cy + R * 0.62} Q ${tx - R * 0.16} ${cy + R * 0.05 * scale} ${tx + R * 0.02} ${cy - R * 0.12 * scale} ` +
            `Q ${tx + R * 0.14} ${cy + R * 0.12} ${tx + R * 0.12} ${cy + R * 0.62} Z`,
          '#f4efe0',
          { width: R * 0.06 },
        );
      }
      s.flat(
        `M ${cx - R * 0.1} ${cy + R * 0.58} Q ${cx + R * 0.45} ${cy + R * 0.78} ${cx + R * 0.86} ${cy + R * 0.5}`,
        'none',
        { width: R * 0.11, color: darken(spec.skin, 0.55) },
      );
    } else if (h.jaw === 'fangs') {
      s.flat(
        `M ${cx + R * 0.02} ${cy + R * 0.46} Q ${cx + R * 0.45} ${cy + R * 0.8} ${cx + R * 0.82} ${cy + R * 0.38} ` +
          `Q ${cx + R * 0.45} ${cy + R * 0.56} ${cx + R * 0.02} ${cy + R * 0.46} Z`,
        darken(spec.skin, 0.62),
      );
      for (const fx of [cx + R * 0.2, cx + R * 0.62]) {
        s.flat(`M ${fx - R * 0.07} ${cy + R * 0.48} L ${fx + R * 0.07} ${cy + R * 0.48} L ${fx} ${cy + R * 0.75} Z`, '#f7f2e6');
      }
    } else if (h.jaw === 'beard') {
      s.path(
        `M ${cx - R * 0.85} ${cy + R * 0.15} Q ${cx - R * 0.75} ${cy + R * 1.35} ${cx + R * 0.1} ${cy + R * 1.45} ` +
          `Q ${cx + R * 0.9} ${cy + R * 1.25} ${cx + R * 0.86} ${cy + R * 0.2} ` +
          `Q ${cx + R * 0.5} ${cy + R * 0.75} ${cx - R * 0.1} ${cy + R * 0.7} ` +
          `Q ${cx - R * 0.6} ${cy + R * 0.66} ${cx - R * 0.85} ${cy + R * 0.15} Z`,
        h.hair ?? '#d8d2c4',
        { width: R * 0.11 },
      );
    }

    if (h.gear && h.gear !== 'none') {
      drawHeadgear(s, h.gear, R, cx, cy, spec.metal ?? '#9aa4b4', spec.accent);
    }
  });
  // neck attaches just below the skull
  return { name: 'head', svg, pivotX: 0.5, pivotY: (cy + R * 0.92) / box };
}

/* ----------------------------------------------------------------- torso - */

function drawTorso(spec: CharacterSpec, sk: Skeleton): PartArt {
  const w = sk.chestWidth * 2.1;
  const h = (sk.shoulder - sk.hip) * 1.28;
  const cx = w / 2;
  const top = h * 0.12;
  const chest = sk.chestWidth * 0.58;
  const waist = sk.hipWidth * 0.5;
  const bottom = h * 0.9;
  const svg = draw(w, h, (s) => {
    const outline = { width: sk.headR * 0.15 };
    const body = spec.metal ?? spec.cloth;
    // Shoulders are the widest point; the silhouette tapers into the belt.
    s.path(
      `M ${cx - chest} ${top + h * 0.1} Q ${cx} ${top - h * 0.06} ${cx + chest} ${top + h * 0.1} ` +
        `Q ${cx + chest * 0.92} ${top + h * 0.45} ${cx + waist} ${bottom} ` +
        `Q ${cx} ${bottom + h * 0.09} ${cx - waist} ${bottom} ` +
        `Q ${cx - chest * 0.92} ${top + h * 0.45} ${cx - chest} ${top + h * 0.1} Z`,
      body,
      outline,
    );

    if (spec.metal) {
      // breastplate ridge + belly plate
      s.flat(
        `M ${cx - chest * 0.72} ${top + h * 0.22} Q ${cx} ${top + h * 0.42} ${cx + chest * 0.72} ${top + h * 0.2}`,
        'none',
        { width: sk.headR * 0.1, color: darken(spec.metal, 0.45) },
      );
      s.path(
        `M ${cx - waist * 0.92} ${bottom - h * 0.3} Q ${cx} ${bottom - h * 0.16} ${cx + waist * 0.92} ${bottom - h * 0.3} ` +
          `L ${cx + waist * 0.86} ${bottom - h * 0.05} Q ${cx} ${bottom + h * 0.04} ${cx - waist * 0.86} ${bottom - h * 0.05} Z`,
        lighten(spec.metal, 0.12),
        { width: sk.headR * 0.09 },
      );
    } else {
      // tunic hem + shoulder strap
      s.flat(
        `M ${cx - chest * 0.8} ${top + h * 0.18} L ${cx + chest * 0.5} ${bottom - h * 0.12} ` +
          `L ${cx + chest * 0.18} ${bottom - h * 0.1} L ${cx - chest * 0.95} ${top + h * 0.3} Z`,
        darken(spec.cloth, 0.28),
      );
    }

    // belt
    s.rect(cx - waist * 1.06, bottom - h * 0.12, waist * 2.12, h * 0.14, h * 0.05, darken(spec.cloth, 0.42), {
      width: sk.headR * 0.1,
    });
    s.rect(cx - waist * 0.26, bottom - h * 0.14, waist * 0.52, h * 0.18, h * 0.04, spec.accent, {
      width: sk.headR * 0.09,
    });

    // collar - hides the seam where the head sits on the torso
    s.ellipse(cx, top + h * 0.06, chest * 0.42, h * 0.08, darken(spec.cloth, 0.3), { width: sk.headR * 0.12 });

    // rim light down the lit side
    s.sheen(
      `M ${cx - chest * 0.94} ${top + h * 0.12} Q ${cx - chest * 1.0} ${top + h * 0.45} ${cx - waist * 0.95} ${bottom - h * 0.06} ` +
        `L ${cx - waist * 0.72} ${bottom - h * 0.08} Q ${cx - chest * 0.76} ${top + h * 0.44} ${cx - chest * 0.7} ${top + h * 0.16} Z`,
      0.22,
    );
  });
  return { name: 'torso', svg, pivotX: 0.5, pivotY: top / h };
}

/* ------------------------------------------------------------------ limbs - */

/** Shoulder-to-hand distance. Kept here so `compose` can find the hand. */
export function armSpan(sk: Skeleton): number {
  return (sk.shoulder - sk.hip) * 0.86;
}

function drawArm(spec: CharacterSpec, sk: Skeleton, back: boolean): PartArt {
  const t = sk.armThickness * (back ? 0.92 : 1);
  const len = armSpan(sk);
  const w = t * 3.4;
  const h = len + t * 2.6;
  const cx = w / 2;
  const skin = back ? darken(spec.skin, 0.16) : spec.skin;
  const sleeve = back ? darken(spec.metal ?? spec.cloth, 0.16) : spec.metal ?? spec.cloth;
  const svg = draw(w, h, (s) => {
    const outline = { width: sk.headR * 0.14 };
    s.capsule(cx, t * 0.9, cx + t * 0.12, t * 0.9 + len, t, skin, outline);
    // Shoulder cap: a pauldron on armoured units, a cloth sleeve otherwise.
    if (spec.metal) {
      s.ellipse(cx, t * 0.82, t * 0.72, t * 0.64, sleeve, outline);
      s.sheen(`M ${cx - t * 0.5} ${t * 0.68} Q ${cx - t * 0.08} ${t * 0.3} ${cx + t * 0.24} ${t * 0.5} Q ${cx - t * 0.16} ${t * 0.56} ${cx - t * 0.4} ${t * 0.86} Z`, 0.3);
    } else {
      s.rect(cx - t * 0.6, t * 0.5, t * 1.2, t * 0.9, t * 0.4, sleeve, outline);
    }
    // Big cartoon glove.
    s.circle(cx + t * 0.12, t * 0.9 + len, t * 0.75, darken(spec.cloth, 0.2), outline);
  });
  return { name: back ? 'armBack' : 'armFront', svg, pivotX: 0.5, pivotY: (t * 0.9) / h };
}

function drawLeg(spec: CharacterSpec, sk: Skeleton, back: boolean): PartArt {
  const t = sk.legThickness * (back ? 0.94 : 1);
  const len = sk.hip;
  const w = t * 3.6;
  const h = len + t * 1.9;
  const cx = w / 2;
  const skin = back ? darken(spec.skin, 0.18) : spec.skin;
  const svg = draw(w, h, (s) => {
    const outline = { width: sk.headR * 0.14 };
    s.capsule(cx, t * 0.7, cx, t * 0.7 + len * 0.82, t, skin, outline);
    // boot
    s.path(
      `M ${cx - t * 0.62} ${t * 0.7 + len * 0.66} L ${cx + t * 0.62} ${t * 0.7 + len * 0.66} ` +
        `L ${cx + t * 0.66} ${t * 0.7 + len * 0.98} L ${cx + t * 1.35} ${t * 0.7 + len * 1.02} ` +
        `Q ${cx + t * 1.5} ${t * 0.7 + len * 1.2} ${cx + t * 1.15} ${t * 0.7 + len * 1.22} ` +
        `L ${cx - t * 0.62} ${t * 0.7 + len * 1.22} Z`,
      darken(spec.cloth, 0.38),
      outline,
    );
  });
  return { name: back ? 'legBack' : 'legFront', svg, pivotX: 0.5, pivotY: (t * 0.7) / h };
}

/* ---------------------------------------------------------------- weapons - */

const STEEL = '#c3ccd8';

export function drawWeapon(kind: WeaponKind, scale: number, accent: string, metal = STEEL): PartArt | null {
  if (kind === 'none') return null;
  const u = scale; // 1 unit ~ character head radius
  const wood = '#7a5334';
  const outline = { width: u * 0.13 };

  const build = (w: number, h: number, gripX: number, gripY: number, fn: (s: Svg) => void): PartArt => ({
    name: 'weapon',
    svg: draw(w, h, fn),
    pivotX: gripX / w,
    pivotY: gripY / h,
  });

  switch (kind) {
    case 'sword': {
      const w = u * 2.4;
      const h = u * 6.2;
      return build(w, h, w / 2, h * 0.86, (s) => {
        s.path(
          `M ${w / 2 - u * 0.34} ${h * 0.66} L ${w / 2 - u * 0.3} ${h * 0.1} L ${w / 2} ${h * 0.02} ` +
            `L ${w / 2 + u * 0.3} ${h * 0.1} L ${w / 2 + u * 0.34} ${h * 0.66} Z`,
          metal,
          outline,
        );
        s.sheen(`M ${w / 2 - u * 0.2} ${h * 0.62} L ${w / 2 - u * 0.16} ${h * 0.12} L ${w / 2 - u * 0.02} ${h * 0.07} L ${w / 2 - u * 0.04} ${h * 0.63} Z`, 0.45);
        s.rect(w / 2 - u * 0.95, h * 0.66, u * 1.9, u * 0.34, u * 0.16, accent, outline);
        s.rect(w / 2 - u * 0.2, h * 0.7, u * 0.4, u * 1.5, u * 0.16, '#5a3a26', outline);
        s.circle(w / 2, h * 0.94, u * 0.28, accent, outline);
      });
    }
    case 'greatsword': {
      const w = u * 3;
      const h = u * 8;
      return build(w, h, w / 2, h * 0.88, (s) => {
        s.path(
          `M ${w / 2 - u * 0.5} ${h * 0.68} L ${w / 2 - u * 0.46} ${h * 0.08} L ${w / 2} ${h * 0.01} ` +
            `L ${w / 2 + u * 0.46} ${h * 0.08} L ${w / 2 + u * 0.5} ${h * 0.68} Z`,
          metal,
          outline,
        );
        s.sheen(`M ${w / 2 - u * 0.3} ${h * 0.64} L ${w / 2 - u * 0.26} ${h * 0.1} L ${w / 2 - u * 0.04} ${h * 0.06} L ${w / 2 - u * 0.06} ${h * 0.65} Z`, 0.4);
        s.rect(w / 2 - u * 1.4, h * 0.68, u * 2.8, u * 0.38, u * 0.18, accent, outline);
        s.rect(w / 2 - u * 0.24, h * 0.72, u * 0.48, u * 1.7, u * 0.18, '#4d3222', outline);
      });
    }
    case 'axe':
    case 'greataxe': {
      const big = kind === 'greataxe';
      const w = u * (big ? 4.4 : 3.4);
      const h = u * (big ? 7.4 : 6);
      return build(w, h, w * 0.42, h * 0.88, (s) => {
        s.rect(w * 0.36, h * 0.06, u * 0.4, h * 0.86, u * 0.18, wood, outline);
        const hy = h * 0.2;
        s.path(
          `M ${w * 0.44} ${hy - u * 0.6} Q ${w * 0.95} ${hy - u * 0.2} ${w * 0.9} ${hy + u * 1.5} ` +
            `Q ${w * 0.7} ${hy + u * 1.0} ${w * 0.44} ${hy + u * 1.1} Z`,
          metal,
          outline,
        );
        if (big) {
          s.path(
            `M ${w * 0.36} ${hy - u * 0.6} Q ${w * 0.02} ${hy - u * 0.1} ${w * 0.08} ${hy + u * 1.4} ` +
              `Q ${w * 0.22} ${hy + u * 0.95} ${w * 0.36} ${hy + u * 1.1} Z`,
            metal,
            outline,
          );
        }
        s.sheen(`M ${w * 0.5} ${hy - u * 0.35} Q ${w * 0.82} ${hy - u * 0.05} ${w * 0.8} ${hy + u * 0.6} Q ${w * 0.62} ${hy + u * 0.2} ${w * 0.5} ${hy + u * 0.1} Z`, 0.35);
      });
    }
    case 'club': {
      const w = u * 2.2;
      const h = u * 5;
      const cx = w / 2;
      return build(w, h, cx, h * 0.92, (s) => {
        s.path(
          `M ${cx - u * 0.22} ${h * 0.97} L ${cx - u * 0.62} ${h * 0.3} ` +
            `Q ${cx} ${h * 0.06} ${cx + u * 0.62} ${h * 0.3} L ${cx + u * 0.22} ${h * 0.97} Z`,
          wood,
          outline,
        );
        for (const [sx, sy] of [
          [-0.58, 0.34],
          [0.58, 0.42],
        ] as Array<[number, number]>) {
          s.path(
            `M ${cx + sx * u} ${h * sy} L ${cx + sx * u * 1.85} ${h * (sy - 0.02)} L ${cx + sx * u} ${h * (sy + 0.06)} Z`,
            '#e8e2d2',
            { width: u * 0.08 },
          );
        }
        s.rect(cx - u * 0.26, h * 0.78, u * 0.52, h * 0.2, u * 0.12, '#4d3222', { width: u * 0.1 });
      });
    }
    case 'hammer': {
      const w = u * 2.8;
      const h = u * 5.4;
      return build(w, h, w / 2, h * 0.92, (s) => {
        s.rect(w / 2 - u * 0.2, h * 0.14, u * 0.4, h * 0.82, u * 0.18, wood, outline);
        s.rect(w / 2 - u * 1.1, h * 0.08, u * 2.2, u * 1.25, u * 0.28, metal, outline);
        s.rect(w / 2 - u * 0.86, h * 0.12, u * 0.4, u * 0.9, u * 0.14, accent, { width: u * 0.1 });
        s.sheen(`M ${w / 2 - u * 0.95} ${h * 0.13} L ${w / 2 + u * 0.95} ${h * 0.12} L ${w / 2 + u * 0.88} ${h * 0.21} L ${w / 2 - u * 0.9} ${h * 0.23} Z`, 0.3);
      });
    }
    case 'spear': {
      const w = u * 1.8;
      const h = u * 7.6;
      return build(w, h, w / 2, h * 0.72, (s) => {
        s.rect(w / 2 - u * 0.16, h * 0.1, u * 0.32, h * 0.9, u * 0.15, wood, outline);
        s.path(
          `M ${w / 2} ${0} L ${w / 2 + u * 0.55} ${h * 0.1} L ${w / 2 + u * 0.2} ${h * 0.16} ` +
            `L ${w / 2 + u * 0.16} ${h * 0.2} L ${w / 2 - u * 0.16} ${h * 0.2} L ${w / 2 - u * 0.2} ${h * 0.16} ` +
            `L ${w / 2 - u * 0.55} ${h * 0.1} Z`,
          metal,
          outline,
        );
      });
    }
    case 'scythe': {
      const w = u * 5.2;
      const h = u * 8.4;
      return build(w, h, w * 0.62, h * 0.86, (s) => {
        s.rect(w * 0.56, h * 0.08, u * 0.34, h * 0.88, u * 0.16, '#3a2a3f', outline);
        s.path(
          `M ${w * 0.6} ${h * 0.12} Q ${w * 0.05} ${h * 0.02} ${w * 0.06} ${h * 0.34} ` +
            `Q ${w * 0.3} ${h * 0.14} ${w * 0.6} ${h * 0.24} Z`,
          metal,
          outline,
        );
        s.glow(w * 0.2, h * 0.2, u * 1.2, accent, 0.4);
      });
    }
    case 'dagger': {
      const w = u * 1.7;
      const h = u * 3.4;
      return build(w, h, w / 2, h * 0.82, (s) => {
        s.path(`M ${w / 2 - u * 0.24} ${h * 0.62} L ${w / 2 - u * 0.2} ${h * 0.1} L ${w / 2} ${h * 0.0} L ${w / 2 + u * 0.2} ${h * 0.1} L ${w / 2 + u * 0.24} ${h * 0.62} Z`, metal, outline);
        s.rect(w / 2 - u * 0.55, h * 0.62, u * 1.1, u * 0.24, u * 0.1, accent, outline);
        s.rect(w / 2 - u * 0.16, h * 0.66, u * 0.32, u * 0.9, u * 0.12, '#4d3222', outline);
      });
    }
    case 'bow': {
      const w = u * 2.6;
      const h = u * 6.4;
      return build(w, h, w * 0.62, h / 2, (s) => {
        s.path(
          `M ${w * 0.72} ${h * 0.04} Q ${w * 0.02} ${h * 0.5} ${w * 0.72} ${h * 0.96}`,
          'none',
          { width: u * 0.38, color: wood },
        );
        s.path(
          `M ${w * 0.72} ${h * 0.04} Q ${w * 0.1} ${h * 0.5} ${w * 0.72} ${h * 0.96}`,
          'none',
          { width: u * 0.14, color: darken(wood, 0.4) },
        );
        s.flat(`M ${w * 0.72} ${h * 0.04} L ${w * 0.72} ${h * 0.96}`, 'none', { width: u * 0.07, color: '#efe7d5' });
        s.rect(w * 0.58, h * 0.42, u * 0.36, h * 0.16, u * 0.12, accent, { width: u * 0.09 });
      });
    }
    case 'crossbow': {
      const w = u * 4.2;
      const h = u * 3.2;
      return build(w, h, w * 0.36, h * 0.66, (s) => {
        s.rect(w * 0.12, h * 0.42, w * 0.8, u * 0.36, u * 0.14, wood, outline);
        s.path(`M ${w * 0.62} ${h * 0.08} Q ${w * 0.96} ${h * 0.45} ${w * 0.62} ${h * 0.86}`, 'none', {
          width: u * 0.3,
          color: darken(metal, 0.2),
        });
        s.flat(`M ${w * 0.62} ${h * 0.08} L ${w * 0.62} ${h * 0.86}`, 'none', { width: u * 0.07, color: '#efe7d5' });
        s.rect(w * 0.12, h * 0.5, u * 0.5, u * 1.1, u * 0.14, darken(wood, 0.3), outline);
      });
    }
    case 'staff': {
      const w = u * 2.8;
      const h = u * 8.2;
      return build(w, h, w / 2, h * 0.78, (s) => {
        s.rect(w / 2 - u * 0.18, h * 0.16, u * 0.36, h * 0.84, u * 0.16, wood, outline);
        s.path(
          `M ${w / 2 - u * 0.7} ${h * 0.24} Q ${w / 2 - u * 0.9} ${h * 0.04} ${w / 2} ${h * 0.05} ` +
            `Q ${w / 2 + u * 0.9} ${h * 0.05} ${w / 2 + u * 0.7} ${h * 0.24} Z`,
          darken(wood, 0.2),
          outline,
        );
        s.glow(w / 2, h * 0.12, u * 1.35, accent, 0.75);
        s.circle(w / 2, h * 0.12, u * 0.46, lighten(accent, 0.45), { width: u * 0.1, color: darken(accent, 0.4) });
      });
    }
    case 'torch': {
      const w = u * 2.4;
      const h = u * 4.6;
      return build(w, h, w / 2, h * 0.86, (s) => {
        s.rect(w / 2 - u * 0.18, h * 0.32, u * 0.36, h * 0.66, u * 0.14, wood, outline);
        s.glow(w / 2, h * 0.2, u * 1.15, '#ff9b3d', 0.8);
        s.path(
          `M ${w / 2} ${h * 0.02} Q ${w / 2 + u * 0.6} ${h * 0.22} ${w / 2} ${h * 0.4} ` +
            `Q ${w / 2 - u * 0.6} ${h * 0.22} ${w / 2} ${h * 0.02} Z`,
          '#ffb545',
          { width: u * 0.08, color: '#c04a12' },
        );
      });
    }
    default:
      return null;
  }
}

function drawOffhand(spec: CharacterSpec, sk: Skeleton): PartArt | null {
  const kind = spec.offhand ?? 'none';
  if (kind === 'none') return null;
  const u = sk.headR;
  const outline = { width: u * 0.14 };
  if (kind === 'shield' || kind === 'buckler') {
    const r = u * (kind === 'shield' ? 1.05 : 0.78);
    const w = r * 2.4;
    const h = r * (kind === 'shield' ? 2.9 : 2.4);
    return {
      name: 'offhand',
      pivotX: 0.5,
      pivotY: 0.5,
      svg: draw(w, h, (s) => {
        if (kind === 'shield') {
          s.path(
            `M ${w / 2 - r} ${h * 0.08} Q ${w / 2} ${h * 0.0} ${w / 2 + r} ${h * 0.08} ` +
              `L ${w / 2 + r * 0.94} ${h * 0.58} Q ${w / 2} ${h * 0.99} ${w / 2 - r * 0.94} ${h * 0.58} Z`,
            spec.metal ?? '#8d97a8',
            outline,
          );
          s.path(
            `M ${w / 2 - r * 0.62} ${h * 0.18} Q ${w / 2} ${h * 0.12} ${w / 2 + r * 0.62} ${h * 0.18} ` +
              `L ${w / 2 + r * 0.58} ${h * 0.55} Q ${w / 2} ${h * 0.84} ${w / 2 - r * 0.58} ${h * 0.55} Z`,
            spec.accent,
            { width: u * 0.1 },
          );
        } else {
          s.circle(w / 2, h / 2, r, spec.metal ?? '#8d97a8', outline);
          s.circle(w / 2, h / 2, r * 0.42, spec.accent, { width: u * 0.1 });
        }
        s.sheen(`M ${w / 2 - r * 0.8} ${h * 0.2} Q ${w / 2 - r * 0.2} ${h * 0.12} ${w / 2 - r * 0.1} ${h * 0.22} Q ${w / 2 - r * 0.5} ${h * 0.3} ${w / 2 - r * 0.66} ${h * 0.48} Z`, 0.3);
      }),
    };
  }
  const r = u * 0.72;
  const w = r * 3;
  const h = r * 3;
  return {
    name: 'offhand',
    pivotX: 0.5,
    pivotY: 0.5,
    svg: draw(w, h, (s) => {
      s.glow(w / 2, h / 2, r * 1.5, spec.accent, 0.85);
      s.circle(w / 2, h / 2, r, lighten(spec.accent, 0.4), { width: u * 0.1, color: darken(spec.accent, 0.45) });
      s.sheen(`M ${w / 2 - r * 0.5} ${h / 2 - r * 0.4} Q ${w / 2 - r * 0.1} ${h / 2 - r * 0.75} ${w / 2 + r * 0.25} ${h / 2 - r * 0.5} Q ${w / 2 - r * 0.15} ${h / 2 - r * 0.3} ${w / 2 - r * 0.35} ${h / 2 - r * 0.05} Z`, 0.5);
    }),
  };
}

function drawCape(spec: CharacterSpec, sk: Skeleton): PartArt | null {
  if (!spec.cape) return null;
  const w = sk.chestWidth * 1.9;
  const h = (sk.shoulder - sk.hip) * 2.1;
  return {
    name: 'cape',
    pivotX: 0.5,
    pivotY: 0.06,
    svg: draw(w, h, (s) => {
      s.path(
        `M ${w * 0.3} ${h * 0.04} Q ${w * 0.5} ${h * -0.02} ${w * 0.7} ${h * 0.04} ` +
          `Q ${w * 0.95} ${h * 0.55} ${w * 0.86} ${h * 0.96} ` +
          `Q ${w * 0.5} ${h * 0.84} ${w * 0.12} ${h * 0.96} ` +
          `Q ${w * 0.06} ${h * 0.55} ${w * 0.3} ${h * 0.04} Z`,
        spec.cape as string,
        { width: sk.headR * 0.14 },
      );
      s.sheen(`M ${w * 0.36} ${h * 0.1} Q ${w * 0.2} ${h * 0.55} ${w * 0.22} ${h * 0.9} L ${w * 0.35} ${h * 0.88} Q ${w * 0.33} ${h * 0.5} ${w * 0.45} ${h * 0.12} Z`, 0.16);
    }),
  };
}

function drawWings(spec: CharacterSpec, sk: Skeleton): PartArt | null {
  const kind = spec.wings ?? 'none';
  if (kind === 'none') return null;
  const w = sk.chestWidth * 4.2;
  const h = sk.chestWidth * 3;
  const color = kind === 'bat' ? darken(spec.accent, 0.25) : '#f2ecdd';
  return {
    name: 'wings',
    pivotX: 0.5,
    pivotY: 0.34,
    svg: draw(w, h, (s) => {
      const outline = { width: sk.headR * 0.13 };
      for (const sgn of [-1, 1]) {
        const bx = w / 2;
        if (kind === 'bat') {
          s.path(
            `M ${bx} ${h * 0.34} Q ${bx + sgn * w * 0.28} ${h * 0.02} ${bx + sgn * w * 0.47} ${h * 0.12} ` +
              `Q ${bx + sgn * w * 0.34} ${h * 0.3} ${bx + sgn * w * 0.44} ${h * 0.44} ` +
              `Q ${bx + sgn * w * 0.28} ${h * 0.42} ${bx + sgn * w * 0.3} ${h * 0.62} ` +
              `Q ${bx + sgn * w * 0.16} ${h * 0.5} ${bx + sgn * w * 0.12} ${h * 0.72} ` +
              `Q ${bx + sgn * w * 0.04} ${h * 0.5} ${bx} ${h * 0.34} Z`,
            color,
            outline,
          );
        } else {
          s.path(
            `M ${bx} ${h * 0.34} Q ${bx + sgn * w * 0.3} ${h * 0.0} ${bx + sgn * w * 0.48} ${h * 0.24} ` +
              `Q ${bx + sgn * w * 0.36} ${h * 0.5} ${bx + sgn * w * 0.2} ${h * 0.78} ` +
              `Q ${bx + sgn * w * 0.08} ${h * 0.56} ${bx} ${h * 0.34} Z`,
            color,
            outline,
          );
          for (let i = 1; i <= 3; i += 1) {
            const t = i / 4;
            s.flat(
              `M ${bx + sgn * w * 0.06} ${h * (0.34 + t * 0.1)} Q ${bx + sgn * w * 0.26} ${h * (0.2 + t * 0.24)} ${bx + sgn * w * (0.44 - t * 0.1)} ${h * (0.28 + t * 0.36)}`,
              'none',
              { width: sk.headR * 0.08, color: withAlpha(darken(color, 0.4), 0.5) },
            );
          }
        }
      }
    }),
  };
}

/** Build every part texture for a character. */
export function buildCharacter(spec: CharacterSpec): CharacterArt {
  const sk = skeletonFor(spec);
  const parts: PartArt[] = [];
  const wings = drawWings(spec, sk);
  if (wings) parts.push(wings);
  const cape = drawCape(spec, sk);
  if (cape) parts.push(cape);
  parts.push(drawArm(spec, sk, true));
  parts.push(drawLeg(spec, sk, true));
  parts.push(drawLeg(spec, sk, false));
  parts.push(drawTorso(spec, sk));
  parts.push(drawHead(spec, sk));
  parts.push(drawArm(spec, sk, false));
  const offhand = drawOffhand(spec, sk);
  if (offhand) parts.push(offhand);
  const weapon = drawWeapon(spec.weapon ?? 'none', sk.headR * 0.58, spec.accent, spec.metal ?? STEEL);
  if (weapon) parts.push(weapon);
  return { id: spec.id, spec, skeleton: sk, parts, height: spec.height };
}
