/**
 * Projectiles, effects, pickups and UI furniture.
 */
import { darken, lighten, withAlpha } from '../core/color';
import { Svg, draw } from './Svg';

export type ProjectileId =
  | 'arrow'
  | 'bolt'
  | 'fireball'
  | 'frostbolt'
  | 'holybolt'
  | 'shadowbolt'
  | 'rock'
  | 'cannonball'
  | 'bomb'
  | 'spear_throw';

/** All projectiles point along +x so the engine can just set their rotation. */
export function projectile(id: ProjectileId): Svg {
  switch (id) {
    case 'arrow':
      return draw(60, 18, (s) => {
        s.rect(6, 7, 40, 4, 2, '#8a6a44', { width: 2 });
        s.path('M 42 3 L 58 9 L 42 15 L 46 9 Z', '#cfd6e2', { width: 2 });
        s.path('M 4 2 L 16 9 L 4 16 L 9 9 Z', '#e2e6ee', { width: 2 });
      });
    case 'bolt':
      return draw(52, 16, (s) => {
        s.rect(4, 6, 34, 5, 2.5, '#5d4a34', { width: 2 });
        s.path('M 34 2 L 50 8 L 34 14 Z', '#b9c2d0', { width: 2 });
      });
    case 'spear_throw':
      return draw(76, 16, (s) => {
        s.rect(2, 6, 56, 4, 2, '#8a6a44', { width: 2 });
        s.path('M 52 2 L 74 8 L 52 14 Z', '#cfd6e2', { width: 2 });
      });
    case 'fireball':
      return draw(64, 48, (s) => {
        s.glow(34, 24, 26, '#ff8a2f', 0.85);
        s.path('M 2 24 Q 20 12 26 22 Q 20 30 2 24 Z', withAlpha('#ff6a2f', 0.7), { depth: 0 });
        s.circle(38, 24, 15, '#ffb545', { width: 3, color: '#c0390f' });
        s.circle(40, 21, 7, '#ffe9a8', { depth: 0 });
      });
    case 'frostbolt':
      return draw(58, 44, (s) => {
        s.glow(32, 22, 22, '#7fe3ff', 0.8);
        s.path('M 32 6 L 42 22 L 32 38 L 22 22 Z', '#bff0ff', { width: 3, color: '#2f7fa8' });
        s.path('M 10 22 L 24 18 L 24 26 Z', withAlpha('#bff0ff', 0.65), { depth: 0 });
      });
    case 'holybolt':
      return draw(56, 44, (s) => {
        s.glow(30, 22, 22, '#ffe08a', 0.9);
        s.path('M 30 4 L 38 22 L 30 40 L 22 22 Z', '#fff3c4', { width: 3, color: '#c9922f' });
      });
    case 'shadowbolt':
      return draw(58, 46, (s) => {
        s.glow(30, 23, 24, '#a45cf0', 0.85);
        s.circle(32, 23, 14, '#6b3fb0', { width: 3, color: '#2c1740' });
        s.circle(35, 20, 6, '#d9b6ff', { depth: 0 });
      });
    case 'rock':
      return draw(44, 40, (s) => {
        s.path('M 8 26 L 4 14 L 16 4 L 32 6 L 40 18 L 34 32 L 18 36 Z', '#8a8494', { width: 3 });
        s.sheen('M 14 14 L 24 9 L 30 14 L 20 18 Z', 0.28);
      });
    case 'cannonball':
      return draw(40, 40, (s) => {
        s.circle(20, 20, 16, '#4a4d58', { width: 3 });
        s.sheen('M 10 12 Q 18 6 26 12 Q 18 14 12 20 Z', 0.3);
      });
    case 'bomb':
      return draw(48, 52, (s) => {
        s.circle(24, 32, 17, '#39323f', { width: 3.5 });
        s.rect(20, 10, 8, 10, 3, '#5c5262', { width: 3 });
        s.flat('M 24 12 Q 34 4 30 -2', 'none', { width: 3, color: '#c9a06a' });
        s.glow(30, 0, 12, '#ffab3d', 0.9);
        s.sheen('M 14 24 Q 22 18 30 23 Q 22 26 17 32 Z', 0.26);
      });
    default:
      return draw(10, 10, () => {});
  }
}

