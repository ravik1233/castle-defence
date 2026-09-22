/**
 * Spell sigils.
 *
 * Every spell used to borrow one of four generic battle effects for its
 * icon, so Rockfall, War Horn, Rally, Quickstep and Close Ranks were all the
 * same picture of a shockwave. On a bar where two of them sit side by side
 * and both are on cooldown, identical art is the same as no art.
 *
 * Each sigil is a motif drawn in an elemental palette. That way the set
 * stays coherent - every icon is the same weight, the same border language,
 * the same size - while no commander ever carries two that look alike: a
 * motif may repeat across the campaign, but never inside one hand, and the
 * palette moves with it when it does.
 */
import { Svg, draw } from './Svg';

export type SpellMotif =
  | 'sunburst'
  | 'banner'
  | 'boulder'
  | 'horn'
  | 'arrows'
  | 'dash'
  | 'wave'
  | 'tide'
  | 'bolt'
  | 'snowflake'
  | 'hammer'
  | 'shieldwall'
  | 'dome'
  | 'rune'
  | 'flame'
  | 'chalice'
  | 'net'
  | 'moon';

export type SpellTone = 'holy' | 'storm' | 'frost' | 'stone' | 'tide' | 'flame' | 'shadow' | 'life';

interface Palette {
  core: string;
  edge: string;
  glow: string;
}

/** What each school is made of. One row per element, so a lane reads at a glance. */
const PALETTES: Record<SpellTone, Palette> = {
  holy: { core: '#ffd257', edge: '#8a5a12', glow: '#ffe9a8' },
  storm: { core: '#8ad0ff', edge: '#1d4f7a', glow: '#d6f0ff' },
  frost: { core: '#a8e4ff', edge: '#2a6d8f', glow: '#e2f7ff' },
  stone: { core: '#b3a389', edge: '#4a3c2a', glow: '#ded2bb' },
  tide: { core: '#5fd0b4', edge: '#1c5f52', glow: '#c2f2e6' },
  flame: { core: '#ff9a4d', edge: '#8a3510', glow: '#ffd2a8' },
  shadow: { core: '#c48aff', edge: '#42206b', glow: '#e6cfff' },
  life: { core: '#8fe07a', edge: '#2c6321', glow: '#d6f5cc' },
};

const SIZE = 48;

/** A sigil for one spell: the motif, struck in its school's colours. */
export function spellIcon(motif: SpellMotif, tone: SpellTone): Svg {
  const p = PALETTES[tone];
  return draw(SIZE, SIZE, (s) => {
    s.glow(24, 24, 21, p.glow, 0.5);
    MOTIFS[motif](s, p);
  });
}

type Draw = (s: Svg, p: Palette) => void;

/** Every stroke is the same weight so the set looks struck from one die. */
const W = 3;

