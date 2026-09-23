/**
 * The ground features of the battlefield grid.
 *
 * These used to be drawn as objects set down on the field: a glossy oval
 * with a dark rim and a hard drop-shadow for water, a cone on a disc for a
 * shrine, clip-art triangles for rock. Against the painted backdrops they
 * read as stickers, and water in particular said the opposite of its rule -
 * nothing but an aquatic unit can stand in water, and a puddle is the one
 * kind of water anybody can walk through.
 *
 * So every tile here is ground rather than a thing on the ground:
 *
 * - No outlines and no hard shadows. Each one sits inside a mask that is
 *   blurred at the edges, so it fades into whatever the region painted
 *   underneath instead of stopping at a line.
 * - Surfaces are textured with fractal noise rather than flat fills.
 * - Wet ground darkens the field it sits on (it is drawn in translucent
 *   darks, not in a colour of its own), so the same tile belongs on the
 *   moors, the coast and the highlands alike.
 *
 * Water and marsh are not single tiles at all. A lane is a strip of ground,
 * and a run of water across it is one body of water, so they come in four
 * pieces - a pool on its own, and the left end, middle and right end of a
 * run - and the battle lays them edge to edge. The middle piece repeats
 * seamlessly: its texture is stitched at the tile's edges and every wave in
 * it has a period that divides the tile's width, so a flooded lane reads as
 * one channel rather than five puddles.
 */
import { Svg, draw } from './Svg';

export type GroundArtId = 'water' | 'marsh' | 'highground' | 'rubble' | 'tallgrass' | 'shrine' | 'seam';

/** Pieces of a ground that runs across a lane rather than sitting in a cell. */
export type StripPiece = 'solo' | 'left' | 'mid' | 'right';

/** Ground that joins its neighbours along a lane. */
export const STRIP_GROUNDS = ['water', 'marsh'] as const;
export type StripGround = (typeof STRIP_GROUNDS)[number];

/** One grid cell, in art units. Every tile is authored at exactly this size. */
export const TILE_W = 200;
export const TILE_H = 150;
const W = TILE_W;
const H = TILE_H;

/**
 * How far in from the tile's edge a run of water or marsh begins and ends.
 *
 * Everything here fades out at its edges, and a fade that reaches the edge
 * of its own texture is cut off there in a straight line - which is exactly
 * the boxed, set-down look this file exists to get rid of. The rounded end
 * of a bank, plus the damp earth around it, plus its blur, has to reach
 * nothing before x=0.
 */
const END_INSET = 56;

/** The texture key for one piece of a strip ground. The solo piece keeps the old key. */
export function stripKey(ground: StripGround, piece: StripPiece): string {
  return piece === 'solo' ? `tile.${ground}` : `tile.${ground}.${piece}`;
}

/* ---------------------------------------------------------------- tools - */

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
}

/**
 * A mask whose white shapes are blurred at the edges. Whatever is drawn
 * through it fades out over `blur` art units instead of ending at a line.
 */
function softMask(s: Svg, shapes: string, blur: number): string {
  const f = s.nextId('mf');
  s.def(
    `<filter id="${f}" filterUnits="userSpaceOnUse" x="-120" y="-120" width="${W + 240}" height="${H + 240}">` +
      `<feGaussianBlur stdDeviation="${blur}"/></filter>`,
  );
  const m = s.nextId('mk');
  s.def(
    `<mask id="${m}" maskUnits="userSpaceOnUse" x="-120" y="-120" width="${W + 240}" height="${H + 240}">` +
      `<g filter="url(#${f})" fill="#fff">${shapes}</g></mask>`,
  );
  return m;
}

/**
 * Fractal noise tinted one colour, with the noise driving only the alpha.
 * Stitched at the tile's edges, so a strip piece repeats without a seam.
 */
