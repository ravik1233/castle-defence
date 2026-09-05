/**
 * Buildings: the defender structures the player places on the grid, and the
 * castle wall itself - the thing that must not fall.
 */
import { darken, lighten, mix, withAlpha } from '../core/color';
import { Svg, draw } from './Svg';

const STONE = '#8d8b96';
const STONE_DARK = '#5f5d6b';
const WOOD = '#7a5334';

export interface StructureArt {
  svg: Svg;
  /** Origin as a fraction of the texture; structures stand on their base. */
  originX: number;
  originY: number;
}

const based = (svg: Svg): StructureArt => ({ svg, originX: 0.5, originY: 1 });

/** Tithe shrine - the economy building that drips gold. */
export function tithe(): StructureArt {
  const w = 104;
  const h = 128;
  return based(
    draw(w, h, (s) => {
      s.groundShadow(w / 2, h - 8, 44, 14);
      // stepped stone base
      s.rect(10, h - 30, w - 20, 24, 6, STONE, { width: 4 });
      s.rect(18, h - 48, w - 36, 22, 6, lighten(STONE, 0.1), { width: 4 });
      // pillars
      for (const x of [26, w - 34]) {
        s.rect(x, h - 96, 12, 50, 5, '#cfc9be', { width: 4 });
      }
      // roof
      s.path(`M 12 ${h - 92} L ${w / 2} ${h - 122} L ${w - 12} ${h - 92} L ${w - 22} ${h - 84} L 22 ${h - 84} Z`, '#c0894a', {
        width: 4,
      });
      // coin altar
      s.glow(w / 2, h - 66, 30, '#ffd257', 0.55);
      s.ellipse(w / 2, h - 56, 20, 8, '#e0b23c', { width: 4 });
      s.circle(w / 2 - 6, h - 66, 11, '#ffd257', { width: 4 });
      s.circle(w / 2 + 7, h - 71, 9, '#ffe58a', { width: 4 });
      s.sheen(`M ${w / 2 - 10} ${h - 70} Q ${w / 2 - 4} ${h - 76} ${w / 2 + 1} ${h - 72} Q ${w / 2 - 5} ${h - 69} ${w / 2 - 8} ${h - 64} Z`, 0.5);
    }),
  );
}

/** Barricade - cheap high-hp blocker. */
export function barricade(): StructureArt {
  const w = 100;
  const h = 108;
  return based(
    draw(w, h, (s) => {
      s.groundShadow(w / 2, h - 8, 42, 12);
      for (const [x, top, tilt] of [
        [16, 34, -4],
        [42, 22, 0],
        [68, 32, 5],
      ] as Array<[number, number, number]>) {
        s.group(`transform="rotate(${tilt} ${x + 9} ${h - 10})"`, (g) => {
          g.rect(x, top, 18, h - top - 8, 5, WOOD, { width: 4 });
          g.flat(`M ${x + 4} ${top + 14} L ${x + 14} ${top + 12}`, 'none', { width: 2.5, color: darken(WOOD, 0.35) });
          g.flat(`M ${x + 4} ${top + 40} L ${x + 14} ${top + 38}`, 'none', { width: 2.5, color: darken(WOOD, 0.35) });
        });
      }
      // iron banding
      s.rect(8, h - 62, w - 16, 12, 4, '#6c7381', { width: 4 });
      s.rect(8, h - 34, w - 16, 12, 4, '#6c7381', { width: 4 });
      for (const x of [16, w / 2, w - 22]) {
        s.circle(x, h - 56, 3.4, '#3c414d', { depth: 0 });
        s.circle(x, h - 28, 3.4, '#3c414d', { depth: 0 });
      }
      // spikes
      for (const x of [22, 50, 78]) {
        s.path(`M ${x - 7} 30 L ${x} 10 L ${x + 7} 30 Z`, '#cfd6e2', { width: 3.4 });
      }
    }),
  );
}

/** Ballista tower - long range single target. */
export function ballista(): StructureArt {
  const w = 112;
  const h = 148;
  return based(
    draw(w, h, (s) => {
      s.groundShadow(w / 2, h - 8, 44, 14);
      s.rect(18, h - 62, w - 36, 56, 8, STONE, { width: 4.5 });
      s.flat(`M 24 ${h - 44} L ${w - 24} ${h - 44}`, 'none', { width: 3, color: STONE_DARK });
      s.flat(`M 24 ${h - 26} L ${w - 24} ${h - 26}`, 'none', { width: 3, color: STONE_DARK });
      // platform
      s.rect(10, h - 78, w - 20, 20, 6, lighten(STONE, 0.14), { width: 4.5 });
      // frame
      s.rect(w / 2 - 8, h - 118, 16, 44, 6, WOOD, { width: 4 });
      // bow arms
      s.path(`M ${w / 2 - 6} ${h - 112} Q ${w / 2 - 40} ${h - 122} ${w / 2 - 44} ${h - 96}`, 'none', {
        width: 9,
        color: darken(WOOD, 0.15),
      });
      s.path(`M ${w / 2 + 6} ${h - 112} Q ${w / 2 + 40} ${h - 122} ${w / 2 + 44} ${h - 96}`, 'none', {
        width: 9,
        color: darken(WOOD, 0.15),
      });
      s.flat(`M ${w / 2 - 44} ${h - 96} L ${w / 2 + 44} ${h - 96}`, 'none', { width: 3, color: '#efe7d5' });
      // loaded bolt
      s.path(`M ${w / 2} ${h - 140} L ${w / 2 + 7} ${h - 126} L ${w / 2 - 7} ${h - 126} Z`, '#cfd6e2', { width: 3 });
      s.rect(w / 2 - 3, h - 128, 6, 34, 3, '#8a6a44', { width: 3 });
    }),
  );
}