export type FxId = 'spark' | 'smoke' | 'ember' | 'slash' | 'shockwave' | 'holy_ring' | 'frost_ring' | 'blood';

export function effect(id: FxId): Svg {
  switch (id) {
    case 'spark':
      return draw(24, 24, (s) => {
        s.circle(12, 12, 6, '#fff3c4', { depth: 0 });
        s.glow(12, 12, 12, '#ffd257', 0.9);
      });
    case 'ember':
      return draw(18, 18, (s) => {
        s.circle(9, 9, 5, '#ff9b3d', { depth: 0 });
        s.glow(9, 9, 9, '#ff6a2f', 0.85);
      });
    case 'smoke':
      return draw(48, 48, (s) => {
        s.circle(24, 24, 20, withAlpha('#cfc9d8', 0.55), { depth: 0 });
        s.circle(16, 20, 12, withAlpha('#e8e3f0', 0.4), { depth: 0 });
      });
    case 'blood':
      return draw(20, 20, (s) => {
        s.circle(10, 10, 7, '#a02a3a', { depth: 0 });
      });
    case 'slash':
      return draw(120, 80, (s) => {
        s.path('M 8 66 Q 60 4 112 22 Q 62 26 20 72 Z', '#fdf6e2', { depth: 0, alpha: 0.92 });
        s.path('M 18 62 Q 62 16 100 26 Q 62 32 28 66 Z', '#ffd257', { depth: 0, alpha: 0.5 });
      });
    case 'shockwave':
      return draw(180, 180, (s) => {
        s.raw(
          `<circle cx="90" cy="90" r="72" fill="none" stroke="${withAlpha('#ffd257', 0.85)}" stroke-width="12"/>`,
        );
        s.raw(
          `<circle cx="90" cy="90" r="54" fill="none" stroke="${withAlpha('#fff3c4', 0.5)}" stroke-width="6"/>`,
        );
      });
    case 'holy_ring':
      return draw(200, 200, (s) => {
        s.glow(100, 100, 96, '#ffe08a', 0.55);
        s.raw(`<circle cx="100" cy="100" r="78" fill="none" stroke="${withAlpha('#fff3c4', 0.9)}" stroke-width="10"/>`);
      });
    case 'frost_ring':
      return draw(200, 200, (s) => {
        s.glow(100, 100, 96, '#8fe2f5', 0.5);
        s.raw(`<circle cx="100" cy="100" r="78" fill="none" stroke="${withAlpha('#d6f4ff', 0.9)}" stroke-width="10"/>`);
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2;
          const x = 100 + Math.cos(a) * 78;
          const y = 100 + Math.sin(a) * 78;
          s.path(`M ${x - 8} ${y} L ${x} ${y - 14} L ${x + 8} ${y} L ${x} ${y + 14} Z`, '#eaf9ff', { width: 2 });
        }
      });
    default:
      return draw(10, 10, () => {});
  }
}

export type PickupId = 'coin' | 'gem' | 'heart' | 'skull' | 'crown' | 'mana' | 'star' | 'star_empty';