function noise(
  s: Svg,
  color: string,
  o: { freq: string; octaves?: number; seed?: number; gain: number; bias: number },
): string {
  const [r, g, b] = rgb(color);
  const id = s.nextId('nz');
  s.def(
    `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">` +
      `<feTurbulence type="fractalNoise" baseFrequency="${o.freq}" numOctaves="${o.octaves ?? 3}" ` +
      `seed="${o.seed ?? 3}" stitchTiles="stitch"/>` +
      `<feColorMatrix type="matrix" values="0 0 0 0 ${r.toFixed(3)}  0 0 0 0 ${g.toFixed(3)}  ` +
      `0 0 0 0 ${b.toFixed(3)}  ${o.gain} 0 0 0 ${o.bias}"/></filter>`,
  );
  return `<rect x="0" y="0" width="${W}" height="${H}" filter="url(#${id})"/>`;
}

/** A blurred dark pool under something that stands on the ground. */
function contact(s: Svg, cx: number, cy: number, rx: number, ry: number, strength: number): void {
  s.groundShadow(cx, cy, rx, ry, strength);
}

/**
 * The outline of a lane-crossing body of ground, as a closed path.
 *
 * The banks wave with a period of 100 art units, which divides the tile's
 * width, so the bank at the right edge of one piece is the bank at the left
 * edge of the next. The ends of a run are rounded; the middle runs off both
 * edges, well past them, so the edge blur never thins it where pieces meet.
 */
/**
 * A pool on its own: an irregular, lobed outline rather than a rounded box.
 *
 * Built in polar form around the cell's centre, with two harmonics of wobble,
 * so it reads as a hollow in the ground that filled up - not a tile with its
 * corners sanded off, which is what a strip clipped at both ends looked like.
 */
function poolPath(rx: number, ry: number, cy: number, lobes: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 48; i += 1) {
    const t = (i / 48) * Math.PI * 2;
    const k = 1 + lobes * (0.6 * Math.sin(3 * t + 0.4) + 0.4 * Math.sin(5 * t + 1.3));
    pts.push(`${(W / 2 + Math.cos(t) * rx * k).toFixed(1)} ${(cy + Math.sin(t) * ry * k).toFixed(1)}`);
  }
  return `M ${pts.join(' L ')} Z`;
}

function bankPath(piece: StripPiece, top: number, bottom: number, wobble: number): string {
  const bank = (x: number, base: number, phase: number): number =>
    base + wobble * Math.sin(((x / 100) * 2 + phase) * Math.PI);
  const x0 = piece === 'left' || piece === 'solo' ? END_INSET : -80;
  const x1 = piece === 'right' || piece === 'solo' ? W - END_INSET : W + 80;
  const pts: string[] = [];
  for (let x = x0; x <= x1; x += 10) pts.push(`${x} ${bank(x, top, 0).toFixed(1)}`);
  let d = `M ${pts[0]} L ${pts.slice(1).join(' L ')}`;
  // Round the far end back down to the lower bank, or run straight off it.
  d +=
    x1 < W
      ? ` C ${x1 + 22} ${top + 4} ${x1 + 22} ${bottom - 4} ${x1} ${bank(x1, bottom, 0.6).toFixed(1)}`
      : ` L ${x1} ${bank(x1, bottom, 0.6).toFixed(1)}`;
  const low: string[] = [];
  for (let x = x1; x >= x0; x -= 10) low.push(`${x} ${bank(x, bottom, 0.6).toFixed(1)}`);
  d += ` L ${low.join(' L ')}`;
  d +=
    x0 > 0
      ? ` C ${x0 - 22} ${bottom - 4} ${x0 - 22} ${top + 4} ${x0} ${bank(x0, top, 0).toFixed(1)} Z`
      : ' Z';
  return d;
}

/** A wave line whose period divides the tile, so it continues into the next piece. */
function periodicWave(y: number, amp: number, period: number, phase: number): string {
  const pts: string[] = [];
  for (let x = -40; x <= W + 40; x += 5) {
    pts.push(`${x} ${(y + amp * Math.sin(((x + phase) / period) * 2 * Math.PI)).toFixed(1)}`);
  }
  return `M ${pts.join(' L ')}`;
}

/* ---------------------------------------------------------------- water - */

/**
 * Open water: deep enough that nothing without a boat or a fin is going to
 * stand in it. Dark in the body, lighter where it catches the sky, with the
 * earth around it darkened where it has soaked in.
 */