/** Bombard - slow splash damage. */
export function bombard(): StructureArt {
  const w = 116;
  const h = 128;
  return based(
    draw(w, h, (s) => {
      s.groundShadow(w / 2, h - 8, 48, 14);
      s.rect(14, h - 52, w - 28, 46, 8, WOOD, { width: 4.5 });
      s.circle(34, h - 20, 15, '#4d3628', { width: 4.5 });
      s.circle(w - 34, h - 20, 15, '#4d3628', { width: 4.5 });
      s.circle(34, h - 20, 5, '#8a6a44', { width: 3 });
      s.circle(w - 34, h - 20, 5, '#8a6a44', { width: 3 });
      // barrel, angled up toward the enemy side
      s.group(`transform="rotate(-24 ${w / 2} ${h - 56})"`, (g) => {
        g.rect(w / 2 - 16, h - 112, 60, 34, 15, '#5c6472', { width: 4.5 });
        g.ellipse(w / 2 + 44, h - 95, 9, 19, '#3f4652', { width: 4.5 });
        g.rect(w / 2 - 22, h - 106, 16, 22, 7, '#787f8d', { width: 4 });
        g.sheen(`M ${w / 2 - 8} ${h - 106} L ${w / 2 + 34} ${h - 108} L ${w / 2 + 34} ${h - 100} L ${w / 2 - 8} ${h - 98} Z`, 0.28);
      });
      s.glow(w / 2 + 46, h - 92, 16, '#ff9b3d', 0.4);
    }),
  );
}

/** Brazier of warding - slows and burns whatever walks past. */
export function brazier(accent = '#63cfe8'): StructureArt {
  const w = 92;
  const h = 124;
  return based(
    draw(w, h, (s) => {
      s.groundShadow(w / 2, h - 8, 36, 12);
      s.rect(w / 2 - 22, h - 22, 44, 16, 6, STONE, { width: 4 });
      s.rect(w / 2 - 8, h - 74, 16, 56, 6, STONE_DARK, { width: 4 });
      s.path(`M ${w / 2 - 30} ${h - 96} L ${w / 2 + 30} ${h - 96} L ${w / 2 + 20} ${h - 68} L ${w / 2 - 20} ${h - 68} Z`, STONE, {
        width: 4.5,
      });
      s.glow(w / 2, h - 104, 40, accent, 0.75);
      s.path(
        `M ${w / 2} ${h - 132} Q ${w / 2 + 18} ${h - 108} ${w / 2} ${h - 92} Q ${w / 2 - 18} ${h - 108} ${w / 2} ${h - 132} Z`,
        lighten(accent, 0.2),
        { width: 3.5, color: darken(accent, 0.4) },
      );
    }),
  );
}

/* ------------------------------------------------------------ castle wall - */

export interface WallSkin {
  id: string;
  name: string;
  stone: string;
  roof: string;
  banner: string;
  trim: string;
}

export const WALL_SKINS: WallSkin[] = [
  { id: 'stone', name: 'Ironhold Grey', stone: '#8d8b96', roof: '#7c4b3a', banner: '#2f6fb5', trim: '#c8b98f' },
  { id: 'ivory', name: 'Ivory Bastion', stone: '#ddd6c4', roof: '#c9a227', banner: '#d8b24a', trim: '#f2ead6' },
  { id: 'obsidian', name: 'Obsidian Keep', stone: '#4a4657', roof: '#2f2a3d', banner: '#a45cf0', trim: '#7d5cf0' },
  { id: 'verdant', name: 'Verdant Watch', stone: '#7c8b74', roof: '#3f7a4e', banner: '#4fae6a', trim: '#d9e2c4' },
];

/**
 * The wall strip that runs down the left edge of the battlefield.
 * Drawn once at full battlefield height so it can scroll as one piece.
 */