export function pickup(id: PickupId): Svg {
  switch (id) {
    case 'coin':
      return draw(48, 48, (s) => {
        s.glow(24, 24, 22, '#ffd257', 0.5);
        s.ellipse(24, 24, 17, 19, '#f0b429', { width: 3.5, color: '#8a5a12' });
        s.ellipse(24, 24, 11, 13, '#ffd257', { width: 2.5, color: '#c9922f' });
        s.sheen('M 15 15 Q 22 9 29 14 Q 21 17 17 24 Z', 0.5);
      });
    case 'mana':
      return draw(44, 48, (s) => {
        s.glow(22, 24, 20, '#63b8ff', 0.6);
        s.path('M 22 4 L 38 24 L 22 44 L 6 24 Z', '#7fd0ff', { width: 3.5, color: '#215a8a' });
        s.sheen('M 16 20 L 22 12 L 26 20 L 21 24 Z', 0.55);
      });
    case 'gem':
      return draw(44, 44, (s) => {
        s.glow(22, 22, 20, '#b46bff', 0.55);
        s.path('M 22 3 L 40 17 L 32 40 L 12 40 L 4 17 Z', '#c48aff', { width: 3.5, color: '#4a2172' });
        s.sheen('M 14 16 L 22 8 L 28 16 L 22 22 Z', 0.5);
      });
    case 'heart':
      return draw(44, 42, (s) => {
        s.path('M 22 38 Q 2 24 4 14 Q 6 3 14 5 Q 20 7 22 13 Q 24 7 30 5 Q 38 3 40 14 Q 42 24 22 38 Z', '#e8455c', {
          width: 3.5,
          color: '#7a1526',
        });
        s.sheen('M 12 12 Q 16 8 20 12 Q 15 14 13 19 Z', 0.5);
      });
    case 'skull':
      return draw(44, 44, (s) => {
        s.path('M 8 20 Q 8 5 22 5 Q 36 5 36 20 Q 36 29 29 31 L 29 38 L 15 38 L 15 31 Q 8 29 8 20 Z', '#e8e2d2', {
          width: 3.5,
        });
        s.circle(17, 20, 4.6, '#2b2536', { depth: 0 });
        s.circle(27, 20, 4.6, '#2b2536', { depth: 0 });
      });
    case 'star':
    case 'star_empty': {
      const filled = id === 'star';
      const body = filled ? '#ffd257' : '#4a4060';
      return draw(48, 46, (s) => {
        if (filled) s.glow(24, 22, 22, '#ffd257', 0.5);
        const pts: string[] = [];
        for (let i = 0; i < 10; i += 1) {
          const r = i % 2 === 0 ? 21 : 9;
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          pts.push(`${24 + Math.cos(a) * r} ${23 + Math.sin(a) * r * 1.02}`);
        }
        s.path(`M ${pts.join(' L ')} Z`, body, { width: 3.5 });
        if (filled) s.sheen('M 17 15 L 24 8 L 28 16 L 23 20 Z', 0.45);
      });
    }
    case 'crown':
      return draw(60, 46, (s) => {
        s.glow(30, 26, 26, '#ffd257', 0.55);
        s.path('M 6 38 L 6 12 L 17 24 L 30 6 L 43 24 L 54 12 L 54 38 Z', '#f0b429', { width: 3.5, color: '#8a5a12' });
        s.rect(4, 36, 52, 8, 3, '#d99a1f', { width: 3 });
        s.circle(30, 18, 4.5, '#e8455c', { width: 2.5 });
        s.circle(13, 26, 3.5, '#63b8ff', { width: 2.5 });
        s.circle(47, 26, 3.5, '#63b8ff', { width: 2.5 });
      });
    default:
      return draw(10, 10, () => {});
  }
}

/* ---------------------------------------------------------------------- UI - */

export interface PanelOptions {
  fill?: string;
  border?: string;
  radius?: number;
  /** Adds the little rivets that make a panel look forged rather than flat. */
  rivets?: boolean;
}