function water(piece: StripPiece): Svg {
  return draw(W, H, (s) => {
    const shape = piece === 'solo' ? poolPath(56, 30, 78, 0.16) : bankPath(piece, 38, 114, 5);
    // The damp earth around the bank: a translucent dark, so it wets whatever
    // ground the region painted rather than bringing a colour of its own.
    const damp = softMask(s, `<path d="${shape}" stroke="#fff" stroke-width="20"/>`, 8);
    s.raw(`<g mask="url(#${damp})"><rect x="-80" y="0" width="${W + 160}" height="${H}" fill="#1a130b" opacity="0.42"/></g>`);

    const body = softMask(s, `<path d="${shape}"/>`, 3.5);
    const deep = s.vGradient([
      [0, '#2c6a78'],
      [0.35, '#1c5061'],
      [1, '#0f3343'],
    ]);
    const sky = s.vGradient([
      [0, '#cdeef2', 0],
      [0.3, '#cdeef2', 0.28],
      [0.52, '#cdeef2', 0],
    ]);
    s.raw(
      `<g mask="url(#${body})">` +
        `<rect x="-80" y="0" width="${W + 160}" height="${H}" fill="${deep}"/>` +
        noise(s, '#08222e', { freq: '0.01 0.05', seed: 7, gain: 1.1, bias: -0.25 }) +
        noise(s, '#d9f6f7', { freq: '0.02 0.12', seed: 11, gain: 1.3, bias: -0.62 }) +
        `<rect x="-80" y="0" width="${W + 160}" height="${H}" fill="${sky}"/>` +
        [
          [58, 2.2, 50, 0, 0.3],
          [80, 2.6, 100, 30, 0.22],
          [101, 2, 50, 18, 0.18],
        ]
          .map(
            ([y, a, p, ph, op]) =>
              `<path d="${periodicWave(y!, a!, p!, ph!)}" fill="none" stroke="#e6fbff" stroke-width="1.6" opacity="${op}"/>`,
          )
          .join('') +
        `</g>`,
    );
  });
}

/* ---------------------------------------------------------------- marsh - */

/**
 * Wet ground rather than water: sucking olive mud, standing pools too small
 * to swim, and reeds. It must never be mistaken for the open water beside
 * it, because one slows what crosses it and the other forbids building.
 */
function marsh(piece: StripPiece): Svg {
  return draw(W, H, (s) => {
    const shape = piece === 'solo' ? poolPath(60, 32, 78, 0.2) : bankPath(piece, 38, 112, 6);
    const damp = softMask(s, `<path d="${shape}" stroke="#fff" stroke-width="20"/>`, 8);
    s.raw(`<g mask="url(#${damp})"><rect x="-80" y="0" width="${W + 160}" height="${H}" fill="#140f08" opacity="0.45"/></g>`);

    // Wet earth, not a colour: the earlier olive fill read as a stain laid on
    // the field. Dark, brown, low-saturation mud with a wet sheen and a lot of
    // small standing water is what says "this will slow you down".
    const body = softMask(s, `<path d="${shape}"/>`, 7);
    const mud = s.vGradient([
      [0, '#3e3827'],
      [1, '#29251a'],
    ]);
    const pools = [
      [44, 70, 16, 6],
      [80, 94, 22, 7],
      [118, 64, 18, 6],
      [150, 96, 20, 7],
      [98, 78, 10, 4],
      [166, 70, 11, 4],
    ]
      .map(
        ([x, y, rx, ry]) =>
          `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#1d2a28" opacity="0.9"/>` +
          `<ellipse cx="${x! - rx! * 0.3}" cy="${y! - ry! * 0.35}" rx="${rx! * 0.45}" ry="${ry! * 0.25}" fill="#b9d2c8" opacity="0.32"/>`,
      )
      .join('');
    s.raw(
      `<g mask="url(#${body})">` +
        `<rect x="-80" y="0" width="${W + 160}" height="${H}" fill="${mud}"/>` +
        noise(s, '#5a5236', { freq: '0.04', seed: 5, gain: 1.1, bias: -0.35 }) +
        noise(s, '#0e0c07', { freq: '0.09', seed: 9, gain: 1.3, bias: -0.55 }) +
        noise(s, '#c8d6cc', { freq: '0.05 0.14', seed: 21, gain: 1.4, bias: -0.78 }) +
        pools +
        `</g>`,
    );
    for (const [x, y] of [
      [34, 96],
      [86, 52],
      [140, 112],
      [172, 80],
    ] as Array<[number, number]>) {
      reeds(s, x, y);
    }
  });
}

