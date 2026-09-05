/**
 * Small colour toolkit used by the vector art system.
 *
 * Everything the art layer draws is derived from a single base colour so that
 * a unit can be recoloured (golden variants, corrupted variants, team tints)
 * by changing one hex value.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const to = (v: number) => Math.round(clamp01(v / 255) * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number): number => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return {
    r: Math.round(hue(h + 1 / 3) * 255),
    g: Math.round(hue(h) * 255),
    b: Math.round(hue(h - 1 / 3) * 255),
  };
}

function mapHsl(hex: string, fn: (hsl: Hsl) => Hsl): string {
  return rgbToHex(hslToRgb(fn(rgbToHsl(hexToRgb(hex)))));
}

/** Lighten toward white, and warm the hue slightly (light is warm). */
export function lighten(hex: string, amount: number): string {
  return mapHsl(hex, ({ h, s, l }) => ({
    h: (h + 0.01 * amount + 1) % 1,
    s: clamp01(s * (1 - 0.18 * amount)),
    l: clamp01(l + (1 - l) * amount),
  }));
}

/** Darken toward shadow, and cool the hue slightly (shadow is cool). */
export function darken(hex: string, amount: number): string {
  return mapHsl(hex, ({ h, s, l }) => ({
    h: (h - 0.012 * amount + 1) % 1,
    s: clamp01(s * (1 + 0.22 * amount)),
    l: clamp01(l * (1 - amount)),
  }));
}

export function saturate(hex: string, amount: number): string {
  return mapHsl(hex, ({ h, s, l }) => ({ h, s: clamp01(s + amount), l }));
}

export function shiftHue(hex: string, turns: number): string {
  return mapHsl(hex, ({ h, s, l }) => ({ h: (h + turns + 1) % 1, s, l }));
}

export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

export function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${clamp01(alpha)})`;
}

/** Phaser wants 0xRRGGBB numbers. */
export function toInt(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (r << 16) | (g << 8) | b;
}

/**
 * The five tones every painted shape in the game is built from.
 * Keeping this derivation in one place is what makes the art read as a set.
 */
export interface Tones {
  base: string;
  light: string;
  highlight: string;
  shadow: string;
  outline: string;
}

export function tones(base: string): Tones {
  return {
    base,
    light: lighten(base, 0.3),
    highlight: lighten(base, 0.62),
    shadow: darken(base, 0.34),
    outline: darken(base, 0.62),
  };
}
