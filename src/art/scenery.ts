/**
 * Battlefield backdrops. One painted-looking texture per biome, drawn at the
 * exact size of the play area so it can be blitted once with no tiling seams.
 */
import { darken, lighten, mix, withAlpha } from '../core/color';
import { Svg, draw } from './Svg';

export type BiomeId = 'fields' | 'woods' | 'abyss' | 'throne';

export interface Biome {
  id: BiomeId;
  name: string;
  sky: [string, string];
  far: string;
  mid: string;
  ground: string;
  groundAlt: string;
  accent: string;
  /** Colour of the drifting motes rendered over the field. */
  mote: string;
}

export const BIOMES: Record<BiomeId, Biome> = {
  fields: {
    id: 'fields',
    name: 'The Broken Fields',
    sky: ['#7fb4e8', '#dfeaf2'],
    far: '#6f86a8',
    mid: '#4f7a52',
    ground: '#6b9553',
    groundAlt: '#63894d',
    accent: '#d8c98a',
    mote: '#fff3c4',
  },
  woods: {
    id: 'woods',
    name: 'The Ashen Woods',
    sky: ['#4a4468', '#8a7a92'],
    far: '#3d3a55',
    mid: '#2f3a3c',
    ground: '#5a5348',
    groundAlt: '#514a41',
    accent: '#a8926a',
    mote: '#d9c9a8',
  },
  abyss: {
    id: 'abyss',
    name: 'The Gates of the Abyss',
    sky: ['#4a1620', '#a33a24'],
    far: '#3a1a26',
    mid: '#2a1520',
    ground: '#463040',
    groundAlt: '#3d2938',
    accent: '#ff6a2f',
    mote: '#ff9b4d',
  },
  throne: {
    id: 'throne',
    name: 'Throne of the Demon King',
    sky: ['#1a0f22', '#54153a'],
    far: '#241436',
    mid: '#180d24',
    ground: '#2b1f3a',
    groundAlt: '#241a32',
    accent: '#ff3b30',
    mote: '#ff5a6a',
  },
};

/** Rolling silhouette band used for the far/mid parallax layers. */
function hills(s: Svg, w: number, baseY: number, amp: number, color: string, seed: number, alpha = 1): void {
  const step = w / 6;
  let d = `M -20 ${baseY + amp * 2} L -20 ${baseY}`;
  for (let i = 0; i <= 6; i += 1) {
    const x = i * step;
    const rise = Math.sin(seed + i * 1.7) * amp;
    d += ` Q ${x - step * 0.5} ${baseY - amp - rise} ${x} ${baseY - rise * 0.4}`;
  }
  d += ` L ${w + 20} ${baseY + amp * 2} Z`;
  s.flat(d, color, { alpha });
}

function tree(s: Svg, x: number, y: number, scale: number, trunk: string, leaf: string, bare: boolean): void {
  s.flat(`M ${x - 5 * scale} ${y} L ${x - 3 * scale} ${y - 34 * scale} L ${x + 3 * scale} ${y - 34 * scale} L ${x + 5 * scale} ${y} Z`, trunk);
  if (bare) {
    for (const [dx, dy, len] of [
      [-1, -30, 16],
      [1, -36, 18],
      [-1, -42, 12],
    ] as Array<[number, number, number]>) {
      s.flat(
        `M ${x + dx * scale} ${y + dy * scale} L ${x + dx * len * scale} ${y + (dy - len) * scale}`,
        'none',
        { width: 3 * scale, color: trunk },
      );
    }
  } else {
    s.flat(`M ${x} ${y - 74 * scale} Q ${x + 30 * scale} ${y - 50 * scale} ${x + 20 * scale} ${y - 28 * scale} Q ${x} ${y - 18 * scale} ${x - 20 * scale} ${y - 28 * scale} Q ${x - 30 * scale} ${y - 50 * scale} ${x} ${y - 74 * scale} Z`, leaf);
    s.flat(`M ${x - 14 * scale} ${y - 52 * scale} Q ${x} ${y - 66 * scale} ${x + 12 * scale} ${y - 54 * scale} Q ${x} ${y - 50 * scale} ${x - 14 * scale} ${y - 52 * scale} Z`, lighten(leaf, 0.22));
  }
}