function reeds(s: Svg, x: number, y: number): void {
  contact(s, x, y + 2, 13, 4, 0.3);
  const blades = [
    [-7, -30, '#6c7a3b'],
    [-3, -40, '#83934a'],
    [1, -36, '#5c6a31'],
    [5, -44, '#8d9c52'],
    [9, -28, '#6c7a3b'],
  ] as Array<[number, number, string]>;
  for (const [dx, h, c] of blades) {
    s.raw(
      `<path d="M ${x + dx} ${y} Q ${x + dx + (dx > 0 ? 4 : -4)} ${y + h / 2} ${x + dx + (dx > 0 ? 6 : -5)} ${y + h}" ` +
        `fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round"/>`,
    );
  }
  // Two bulrush heads, the thing that says "reed" rather than "grass".
  for (const [dx, h] of [
    [-3, -40],
    [5, -44],
  ] as Array<[number, number]>) {
    s.raw(`<rect x="${x + dx + (dx > 0 ? 4.5 : -5.5)}" y="${y + h - 2}" width="3.2" height="9" rx="1.6" fill="#5b3b20"/>`);
  }
}

/* --------------------------------------------------------------- rubble - */

/**
 * Fallen masonry: blocks with a cut face among broken lumps, grit spread
 * round them, each one sitting in its own soft shadow. Nothing gets built on
 * top of this, and it should look like it.
 */
function rubble(): Svg {
  return draw(W, H, (s) => {
    const patch = softMask(s, `<ellipse cx="${W / 2}" cy="84" rx="60" ry="34"/>`, 13);
    s.raw(
      `<g mask="url(#${patch})">` +
        `<rect x="0" y="0" width="${W}" height="${H}" fill="#2a2119" opacity="0.32"/>` +
        noise(s, '#b8ab96', { freq: '0.22', seed: 4, gain: 1.8, bias: -1.05 }) +
        noise(s, '#1a140f', { freq: '0.3', seed: 8, gain: 1.8, bias: -1.0 }) +
        `</g>`,
    );
    const stones: Array<[number, number, number, number, number]> = [
      // x, y, width, height, lean
      [44, 96, 34, 20, -6],
      [78, 74, 40, 26, 5],
      [122, 98, 38, 22, -3],
      [150, 70, 30, 20, 8],
      [100, 52, 26, 17, -8],
      [60, 58, 20, 14, 4],
      [168, 104, 18, 12, 0],
    ];
    for (const [x, y, w, h, lean] of stones) block(s, x, y, w, h, lean);
    for (const [x, y, r] of [
      [30, 110, 3.5],
      [138, 116, 3],
      [110, 122, 2.6],
      [176, 88, 2.8],
      [70, 116, 2.4],
    ] as Array<[number, number, number]>) {
      contact(s, x, y + 1, r * 1.6, r * 0.6, 0.35);
      s.raw(`<circle cx="${x}" cy="${y}" r="${r}" fill="#7d7264"/>`);
    }
  });
}