export function panel(w: number, h: number, opts: PanelOptions = {}): Svg {
  const fill = opts.fill ?? '#2f2740';
  const border = opts.border ?? '#c8a45a';
  const r = opts.radius ?? 18;
  return draw(w, h, (s) => {
    s.rect(4, 4, w - 8, h - 8, r, fill, { width: 5, color: darken(border, 0.4) });
    s.raw(
      `<rect x="9" y="9" width="${w - 18}" height="${h - 18}" rx="${r - 4}" ry="${r - 4}" fill="none" stroke="${border}" stroke-width="3"/>`,
    );
    s.raw(
      `<rect x="9" y="9" width="${w - 18}" height="${(h - 18) * 0.45}" rx="${r - 4}" ry="${r - 4}" fill="${withAlpha('#ffffff', 0.06)}"/>`,
    );
    if (opts.rivets !== false) {
      for (const [x, y] of [
        [20, 20],
        [w - 20, 20],
        [20, h - 20],
        [w - 20, h - 20],
      ] as Array<[number, number]>) {
        s.circle(x, y, 4, lighten(border, 0.25), { width: 2, color: darken(border, 0.5) });
      }
    }
  });
}

export function button(w: number, h: number, color = '#4fae6a'): Svg {
  return draw(w, h, (s) => {
    const r = h * 0.32;
    s.rect(3, 6, w - 6, h - 8, r, darken(color, 0.5), { width: 0 });
    s.rect(3, 2, w - 6, h - 10, r, color, { width: 4, color: darken(color, 0.55) });
    s.raw(
      `<rect x="12" y="9" width="${w - 24}" height="${(h - 10) * 0.42}" rx="${r * 0.7}" ry="${r * 0.7}" fill="${withAlpha('#ffffff', 0.28)}"/>`,
    );
  });
}

/** The card the player taps to place a defender. */
export function cardFrame(w: number, h: number, tint = '#3b3450'): Svg {
  return draw(w, h, (s) => {
    s.rect(3, 3, w - 6, h - 6, 14, tint, { width: 4, color: '#171326' });
    s.raw(
      `<rect x="8" y="8" width="${w - 16}" height="${h - 16}" rx="10" ry="10" fill="none" stroke="${withAlpha('#c8a45a', 0.75)}" stroke-width="2.5"/>`,
    );
    s.raw(
      `<rect x="8" y="8" width="${w - 16}" height="${(h - 16) * 0.4}" rx="10" ry="10" fill="${withAlpha('#ffffff', 0.07)}"/>`,
    );
    // cost banner along the bottom
    s.rect(6, h - 30, w - 12, 24, 9, '#221c33', { width: 3, color: '#0f0c1a' });
  });
}

/** The 1x1 grid cell highlight shown while dragging a card. */
export function cellHighlight(w: number, h: number, color = '#8fe2a8'): Svg {
  return draw(w, h, (s) => {
    s.raw(
      `<rect x="4" y="4" width="${w - 8}" height="${h - 8}" rx="10" ry="10" fill="${withAlpha(color, 0.18)}" stroke="${withAlpha(color, 0.9)}" stroke-width="4" stroke-dasharray="14 10"/>`,
    );
  });
}

export function healthBar(w: number, h: number): { back: Svg; fill: (color: string) => Svg } {
  return {
    back: draw(w, h, (s) => {
      s.rect(0, 0, w, h, h / 2, '#1b1626', { width: 2.5, color: '#0d0a16' });
    }),
    fill: (color: string) =>
      draw(w - 6, h - 6, (s) => {
        s.rect(0, 0, w - 6, h - 6, (h - 6) / 2, color, { width: 0 });
        s.raw(
          `<rect x="2" y="1.5" width="${w - 10}" height="${(h - 6) * 0.4}" rx="${(h - 6) * 0.2}" fill="${withAlpha('#ffffff', 0.3)}"/>`,
        );
      }),
  };
}

/** Soft radial used for hero spell targeting and lane hover. */
export function targetRing(r: number, color: string): Svg {
  const d = r * 2 + 20;
  return draw(d, d, (s) => {
    s.glow(d / 2, d / 2, r, color, 0.35);
    s.raw(
      `<circle cx="${d / 2}" cy="${d / 2}" r="${r}" fill="none" stroke="${withAlpha(color, 0.9)}" stroke-width="5" stroke-dasharray="18 12"/>`,
    );
  });
}
