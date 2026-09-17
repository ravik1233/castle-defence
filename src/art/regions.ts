/** Shared regional palette for battle furniture, maps and meta screens. */
import type { BiomeId } from './scenery';

export interface RegionTheme {
  hud: number;
  tray: number;
  card: number;
  edge: number;
  keep: number;
  lane: number;
  wall: number;
}

export const REGION_THEME: Record<BiomeId, RegionTheme> = {
  fields: { hud: 0x1b2130, tray: 0x20283a, card: 0x2d3b53, edge: 0xc9ad67, keep: 0x756d61, lane: 0x6f7f43, wall: 0xeee5d2 },
  barrows: { hud: 0x17252b, tray: 0x1d3034, card: 0x294247, edge: 0x91b9ae, keep: 0x56666a, lane: 0x4b6a62, wall: 0xb9cccc },
  woods: { hud: 0x271b25, tray: 0x31222a, card: 0x49302f, edge: 0xc17443, keep: 0x5c514a, lane: 0x5b493b, wall: 0xc8aa90 },
  highland: { hud: 0x202832, tray: 0x29333d, card: 0x384853, edge: 0xc7b579, keep: 0x716c60, lane: 0x626b60, wall: 0xd2c9ae },
  coast: { hud: 0x132a35, tray: 0x173744, card: 0x235361, edge: 0x67c4c8, keep: 0x4f6d70, lane: 0x2e7180, wall: 0xa7d2d5 },
  abyss: { hud: 0x271821, tray: 0x331d28, card: 0x4b2933, edge: 0xe07843, keep: 0x51444d, lane: 0x673444, wall: 0xb9959f },
  throne: { hud: 0x1b1220, tray: 0x27152a, card: 0x3b203d, edge: 0xe1a23a, keep: 0x403746, lane: 0x51284f, wall: 0xaa879d },
};

export function themeFor(biome: BiomeId): RegionTheme {
  return REGION_THEME[biome];
}