const MOTIFS: Record<SpellMotif, Draw> = {
  // A pillar of light coming down, with rays off the point of impact.
  sunburst: (s, p) => {
    s.circle(24, 26, 9, p.core, { width: W, color: p.edge });
    for (const [x1, y1, x2, y2] of [
      [24, 4, 24, 13],
      [10, 12, 16, 18],
      [38, 12, 32, 18],
      [6, 28, 13, 28],
      [42, 28, 35, 28],
      [12, 40, 17, 34],
      [36, 40, 31, 34],
    ]) {
      s.flat(`M ${x1} ${y1} L ${x2} ${y2}`, 'none', { width: W, color: p.core });
    }
  },

  // A standard raised: what a commander does instead of casting.
  banner: (s, p) => {
    s.flat('M 15 6 L 15 43', 'none', { width: W, color: p.edge });
    s.path('M 15 8 L 39 13 L 30 21 L 39 29 L 15 24 Z', p.core, { width: W, color: p.edge });
    s.circle(15, 6, 3.4, p.glow, { width: 2, color: p.edge });
  },

  // A chunk of hillside already falling, faceted so it reads as stone
  // rather than as a flat tile, with the streaks it is coming down on.
  boulder: (s, p) => {
    s.path('M 14 24 L 21 14 L 33 16 L 40 27 L 34 40 L 19 39 Z', p.core, { width: W, color: p.edge });
    s.flat('M 21 14 L 25 26 L 40 27', 'none', { width: 2.2, color: p.edge });
    s.flat('M 25 26 L 19 39', 'none', { width: 2.2, color: p.edge });
    s.flat('M 12 4 L 9 15', 'none', { width: 2.2, color: p.core });
    s.flat('M 24 3 L 23 10', 'none', { width: 2.2, color: p.core });
    s.flat('M 38 5 L 41 13', 'none', { width: 2.2, color: p.core });
  },

  // A drinking horn: narrow at the tip, belled at the mouth, with the note
  // leaving it. Drawn as one tapering body so it is a horn at 48px and not
  // an indeterminate curl.
  horn: (s, p) => {
    s.path('M 7 38 Q 6 20 18 12 Q 27 6 31 10 Q 23 16 21 26 Q 19 36 13 41 Z', p.core, {
      width: W,
      color: p.edge,
    });
    s.flat('M 28 16 Q 36 14 38 8', 'none', { width: 2.2, color: p.core });
    s.flat('M 32 24 Q 43 21 44 11', 'none', { width: 2.2, color: p.core });
    s.flat('M 34 33 Q 48 29 47 14', 'none', { width: 2, color: p.glow });
  },

  // Three shafts coming down at an angle: a volley, not one arrow.
  arrows: (s, p) => {
    for (const dx of [-11, 0, 11]) {
      s.flat(`M ${24 + dx - 6} 8 L ${24 + dx + 5} 38`, 'none', { width: W, color: p.core });
      s.path(`M ${24 + dx + 5} 38 L ${24 + dx} 31 L ${24 + dx + 9} 30 Z`, p.core, { width: 2, color: p.edge });
    }
  },

  // Speed itself rather than a picture of a foot: three chevrons running
  // forward with the air torn behind them. A boot at this size was a letter L.
  dash: (s, p) => {
    for (const dx of [0, 11, 22]) {
      s.path(`M ${12 + dx} 12 L ${22 + dx} 24 L ${12 + dx} 36`, 'none', { width: W + 1, color: p.core });
    }
    s.flat('M 4 17 L 12 17', 'none', { width: 2.2, color: p.glow });
    s.flat('M 2 24 L 11 24', 'none', { width: 2.2, color: p.glow });
    s.flat('M 4 31 L 12 31', 'none', { width: 2.2, color: p.glow });
  },

  // Water pulling back off a shore.
  wave: (s, p) => {
    s.flat('M 5 30 Q 14 18 24 30 Q 34 42 43 30', 'none', { width: W + 1, color: p.core });
    s.flat('M 5 39 Q 14 29 24 39 Q 34 49 43 39', 'none', { width: 2.2, color: p.edge });
    s.flat('M 13 20 Q 20 8 30 15', 'none', { width: 2.2, color: p.glow });
  },

  // Water coming up instead: a rising line with a leaf riding it.
  tide: (s, p) => {
    s.flat('M 5 36 Q 16 24 24 34 Q 33 44 43 30', 'none', { width: W + 1, color: p.core });
    s.path('M 24 30 Q 24 14 34 8 Q 36 20 26 26 Z', p.glow, { width: 2.4, color: p.edge });
    s.flat('M 10 26 L 10 18', 'none', { width: 2.2, color: p.core });
    s.flat('M 38 24 L 38 16', 'none', { width: 2.2, color: p.core });
  },

  // A fork of lightning, jumping once.
  bolt: (s, p) => {
    s.path('M 27 4 L 15 25 L 23 25 L 18 44 L 34 21 L 25 21 Z', p.core, { width: W, color: p.edge });
    s.flat('M 36 10 L 42 18', 'none', { width: 2.2, color: p.core });
    s.flat('M 8 32 L 3 38', 'none', { width: 2.2, color: p.core });
  },

  snowflake: (s, p) => {
    for (const a of [0, 60, 120]) {
      const r = (a * Math.PI) / 180;
      const dx = Math.cos(r) * 18;
      const dy = Math.sin(r) * 18;
      s.flat(`M ${24 - dx} ${24 - dy} L ${24 + dx} ${24 + dy}`, 'none', { width: W, color: p.core });
    }
    s.circle(24, 24, 5, p.glow, { width: 2.4, color: p.edge });
    for (const [x, y] of [[24, 8], [24, 40], [10, 16], [38, 32], [10, 32], [38, 16]]) {
      s.circle(x, y, 2.2, p.core, { width: 1.6, color: p.edge });
    }
  },

  // A maul swung on the diagonal, mid-blow, with the shock coming off it.
  // Square-on with a vertical haft it read as a signpost.
  hammer: (s, p) => {
    s.flat('M 16 40 L 33 18', 'none', { width: W + 2, color: p.edge });
    s.path('M 24 8 L 40 8 L 44 19 L 28 19 Z', p.core, { width: W, color: p.edge });
    s.flat('M 8 44 L 14 38', 'none', { width: 2.4, color: p.core });
    s.flat('M 6 32 L 12 34', 'none', { width: 2.2, color: p.core });
    s.flat('M 17 46 L 19 40', 'none', { width: 2.2, color: p.core });
  },

  // Three shields locked together.
  shieldwall: (s, p) => {
    for (const dx of [-13, 0, 13]) {
      s.path(
        `M ${24 + dx - 8} 14 L ${24 + dx + 8} 14 L ${24 + dx + 8} 27 Q ${24 + dx} 38 ${24 + dx - 8} 27 Z`,
        p.core,
        { width: 2.6, color: p.edge },
      );
    }
  },

  // A ward over the keep: a dome with the ground under it.
  dome: (s, p) => {
    s.path('M 7 34 Q 7 10 24 10 Q 41 10 41 34', p.core, { width: W + 1, color: p.edge });
    s.flat('M 5 36 L 43 36', 'none', { width: W, color: p.edge });
    s.flat('M 15 33 Q 15 18 24 17', 'none', { width: 2, color: p.glow });
  },

  // A word cut into a standing stone. The old drawing was a pole with a
  // pennant on it, which is the banner motif wearing another name.
  rune: (s, p) => {
    s.path('M 11 10 Q 24 4 37 10 L 37 40 L 11 40 Z', p.core, { width: W, color: p.edge });
    s.flat('M 24 15 L 24 34', 'none', { width: 2.6, color: p.edge });
    s.flat('M 24 21 L 17 15', 'none', { width: 2.6, color: p.edge });
    s.flat('M 24 21 L 31 15', 'none', { width: 2.6, color: p.edge });
    s.flat('M 24 30 L 31 24', 'none', { width: 2.6, color: p.edge });
  },

  flame: (s, p) => {
    s.path('M 24 4 Q 36 18 34 28 Q 33 41 24 43 Q 15 41 14 28 Q 12 18 24 4 Z', p.core, {
      width: W,
      color: p.edge,
    });
    s.path('M 24 20 Q 29 27 28 32 Q 27 38 24 38 Q 21 38 20 32 Q 19 27 24 20 Z', p.glow, { width: 1.8, color: p.edge });
  },

  // A cup: what a commander pours out over their own line.
  chalice: (s, p) => {
    s.path('M 12 10 L 36 10 L 31 26 L 17 26 Z', p.core, { width: W, color: p.edge });
    s.flat('M 24 26 L 24 36', 'none', { width: W, color: p.edge });
    s.flat('M 14 40 L 34 40', 'none', { width: W, color: p.edge });
    s.flat('M 24 4 L 24 10', 'none', { width: 2.2, color: p.glow });
  },

  // A weighted net, thrown.
  net: (s, p) => {
    s.flat('M 8 14 L 40 14 L 34 38 L 14 38 Z', 'none', { width: 2.6, color: p.core });
    s.flat('M 16 14 L 19 38', 'none', { width: 1.8, color: p.core });
    s.flat('M 24 14 L 24 38', 'none', { width: 1.8, color: p.core });
    s.flat('M 32 14 L 29 38', 'none', { width: 1.8, color: p.core });
    s.flat('M 10 22 L 38 22', 'none', { width: 1.8, color: p.core });
    s.flat('M 12 30 L 36 30', 'none', { width: 1.8, color: p.core });
    for (const [x, y] of [[14, 38], [24, 38], [34, 38]]) s.circle(x, y, 2.4, p.core, { width: 1.4, color: p.edge });
  },

  moon: (s, p) => {
    s.path('M 30 6 Q 14 12 14 24 Q 14 36 30 42 Q 16 42 10 30 Q 6 18 16 10 Z', p.core, {
      width: W,
      color: p.edge,
    });
    s.circle(36, 16, 2.6, p.glow, { width: 1.6, color: p.edge });
    s.circle(40, 28, 2, p.glow, { width: 1.4, color: p.edge });
  },
};

/** The texture key a spell's sigil is registered under. */
export function spellIconKey(spellId: string): string {
  return `icon.spell.${spellId}`;
}
