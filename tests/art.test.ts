import { describe, expect, it } from 'vitest';
import { ALL_CHARACTER_ART, ENEMY_ART } from '../src/art/cast';
import { buildCharacter, skeletonFor } from '../src/art/humanoid';
import { characterLayout, composeCharacter } from '../src/art/compose';
import { DEFENDERS } from '../src/data/defenders';
import { ENEMIES } from '../src/data/enemies';
import { HEROES } from '../src/data/heroes';
import { WALL_SKINS } from '../src/art/structures';
import { darken, hexToRgb, lighten, mix, rgbToHex, tones } from '../src/core/color';
import { cellCenter, colFromX, GRID, isInsideField, laneGroundY, rowFromY } from '../src/core/layout';

describe('data and art agree', () => {
  it('every defender points at art that exists', () => {
    for (const d of DEFENDERS) {
      // Crown Pack races live in their own block of the cast, so this asks
      // the whole cast rather than the campaign's own roster.
      if (d.art.kind === 'unit') {
        expect(ALL_CHARACTER_ART[d.art.id], `${d.id} points at missing art ${d.art.id}`).toBeDefined();
      }
      else expect(d.art.key.startsWith('build.')).toBe(true);
    }
  });

  it('every enemy points at art that exists', () => {
    for (const e of ENEMIES) expect(ENEMY_ART[e.art]).toBeDefined();
  });

  it('every hero points at art that exists', () => {
    // Commanders may borrow a unit's art - Bran wears the monk, Maerwyn the
    // cleric - so a hero counts as drawn if any part of the cast covers it.
    for (const h of HEROES) {
      expect(ALL_CHARACTER_ART[h.art], `${h.id} points at missing art ${h.art}`).toBeDefined();
    }
  });

  it('has no duplicate ids across the cast', () => {
    const ids = Object.values(ALL_CHARACTER_ART).map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('character generation', () => {
  it('builds every character in the cast', () => {
    for (const spec of Object.values(ALL_CHARACTER_ART)) {
      const art = buildCharacter(spec);
      expect(art.parts.length).toBeGreaterThanOrEqual(6);
      for (const part of art.parts) {
        expect(part.svg.w).toBeGreaterThan(0);
        expect(part.svg.h).toBeGreaterThan(0);
        expect(part.pivotX).toBeGreaterThanOrEqual(0);
        expect(part.pivotX).toBeLessThanOrEqual(1);
        expect(part.pivotY).toBeGreaterThanOrEqual(0);
        expect(part.pivotY).toBeLessThanOrEqual(1);
        const svg = part.svg.toString();
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg.endsWith('</svg>')).toBe(true);
        expect(svg).not.toContain('NaN');
        expect(svg).not.toContain('undefined');
      }
    }
  });

  it('always emits the parts the rig animates', () => {
    for (const spec of Object.values(ALL_CHARACTER_ART)) {
      const names = buildCharacter(spec).parts.map((p) => p.name);
      for (const required of ['head', 'torso', 'armFront', 'armBack', 'legFront', 'legBack']) {
        expect(names).toContain(required);
      }
    }
  });

  it('gives unique gradient ids so composed sheets do not cross-contaminate', () => {
    const svg = composeCharacter(buildCharacter(ALL_CHARACTER_ART.paladin!)).toString();
    const ids = [...svg.matchAll(/id="([^"]+)"/g)].map((m) => m[1]!);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('scales proportions with height, keeping the head above the hips', () => {
    for (const spec of Object.values(ALL_CHARACTER_ART)) {
      const sk = skeletonFor(spec);
      expect(sk.headCenter).toBeGreaterThan(sk.shoulder);
      expect(sk.shoulder).toBeGreaterThan(sk.hip);
      expect(sk.hip).toBeGreaterThan(0);
      expect(sk.headCenter).toBeLessThan(spec.height * 1.2);
    }
  });

  it('lays parts out back to front with the weapon in the hand', () => {
    const art = buildCharacter(ALL_CHARACTER_ART.guardian!);
    const layout = characterLayout(art);
    const order = layout.map((p) => p.name);
    expect(order.indexOf('torso')).toBeGreaterThan(order.indexOf('armBack'));
    expect(order.indexOf('head')).toBeGreaterThan(order.indexOf('torso'));
    expect(order.indexOf('weapon')).toBeGreaterThan(order.indexOf('armFront'));
    // Every part sits above the ground line.
    for (const p of layout) expect(p.y).toBeLessThanOrEqual(0);
  });

  it('composes a sheet with sane bounds', () => {
    for (const spec of Object.values(ALL_CHARACTER_ART)) {
      const doc = composeCharacter(buildCharacter(spec));
      expect(doc.w).toBeGreaterThan(spec.height * 0.3);
      expect(doc.h).toBeGreaterThan(spec.height * 0.8);
      expect(doc.h).toBeLessThan(spec.height * 3);
    }
  });
});

describe('colour', () => {
  it('round-trips hex', () => {
    expect(rgbToHex(hexToRgb('#3f7a4e'))).toBe('#3f7a4e');
  });

  it('lightens and darkens monotonically', () => {
    const base = '#5a7bb5';
    const light = hexToRgb(lighten(base, 0.5));
    const dark = hexToRgb(darken(base, 0.5));
    const mid = hexToRgb(base);
    expect(light.r + light.g + light.b).toBeGreaterThan(mid.r + mid.g + mid.b);
    expect(dark.r + dark.g + dark.b).toBeLessThan(mid.r + mid.g + mid.b);
  });

  it('stays inside the byte range at the extremes', () => {
    for (const hex of ['#000000', '#ffffff', '#ff0000']) {
      for (const out of [lighten(hex, 1), darken(hex, 1), mix(hex, '#123456', 0.5)]) {
        const { r, g, b } = hexToRgb(out);
        for (const v of [r, g, b]) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(255);
        }
      }
    }
  });

  it('derives a five-tone ramp that is ordered', () => {
    const t = tones('#7db83f');
    const lum = (h: string) => {
      const c = hexToRgb(h);
      return c.r + c.g + c.b;
    };
    expect(lum(t.highlight)).toBeGreaterThan(lum(t.light));
    expect(lum(t.light)).toBeGreaterThan(lum(t.base));
    expect(lum(t.base)).toBeGreaterThan(lum(t.shadow));
    expect(lum(t.shadow)).toBeGreaterThan(lum(t.outline));
  });

  it('gives every castle skin a full palette', () => {
    for (const s of WALL_SKINS) {
      for (const c of [s.stone, s.roof, s.banner, s.trim]) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('grid maths', () => {
  it('maps cell centres back to their own row and column', () => {
    for (let r = 0; r < GRID.rows; r += 1) {
      for (let c = 0; c < GRID.cols; c += 1) {
        const p = cellCenter(r, c);
        expect(rowFromY(p.y)).toBe(r);
        expect(colFromX(p.x)).toBe(c);
        expect(isInsideField(p.x, p.y)).toBe(true);
      }
    }
  });

  it('rejects points outside the playfield', () => {
    expect(isInsideField(10, cellCenter(0, 0).y)).toBe(false);
    expect(isInsideField(cellCenter(0, 0).x, 10)).toBe(false);
  });

  it('stands units near the bottom of their lane', () => {
    for (let r = 0; r < GRID.rows; r += 1) {
      const ground = laneGroundY(r);
      expect(ground).toBeGreaterThan(cellCenter(r, 0).y);
      expect(ground).toBeLessThanOrEqual(GRID.y0 + (r + 1) * GRID.cellH);
    }
  });
});