/** One fallen block: a lit top face, a shaded front, and no outline. */
function block(s: Svg, x: number, y: number, w: number, h: number, lean: number): void {
  contact(s, x, y + h * 0.42, w * 0.62, h * 0.32, 0.45);
  const front = s.vGradient([
    [0, '#7d7366'],
    [1, '#4f473e'],
  ]);
  const top = s.vGradient([
    [0, '#b6ab98'],
    [1, '#958a78'],
  ]);
  const hw = w / 2;
  s.raw(
    `<g transform="rotate(${lean} ${x} ${y})">` +
      `<path d="M ${x - hw} ${y - h * 0.15} L ${x + hw} ${y - h * 0.2} L ${x + hw - 2} ${y + h * 0.42} ` +
      `L ${x - hw + 3} ${y + h * 0.46} Z" fill="${front}"/>` +
      `<path d="M ${x - hw} ${y - h * 0.15} L ${x - hw + 5} ${y - h * 0.5} L ${x + hw - 4} ${y - h * 0.56} ` +
      `L ${x + hw} ${y - h * 0.2} Z" fill="${top}"/>` +
      `<path d="M ${x - hw * 0.2} ${y - h * 0.18} L ${x + hw * 0.1} ${y + h * 0.3}" stroke="#3e372f" stroke-width="1" opacity="0.5"/>` +
      `</g>`,
  );
}

/* ----------------------------------------------------------- highground - */

/**
 * A shelf of bedrock pushed up through the field: a broad, level, lichened
 * top you could see a long way from, and a broken face below it. Not a pair
 * of mountain peaks - this is a place, not a landmark on the horizon.
 */
function highground(): Svg {
  return draw(W, H, (s) => {
    // Scree and shadow spilling off it into the field, so it rises out of the
    // ground rather than sitting on top of it.
    const skirt = softMask(s, `<ellipse cx="${W / 2}" cy="102" rx="68" ry="24"/>`, 11);
    s.raw(
      `<g mask="url(#${skirt})">` +
        `<rect x="0" y="0" width="${W}" height="${H}" fill="#1b140e" opacity="0.42"/>` +
        noise(s, '#8c8374', { freq: '0.25', seed: 3, gain: 1.9, bias: -1.1 }) +
        `</g>`,
    );
    contact(s, W / 2, 104, 70, 13, 0.5);
    const faceGrad = s.vGradient([
      [0, '#6c6356'],
      [1, '#3a342c'],
    ]);
    const topGrad = s.vGradient([
      [0, '#a79c86'],
      [1, '#857a67'],
    ]);
    // Broken, angular edges: bedrock that split, not a boulder that rolled.
    const topPath =
      'M 28 70 L 38 56 L 56 52 L 64 44 L 90 42 L 102 36 L 128 40 L 140 46 L 160 48 L 174 60 L 170 70 ' +
      'L 146 74 L 120 72 L 96 76 L 64 74 Z';
    const facePath =
      'M 28 70 L 64 74 L 96 76 L 120 72 L 146 74 L 170 70 L 176 84 L 166 98 L 148 104 L 132 100 ' +
      'L 112 108 L 88 104 L 66 108 L 46 100 L 30 94 L 24 82 Z';
    s.raw(`<path d="${facePath}" fill="${faceGrad}"/>`);
    s.raw(`<path d="${topPath}" fill="${topGrad}"/>`);
    const top = softMask(s, `<path d="${topPath}"/>`, 0.8);
    s.raw(
      `<g mask="url(#${top})">` +
        noise(s, '#7f8e52', { freq: '0.05', seed: 12, gain: 2.2, bias: -1.15 }) +
        noise(s, '#2f2a24', { freq: '0.14', seed: 2, gain: 1.8, bias: -1.0 }) +
        noise(s, '#d7ccb5', { freq: '0.2', seed: 16, gain: 1.8, bias: -1.1 }) +
        `</g>`,
    );
    const face = softMask(s, `<path d="${facePath}"/>`, 0.8);
    s.raw(
      `<g mask="url(#${face})">` +
        noise(s, '#1d1915', { freq: '0.03 0.18', seed: 4, gain: 1.6, bias: -0.7 }) +
        `</g>`,
    );
    // Where it split: down the face, and one crack across the top.
    for (const d of [
      'M 64 76 L 60 90 L 66 104',
      'M 120 74 L 126 88 L 120 100',
      'M 150 76 L 154 92',
      'M 72 56 L 98 60 L 110 68',
    ]) {
      s.raw(`<path d="${d}" fill="none" stroke="#231f1a" stroke-width="1.6" opacity="0.6" stroke-linecap="round"/>`);
    }
    for (const [x, y, r] of [
      [36, 106, 3.4],
      [168, 106, 3],
      [98, 116, 2.6],
      [140, 114, 2.8],
      [58, 114, 2.2],
    ] as Array<[number, number, number]>) {
      contact(s, x, y + 1, r * 1.7, r * 0.6, 0.35);
      s.raw(`<circle cx="${x}" cy="${y}" r="${r}" fill="#6b6357"/>`);
    }
  });
}