export function castleWall(skin: WallSkin, width: number, height: number): StructureArt {
  const svg = draw(width, height, (s) => {
    const stone = skin.stone;
    s.rect(-10, -10, width + 4, height + 20, 0, stone, { width: 0, depth: 0.7 });
    // vertical light falloff toward the battlefield
    const fade = s.vGradient([
      [0, withAlpha('#000000', 0)],
      [1, withAlpha('#1a1420', 0.45)],
    ]);
    s.raw(`<rect x="0" y="0" width="${width}" height="${height}" fill="${fade}"/>`);

    // masonry courses
    const courseH = 46;
    for (let y = 0, row = 0; y < height; y += courseH, row += 1) {
      const offset = row % 2 === 0 ? 0 : width * 0.28;
      s.flat(`M 0 ${y} L ${width} ${y}`, 'none', { width: 3, color: withAlpha(darken(stone, 0.45), 0.55) });
      for (let x = offset; x < width; x += width * 0.56) {
        s.flat(`M ${x} ${y} L ${x} ${y + courseH}`, 'none', { width: 3, color: withAlpha(darken(stone, 0.45), 0.4) });
      }
    }

    // battlement edge facing the field
    s.rect(width - 20, -6, 26, height + 12, 0, darken(stone, 0.18), { width: 0 });
    for (let y = 8; y < height; y += 78) {
      s.rect(width - 30, y, 22, 34, 5, lighten(stone, 0.14), { width: 4 });
    }

    // torches
    for (let y = 60; y < height; y += 168) {
      s.rect(width - 44, y, 9, 26, 4, '#6a4a2e', { width: 3 });
      s.glow(width - 40, y - 6, 26, '#ffab3d', 0.7);
      s.path(`M ${width - 40} ${y - 22} Q ${width - 30} ${y - 8} ${width - 40} ${y + 2} Q ${width - 50} ${y - 8} ${width - 40} ${y - 22} Z`, '#ffb545', {
        width: 3,
        color: '#c04a12',
      });
    }

    // hanging banners
    for (let y = 130; y < height; y += 210) {
      s.path(
        `M ${width - 78} ${y} L ${width - 34} ${y} L ${width - 34} ${y + 74} L ${width - 56} ${y + 60} L ${width - 78} ${y + 74} Z`,
        skin.banner,
        { width: 4 },
      );
      s.path(`M ${width - 66} ${y + 18} L ${width - 46} ${y + 18} L ${width - 56} ${y + 44} Z`, skin.trim, { width: 3 });
    }
  });
  return { svg, originX: 0, originY: 0 };
}

/** The gate: the thing enemies smash. Sits mid-wall with a health bar over it. */
export function castleGate(skin: WallSkin, width: number, height: number): StructureArt {
  const svg = draw(width, height, (s) => {
    s.path(
      `M 0 ${height} L 0 ${height * 0.34} Q 0 6 ${width * 0.62} 6 L ${width} 6 L ${width} ${height} Z`,
      mix(skin.roof, '#4a3226', 0.4),
      { width: 5 },
    );
    for (let i = 1; i < 5; i += 1) {
      const x = (width / 5) * i;
      s.flat(`M ${x} ${height * 0.12} L ${x} ${height * 0.98}`, 'none', { width: 3, color: 'rgba(30,18,12,0.45)' });
    }
    s.rect(-4, height * 0.3, width + 8, 14, 4, '#5c6472', { width: 4 });
    s.rect(-4, height * 0.72, width + 8, 14, 4, '#5c6472', { width: 4 });
    s.circle(width * 0.72, height * 0.52, 9, '#8a929e', { width: 3.5 });
  });
  return { svg, originX: 0, originY: 0 };
}

/** Decorative keep drawn above the wall so the castle reads as a real place. */
export function castleKeep(skin: WallSkin): StructureArt {
  const w = 260;
  const h = 190;
  return based(
    draw(w, h, (s) => {
      const stone = skin.stone;
      s.rect(30, h - 120, w - 60, 118, 8, stone, { width: 5 });
      for (const x of [6, w - 62]) {
        s.rect(x, h - 150, 56, 148, 8, lighten(stone, 0.08), { width: 5 });
        s.path(`M ${x - 10} ${h - 148} L ${x + 28} ${h - 190} L ${x + 66} ${h - 148} Z`, skin.roof, { width: 5 });
        s.rect(x + 20, h - 116, 16, 26, 8, '#2b2536', { width: 4 });
      }
      s.path(`M 24 ${h - 118} L ${w / 2} ${h - 168} L ${w - 24} ${h - 118} Z`, skin.roof, { width: 5 });
      s.rect(w / 2 - 22, h - 92, 44, 60, 20, '#2b2536', { width: 4.5 });
      s.glow(w / 2, h - 66, 26, '#ffce6a', 0.5);
      s.flat(`M ${w / 2 + 26} ${h - 168} L ${w / 2 + 26} ${h - 196}`, 'none', { width: 4, color: '#6a5a44' });
      s.path(`M ${w / 2 + 26} ${h - 194} L ${w / 2 + 70} ${h - 186} L ${w / 2 + 26} ${h - 176} Z`, skin.banner, { width: 3.5 });
    }),
  );
}