/**
 * Full battlefield backdrop.
 * @param rows number of lanes, used to tint alternating rows
 * @param horizon height of the scenery band above the lanes
 */
export function battlefield(biome: Biome, w: number, h: number, rows: number, horizon = 150): Svg {
  return draw(w, h, (s) => {
    const sky = s.vGradient([
      [0, biome.sky[0]],
      [1, biome.sky[1]],
    ]);
    s.raw(`<rect x="0" y="0" width="${w}" height="${horizon + 10}" fill="${sky}"/>`);

    if (biome.id === 'abyss' || biome.id === 'throne') {
      s.glow(w * 0.68, horizon * 0.5, horizon * 1.5, biome.accent, 0.4);
    } else if (biome.id === 'fields') {
      s.circle(w * 0.78, horizon * 0.34, 26, '#fff6d8', { depth: 0 });
      s.glow(w * 0.78, horizon * 0.34, 70, '#ffeaa8', 0.5);
    } else {
      s.circle(w * 0.72, horizon * 0.3, 20, '#e8e2f2', { depth: 0 });
    }

    hills(s, w, horizon * 0.78, horizon * 0.26, biome.far, 1.2, 0.85);
    hills(s, w, horizon * 0.98, horizon * 0.2, biome.mid, 3.4);

    // treeline / spires along the horizon
    const bare = biome.id !== 'fields';
    for (let i = 0; i < 9; i += 1) {
      const x = (w / 9) * i + ((i * 37) % 40);
      const sc = 0.7 + ((i * 13) % 5) / 10;
      tree(s, x, horizon + 6, sc, darken(biome.mid, 0.35), darken(biome.mid, 0.1), bare);
    }

    // ground plane
    const groundTop = horizon;
    const g = s.vGradient([
      [0, darken(biome.ground, 0.22)],
      [0.18, biome.ground],
      [1, lighten(biome.ground, 0.06)],
    ]);
    s.raw(`<rect x="0" y="${groundTop}" width="${w}" height="${h - groundTop}" fill="${g}"/>`);

    // lane banding, so the player can read the rows
    const laneH = (h - groundTop) / rows;
    for (let r = 0; r < rows; r += 1) {
      if (r % 2 === 1) {
        s.raw(
          `<rect x="0" y="${groundTop + r * laneH}" width="${w}" height="${laneH}" fill="${withAlpha(biome.groundAlt, 0.8)}"/>`,
        );
      }
      // A shaded seam plus a light lip: reads as a furrow between lanes.
      s.flat(`M 0 ${groundTop + r * laneH} L ${w} ${groundTop + r * laneH}`, 'none', {
        width: 5,
        color: withAlpha(darken(biome.ground, 0.5), 0.42),
      });
      s.flat(`M 0 ${groundTop + r * laneH + 4} L ${w} ${groundTop + r * laneH + 4}`, 'none', {
        width: 2.5,
        color: withAlpha(lighten(biome.ground, 0.3), 0.3),
      });
    }

    // scattered ground detail, deterministic so the field looks hand-placed
    let seed = 9871;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 46; i += 1) {
      const x = rnd() * w;
      const y = groundTop + 10 + rnd() * (h - groundTop - 20);
      const sc = 0.5 + rnd();
      if (biome.id === 'fields') {
        s.flat(
          `M ${x} ${y} q ${3 * sc} ${-9 * sc} ${6 * sc} 0 q ${3 * sc} ${-11 * sc} ${6 * sc} 0`,
          'none',
          { width: 2.2 * sc, color: withAlpha(lighten(biome.ground, 0.3), 0.7) },
        );
      } else if (biome.id === 'woods') {
        s.flat(`M ${x} ${y} l ${9 * sc} ${-3 * sc} l ${5 * sc} ${4 * sc} Z`, withAlpha(biome.accent, 0.35));
      } else {
        s.flat(
          `M ${x} ${y} l ${14 * sc} ${-4 * sc} l ${10 * sc} ${6 * sc}`,
          'none',
          { width: 2.4 * sc, color: withAlpha(biome.accent, 0.4) },
        );
      }
    }

    // vignette keeps the eye on the lanes
    const vig = s.radial(
      [
        [0.55, 'rgba(0,0,0,0)'],
        [1, 'rgba(20,10,26,0.26)'],
      ],
      0.5,
      0.5,
      0.82,
    );
    s.raw(`<rect x="0" y="0" width="${w}" height="${h}" fill="${vig}"/>`);
  });
}