/* ------------------------------------------------------------ tallgrass - */

/**
 * A stand of tall grass, taller and paler than the field around it, so it
 * reads as cover rather than as more field. Blades are drawn back to front
 * so the near ones overlap the far ones, and the whole stand fades out at
 * its edges into shorter growth.
 */
function tallgrass(): Svg {
  return draw(W, H, (s) => {
    const patch = softMask(s, `<ellipse cx="${W / 2}" cy="98" rx="66" ry="26"/>`, 12);
    s.raw(`<g mask="url(#${patch})"><rect x="0" y="0" width="${W}" height="${H}" fill="#1f2b10" opacity="0.38"/></g>`);
    const palette = ['#c6c77c', '#a9b35a', '#8f9f48', '#d3cb86', '#7f913f', '#b8b66a'];
    // Deterministic scatter, so every player sees the same stand.
    let seed = 17;
    const rand = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const blades: Array<{ x: number; base: number; h: number; bend: number; c: string; w: number }> = [];
    for (let i = 0; i < 96; i += 1) {
      const t = rand();
      const x = 20 + rand() * 160;
      // Thinner and shorter toward the edges of the stand.
      const centre = 1 - Math.min(1, Math.abs(x - W / 2) / 90);
      const base = 84 + rand() * 36;
      blades.push({
        x,
        base,
        h: (30 + rand() * 44) * (0.55 + 0.45 * centre),
        bend: (t - 0.5) * 26,
        c: palette[Math.floor(rand() * palette.length)]!,
        w: 1.6 + rand() * 1.8,
      });
    }
    blades.sort((a, b) => a.base - b.base);
    for (const b of blades) {
      s.raw(
        `<path d="M ${b.x.toFixed(1)} ${b.base.toFixed(1)} Q ${(b.x + b.bend * 0.4).toFixed(1)} ${(b.base - b.h * 0.55).toFixed(1)} ` +
          `${(b.x + b.bend).toFixed(1)} ${(b.base - b.h).toFixed(1)}" fill="none" stroke="${b.c}" ` +
          `stroke-width="${b.w.toFixed(2)}" stroke-linecap="round"/>`,
      );
    }
    // Seed heads on the tallest few.
    for (const b of blades.filter((x) => x.h > 58).slice(0, 12)) {
      s.raw(
        `<ellipse cx="${(b.x + b.bend).toFixed(1)}" cy="${(b.base - b.h - 3).toFixed(1)}" rx="2" ry="5" ` +
          `fill="#d9c98c" transform="rotate(${(b.bend * 0.8).toFixed(1)} ${(b.x + b.bend).toFixed(1)} ${(b.base - b.h).toFixed(1)})"/>`,
      );
    }
  });
}

/* --------------------------------------------------------------- shrine - */

/**
 * An old wayside stone: weathered, leaning, mossy, with a mark cut into it
 * that still holds a little light, on a scrap of paving worn down by
 * everyone who ever stopped at it. Holy ground is somewhere, not something.
 */
