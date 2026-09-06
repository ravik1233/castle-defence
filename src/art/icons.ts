/**
 * App store artwork: the launcher icon, its Android adaptive layers, and the
 * splash screen. Drawn with the same vector system as the game, so the store
 * listing and the game itself look like the same product.
 */
import { darken, lighten, withAlpha } from '../core/color';
import { Svg, draw } from './Svg';

const GOLD = '#f0b429';
const STONE = '#b9c2d0';

/** The gate itself: a portcullis under an arch, lit from behind. */
function gate(s: Svg, cx: number, cy: number, w: number, h: number): void {
  const outline = { width: w * 0.05 };
  // glow of whatever is on the other side
  s.glow(cx, cy + h * 0.1, w * 0.72, '#ff6a2f', 0.75);

  // arch
  s.path(
    `M ${cx - w / 2} ${cy + h / 2} L ${cx - w / 2} ${cy - h * 0.1} ` +
      `Q ${cx} ${cy - h * 0.78} ${cx + w / 2} ${cy - h * 0.1} ` +
      `L ${cx + w / 2} ${cy + h / 2} Z`,
    '#3a2f4a',
    { width: 0 },
  );
  // portcullis bars
  for (let i = 0; i < 5; i += 1) {
    const x = cx - w * 0.36 + (i * w * 0.72) / 4;
    s.rect(x - w * 0.035, cy - h * 0.42, w * 0.07, h * 0.9, w * 0.03, STONE, outline);
  }
  for (let i = 0; i < 3; i += 1) {
    const y = cy - h * 0.28 + i * h * 0.3;
    s.rect(cx - w * 0.42, y, w * 0.84, h * 0.07, w * 0.03, darken(STONE, 0.12), outline);
  }
  // stone frame
  s.path(
    `M ${cx - w * 0.62} ${cy + h * 0.56} L ${cx - w * 0.62} ${cy - h * 0.12} ` +
      `Q ${cx} ${cy - h * 0.92} ${cx + w * 0.62} ${cy - h * 0.12} ` +
      `L ${cx + w * 0.62} ${cy + h * 0.56} ` +
      `L ${cx + w * 0.46} ${cy + h * 0.56} L ${cx + w * 0.46} ${cy - h * 0.08} ` +
      `Q ${cx} ${cy - h * 0.72} ${cx - w * 0.46} ${cy - h * 0.08} ` +
      `L ${cx - w * 0.46} ${cy + h * 0.56} Z`,
    '#8d8b96',
    { width: w * 0.045 },
  );
}

export function appIcon(size = 1024): Svg {
  return draw(size, size, (s) => {
    const bg = s.vGradient([
      [0, '#2a1b3d'],
      [0.55, '#3d1b35'],
      [1, '#7a2a24'],
    ]);
    s.raw(`<rect x="0" y="0" width="${size}" height="${size}" fill="${bg}"/>`);
    s.glow(size * 0.5, size * 0.78, size * 0.55, '#ff8a3d', 0.5);

    gate(s, size * 0.5, size * 0.56, size * 0.52, size * 0.5);

    // crown over the gate: the thing being defended
    const cw = size * 0.34;
    const cx = size * 0.5;
    const cy = size * 0.2;
    s.glow(cx, cy, cw * 0.9, GOLD, 0.55);
    s.path(
      `M ${cx - cw / 2} ${cy + cw * 0.26} L ${cx - cw / 2} ${cy - cw * 0.2} ` +
        `L ${cx - cw * 0.19} ${cy + cw * 0.03} L ${cx} ${cy - cw * 0.34} ` +
        `L ${cx + cw * 0.19} ${cy + cw * 0.03} L ${cx + cw / 2} ${cy - cw * 0.2} ` +
        `L ${cx + cw / 2} ${cy + cw * 0.26} Z`,
      GOLD,
      { width: size * 0.022 },
    );
    s.rect(cx - cw * 0.54, cy + cw * 0.22, cw * 1.08, cw * 0.16, cw * 0.06, darken(GOLD, 0.18), {
      width: size * 0.02,
    });
    s.circle(cx, cy - cw * 0.06, cw * 0.075, '#e8455c', { width: size * 0.014 });

    // inner border so the icon reads at 48px
    s.raw(
      `<rect x="${size * 0.03}" y="${size * 0.03}" width="${size * 0.94}" height="${size * 0.94}" rx="${size * 0.18}" ` +
        `fill="none" stroke="${withAlpha(lighten(GOLD, 0.2), 0.35)}" stroke-width="${size * 0.018}"/>`,
    );
  });
}

/**
 * Maskable icon for Android home screens and the web app manifest.
 * Launchers crop icons to arbitrary shapes, so the subject sits well inside
 * the safe zone (the middle 80%) and the background bleeds to the edge.
 */