/** Menu backdrop: the castle silhouetted against a burning horizon. */
export function menuBackdrop(w: number, h: number): Svg {
  return draw(w, h, (s) => {
    const sky = s.vGradient([
      [0, '#160f22'],
      [0.45, '#3d1b35'],
      [0.75, '#8a2f2a'],
      [1, '#d4642c'],
    ]);
    s.raw(`<rect x="0" y="0" width="${w}" height="${h}" fill="${sky}"/>`);
    s.glow(w * 0.5, h * 0.82, w * 0.55, '#ff8a3d', 0.5);

    // distant demon host: a field of spears
    for (let i = 0; i < 70; i += 1) {
      const x = (i * 97) % w;
      const y = h * 0.74 + ((i * 53) % 60);
      s.flat(`M ${x} ${y} L ${x + 3} ${y - 26}`, 'none', { width: 2, color: 'rgba(20,10,16,0.55)' });
    }

    hills(s, w, h * 0.78, h * 0.06, '#2a1524', 2.1);

    // the castle, small and defiant
    const cx = w * 0.5;
    const base = h * 0.8;
    s.flat(`M ${cx - 130} ${base} L ${cx - 130} ${base - 90} L ${cx + 130} ${base - 90} L ${cx + 130} ${base} Z`, '#1c1426');
    for (const x of [cx - 150, cx + 90]) {
      s.flat(`M ${x} ${base} L ${x} ${base - 140} L ${x + 60} ${base - 140} L ${x + 60} ${base} Z`, '#241a30');
      s.flat(`M ${x - 12} ${base - 138} L ${x + 30} ${base - 190} L ${x + 72} ${base - 138} Z`, '#150f1e');
    }
    s.flat(`M ${cx - 40} ${base - 88} L ${cx} ${base - 150} L ${cx + 40} ${base - 88} Z`, '#150f1e');
    for (const [gx, gy] of [
      [cx - 120, base - 60],
      [cx + 108, base - 60],
      [cx, base - 50],
    ] as Array<[number, number]>) {
      s.glow(gx, gy, 22, '#ffce6a', 0.7);
    }
    const fade = s.vGradient([
      [0, 'rgba(12,8,18,0)'],
      [1, 'rgba(12,8,18,0.9)'],
    ]);
    s.raw(`<rect x="0" y="${h * 0.55}" width="${w}" height="${h * 0.45}" fill="${fade}"/>`);
  });
}

/** World-map parchment. */
export function mapBackdrop(w: number, h: number): Svg {
  return draw(w, h, (s) => {
    const paper = s.vGradient([
      [0, '#e4d3ab'],
      [0.5, '#d6c096'],
      [1, '#bda379'],
    ]);
    s.raw(`<rect x="0" y="0" width="${w}" height="${h}" fill="${paper}"/>`);
    let seed = 4242;
    const rnd = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 120; i += 1) {
      const x = rnd() * w;
      const y = rnd() * h;
      s.circle(x, y, rnd() * 26 + 4, withAlpha('#8a6f45', 0.05 + rnd() * 0.05), { depth: 0 });
    }
    // coastline flourish
    s.flat(
      `M ${w * 0.08} ${h * 0.2} Q ${w * 0.3} ${h * 0.1} ${w * 0.42} ${h * 0.3} Q ${w * 0.56} ${h * 0.5} ${w * 0.34} ${h * 0.62} Q ${w * 0.16} ${h * 0.74} ${w * 0.3} ${h * 0.92}`,
      'none',
      { width: 3, color: withAlpha('#6d5636', 0.4) },
    );
    const edge = s.radial(
      [
        [0.6, 'rgba(0,0,0,0)'],
        [1, withAlpha(mix('#6d5636', '#2b1f12', 0.5), 0.5)],
      ],
      0.5,
      0.5,
      0.75,
    );
    s.raw(`<rect x="0" y="0" width="${w}" height="${h}" fill="${edge}"/>`);
  });
}