function shrine(): Svg {
  return draw(W, H, (s) => {
    const worn = softMask(s, `<ellipse cx="${W / 2}" cy="104" rx="62" ry="22"/>`, 11);
    s.raw(
      `<g mask="url(#${worn})">` +
        `<rect x="0" y="0" width="${W}" height="${H}" fill="#cbbd9d" opacity="0.22"/>` +
        noise(s, '#3a3026', { freq: '0.18', seed: 6, gain: 1.6, bias: -0.95 }) +
        `</g>`,
    );
    // Broken paving slabs, low and flush with the earth.
    for (const [x, y, w, h, r] of [
      [70, 108, 30, 12, -6],
      [104, 114, 34, 12, 4],
      [134, 104, 24, 10, 9],
    ] as Array<[number, number, number, number, number]>) {
      s.raw(
        `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="3" fill="#958b78" opacity="0.7" ` +
          `transform="rotate(${r} ${x} ${y})"/>`,
      );
    }
    s.glow(W / 2, 70, 58, '#ffc46a', 0.18);
    contact(s, W / 2 + 4, 108, 26, 7, 0.55);
    const stone = s.vGradient([
      [0, '#a39b8b'],
      [0.6, '#7c7568'],
      [1, '#57514a'],
    ]);
    const outline = 'M 86 108 L 84 62 Q 86 30 102 26 Q 118 30 118 58 L 116 108 Z';
    s.raw(`<g transform="rotate(4 100 108)"><path d="${outline}" fill="${stone}"/>`);
    const moss = softMask(s, `<path d="${outline}"/>`, 1);
    s.raw(
      `<g mask="url(#${moss})">` +
        noise(s, '#6f8a45', { freq: '0.09', seed: 14, gain: 2.1, bias: -1.2 }) +
        noise(s, '#3b362f', { freq: '0.2', seed: 1, gain: 1.6, bias: -0.95 }) +
        `</g>`,
    );
    // The mark cut into it, still warm.
    s.raw(
      `<g opacity="0.95">` +
        `<path d="M 101 46 L 101 82 M 101 54 L 93 48 M 101 54 L 109 48 M 101 70 L 108 64" ` +
        `fill="none" stroke="#ffd78a" stroke-width="2.4" stroke-linecap="round"/></g></g>`,
    );
    s.glow(101, 62, 16, '#ffcf73', 0.45);
    // Offerings: two stubs of candle and a small cairn at its foot.
    for (const x of [78, 124]) {
      s.raw(`<rect x="${x - 2}" y="98" width="4" height="9" rx="1.5" fill="#e8dcbc"/>`);
      s.glow(x, 95, 9, '#ffb957', 0.7);
    }
    for (const [x, y, r] of [
      [136, 112, 5],
      [141, 107, 4],
      [138, 102, 3],
    ] as Array<[number, number, number]>) {
      s.raw(`<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.7}" fill="#8a8173"/>`);
    }
  });
}

/* ----------------------------------------------------------------- seam - */

/**
 * The vector stand-in for an Ember vein. Shipping builds override this with
 * the painted deposit; this only has to stop looking like a sticker while
 * the painted one is missing.
 */
function seam(): Svg {
  return draw(W, H, (s) => {
    const scorch = softMask(s, `<ellipse cx="${W / 2}" cy="96" rx="62" ry="26"/>`, 11);
    s.raw(`<g mask="url(#${scorch})"><rect x="0" y="0" width="${W}" height="${H}" fill="#1b1010" opacity="0.5"/></g>`);
    s.glow(W / 2, 80, 60, '#ff7a28', 0.35);
    contact(s, W / 2, 104, 50, 10, 0.5);
    const crystal = s.vGradient([
      [0, '#ffc07a'],
      [0.5, '#f0622a'],
      [1, '#8f2616'],
    ]);
    for (const [x, y, k] of [
      [72, 100, 0.8],
      [100, 100, 1.2],
      [128, 100, 0.9],
    ] as Array<[number, number, number]>) {
      s.raw(`<path d="M ${x} ${y - 52 * k} L ${x + 14 * k} ${y - 8 * k} L ${x} ${y} L ${x - 14 * k} ${y - 8 * k} Z" fill="${crystal}"/>`);
    }
  });
}

/* ---------------------------------------------------------------- entry - */

export function groundTile(id: GroundArtId): Svg {
  switch (id) {
    case 'water':
      return water('solo');
    case 'marsh':
      return marsh('solo');
    case 'highground':
      return highground();
    case 'rubble':
      return rubble();
    case 'tallgrass':
      return tallgrass();
    case 'shrine':
      return shrine();
    case 'seam':
      return seam();
  }
}

/** One piece of water or marsh running along a lane. */
export function stripTile(ground: StripGround, piece: StripPiece): Svg {
  return ground === 'water' ? water(piece) : marsh(piece);
}
