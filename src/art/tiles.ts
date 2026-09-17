/**
 * Readable ground-feature sprites for the battlefield grid.
 *
 * These stay separate from the painted biome backdrops: the background sets
 * the country, while a tile must remain legible under units, spells and lane
 * lighting at phone size.
 */
import { darken, lighten, withAlpha } from '../core/color';
import { Svg, draw } from './Svg';

export type GroundArtId = 'water' | 'marsh' | 'highground' | 'rubble' | 'tallgrass' | 'shrine' | 'seam';

const W = 188;
const H = 136;

export function groundTile(id: GroundArtId): Svg {
  switch (id) {
    case 'water':
      return draw(W, H, (s) => {
        s.ellipse(W / 2, 78, 84, 45, withAlpha('#17455d', 0.9), { width: 4, color: '#0c2f43' });
        s.ellipse(W / 2 - 8, 70, 70, 30, withAlpha('#3989a0', 0.72), { depth: 0 });
        for (const [y, drift] of [[54, 0], [76, 15], [96, -10]] as Array<[number, number]>) {
          s.path(`M ${24 + drift} ${y} Q ${44 + drift} ${y - 7} ${64 + drift} ${y} T ${104 + drift} ${y} T ${144 + drift} ${y}`, 'none', {
            width: 4,
            color: withAlpha('#a8efff', 0.72),
          });
        }
        s.path('M 24 90 Q 18 61 30 39 M 30 88 Q 42 60 38 36 M 150 94 Q 158 68 153 48', 'none', {
          width: 5,
          color: '#547754',
        });
      });
    case 'marsh':
      return draw(W, H, (s) => {
        s.ellipse(92, 82, 82, 39, withAlpha('#243b35', 0.92), { width: 4, color: '#172823' });
        s.ellipse(70, 74, 45, 22, withAlpha('#56765b', 0.58), { depth: 0 });
        s.ellipse(132, 91, 30, 18, withAlpha('#395846', 0.7), { depth: 0 });
        for (const [x, y, r] of [[48, 76, 8], [76, 93, 6], [113, 69, 7], [140, 90, 5]] as Array<[number, number, number]>) {
          s.circle(x, y, r, '#708d5d', { width: 2, color: '#344b36' });
        }
        for (const x of [28, 38, 151, 160]) {
          s.path(`M ${x} 100 Q ${x - 7} 62 ${x + 3} 38`, 'none', { width: 5, color: '#617947' });
        }
      });
    case 'highground':
      return draw(W, H, (s) => {
        s.ellipse(94, 112, 75, 16, withAlpha('#1d1717', 0.45), { depth: 0 });
        s.path('M 18 109 L 46 63 L 66 72 L 92 27 L 126 58 L 146 52 L 172 109 Z', '#746d65', {
          width: 5,
          color: '#3d3837',
        });
        s.path('M 92 27 L 126 58 L 106 66 L 80 55 Z', '#aaa08e', { depth: 0 });
        s.path('M 46 63 L 66 72 L 54 88 L 30 86 Z', '#91887a', { depth: 0 });
        s.path('M 110 68 L 146 52 L 135 82 Z', darken('#746d65', 0.24), { depth: 0 });
      });
    case 'rubble':
      return draw(W, H, (s) => {
        s.ellipse(94, 105, 76, 17, withAlpha('#1c1716', 0.38), { depth: 0 });
        const rocks: Array<[number, number, number, string]> = [
          [31, 88, 24, '#76695c'], [58, 67, 28, '#8e8071'], [88, 91, 25, '#665b52'],
          [116, 61, 31, '#948777'], [147, 89, 25, '#776b60'], [83, 46, 19, '#a39787'],
        ];
        for (const [x, y, r, color] of rocks) {
          s.path(`M ${x - r} ${y + r * 0.45} L ${x - r * 0.7} ${y - r * 0.45} L ${x} ${y - r} L ${x + r * 0.8} ${y - r * 0.35} L ${x + r} ${y + r * 0.48} Z`, color, {
            width: 4,
            color: darken(color, 0.38),
          });
          s.sheen(`M ${x - r * 0.55} ${y - r * 0.34} L ${x} ${y - r * 0.76} L ${x + r * 0.35} ${y - r * 0.28} Z`, 0.22);
        }
      });
    case 'tallgrass':
      return draw(W, H, (s) => {
        s.ellipse(94, 109, 77, 15, withAlpha('#1f321c', 0.32), { depth: 0 });
        for (let i = 0; i < 23; i += 1) {
          const x = 17 + ((i * 31) % 154);
          const base = 110 - ((i * 13) % 10);
          const top = 34 + ((i * 23) % 46);
          const bend = i % 2 === 0 ? -12 : 12;
          const color = i % 3 === 0 ? '#9fc35a' : i % 3 === 1 ? '#6f9a45' : '#4f7c3d';
          s.path(`M ${x} ${base} Q ${x + bend} ${(base + top) / 2} ${x + bend * 0.7} ${top}`, 'none', {
            width: 5,
            color,
          });
        }
      });
    case 'shrine':
      return draw(W, H, (s) => {
        s.glow(94, 70, 64, '#ff9a45', 0.3);
        s.ellipse(94, 105, 68, 22, withAlpha('#1c1422', 0.45), { depth: 0 });
        s.ellipse(94, 93, 58, 30, '#4c4657', { width: 5, color: '#2a2433' });
        s.ellipse(94, 88, 44, 22, '#70697c', { width: 4, color: '#3d3747' });
        s.path('M 94 20 L 116 73 L 94 91 L 72 73 Z', '#ff9a45', { width: 5, color: '#7a3524' });
        s.path('M 94 35 L 105 70 L 94 78 L 83 70 Z', '#ffe1a0', { depth: 0 });
        for (const x of [45, 143]) {
          s.rect(x - 5, 61, 10, 35, 4, '#6e6578', { width: 3, color: '#312b39' });
          s.glow(x, 55, 18, '#ffb45d', 0.55);
        }
      });
    case 'seam':
      // Shipping builds override this key with the painted Ember deposit.
      return draw(W, H, (s) => {
        s.ellipse(94, 105, 72, 20, withAlpha('#241b27', 0.6), { depth: 0 });
        for (const [x, y, scale] of [[55, 77, 0.8], [91, 52, 1.25], [125, 76, 0.9]] as Array<[number, number, number]>) {
          s.glow(x, y, 25 * scale, '#ff7a28', 0.55);
          s.path(`M ${x} ${y - 34 * scale} L ${x + 17 * scale} ${y + 17 * scale} L ${x} ${y + 31 * scale} L ${x - 17 * scale} ${y + 17 * scale} Z`, lighten('#e84d1c', 0.16), {
            width: 4,
            color: '#6f1f1b',
          });
        }
      });
  }
}