export function appIconMaskable(size = 512): Svg {
  return draw(size, size, (s) => {
    const bg = s.vGradient([
      [0, '#2a1b3d'],
      [0.55, '#3d1b35'],
      [1, '#7a2a24'],
    ]);
    s.raw(`<rect x="0" y="0" width="${size}" height="${size}" fill="${bg}"/>`);
    s.glow(size * 0.5, size * 0.72, size * 0.42, '#ff8a3d', 0.5);

    gate(s, size * 0.5, size * 0.58, size * 0.34, size * 0.32);

    const cw = size * 0.22;
    const cx = size * 0.5;
    const cy = size * 0.32;
    s.glow(cx, cy, cw * 0.9, GOLD, 0.55);
    s.path(
      `M ${cx - cw / 2} ${cy + cw * 0.26} L ${cx - cw / 2} ${cy - cw * 0.2} ` +
        `L ${cx - cw * 0.19} ${cy + cw * 0.03} L ${cx} ${cy - cw * 0.34} ` +
        `L ${cx + cw * 0.19} ${cy + cw * 0.03} L ${cx + cw / 2} ${cy - cw * 0.2} ` +
        `L ${cx + cw / 2} ${cy + cw * 0.26} Z`,
      GOLD,
      { width: size * 0.016 },
    );
    s.rect(cx - cw * 0.54, cy + cw * 0.22, cw * 1.08, cw * 0.16, cw * 0.06, darken(GOLD, 0.18), {
      width: size * 0.014,
    });
    s.circle(cx, cy - cw * 0.06, cw * 0.07, '#e8455c', { width: size * 0.01 });
  });
}

/** Android adaptive icon: the subject only, on a transparent field. */
export function appIconForeground(size = 1024): Svg {
  return draw(size, size, (s) => {
    // Adaptive icons crop to the inner 66%, so the subject is drawn small.
    const cx = size * 0.5;
    s.glow(cx, size * 0.56, size * 0.3, '#ff8a3d', 0.55);
    gate(s, cx, size * 0.56, size * 0.34, size * 0.33);
    const cw = size * 0.22;
    const cy = size * 0.35;
    s.glow(cx, cy, cw * 0.9, GOLD, 0.5);
    s.path(
      `M ${cx - cw / 2} ${cy + cw * 0.26} L ${cx - cw / 2} ${cy - cw * 0.2} ` +
        `L ${cx - cw * 0.19} ${cy + cw * 0.03} L ${cx} ${cy - cw * 0.34} ` +
        `L ${cx + cw * 0.19} ${cy + cw * 0.03} L ${cx + cw / 2} ${cy - cw * 0.2} ` +
        `L ${cx + cw / 2} ${cy + cw * 0.26} Z`,
      GOLD,
      { width: size * 0.016 },
    );
    s.rect(cx - cw * 0.54, cy + cw * 0.22, cw * 1.08, cw * 0.16, cw * 0.06, darken(GOLD, 0.18), {
      width: size * 0.014,
    });
  });
}

export function appIconBackground(size = 1024): Svg {
  return draw(size, size, (s) => {
    const bg = s.vGradient([
      [0, '#2a1b3d'],
      [0.55, '#3d1b35'],
      [1, '#7a2a24'],
    ]);
    s.raw(`<rect x="0" y="0" width="${size}" height="${size}" fill="${bg}"/>`);
  });
}

/** Splash: centre-safe, since it is cropped differently on every device. */
export function splash(size = 2732): Svg {
  return draw(size, size, (s) => {
    const bg = s.vGradient([
      [0, '#160f22'],
      [0.5, '#2a1b3d'],
      [1, '#3d1b35'],
    ]);
    s.raw(`<rect x="0" y="0" width="${size}" height="${size}" fill="${bg}"/>`);
    s.glow(size * 0.5, size * 0.62, size * 0.32, '#ff8a3d', 0.4);
    gate(s, size * 0.5, size * 0.5, size * 0.24, size * 0.23);
    const cw = size * 0.16;
    const cx = size * 0.5;
    const cy = size * 0.33;
    s.glow(cx, cy, cw * 0.9, GOLD, 0.5);
    s.path(
      `M ${cx - cw / 2} ${cy + cw * 0.26} L ${cx - cw / 2} ${cy - cw * 0.2} ` +
        `L ${cx - cw * 0.19} ${cy + cw * 0.03} L ${cx} ${cy - cw * 0.34} ` +
        `L ${cx + cw * 0.19} ${cy + cw * 0.03} L ${cx + cw / 2} ${cy - cw * 0.2} ` +
        `L ${cx + cw / 2} ${cy + cw * 0.26} Z`,
      GOLD,
      { width: size * 0.006 },
    );
  });
}
