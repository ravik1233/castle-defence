/**
 * Fixed design resolution and battlefield geometry.
 *
 * The game is authored LANDSCAPE at 1920x1080 and scaled to fit the device,
 * so every screen position in the codebase is in these units.
 *
 * Landscape because the lanes run horizontally: enemies walk from the right
 * edge into the wall on the left. Lane direction should match the long axis of
 * the screen - it is why Plants vs Zombies is landscape and Clash Royale,
 * whose lanes run up the screen, is portrait. Portrait here bought one-thumb
 * play at the cost of six cramped columns and no sightline down a lane.
 */
export const DESIGN = { width: 1920, height: 1080 } as const;

/**
 * Art is authored smaller than gameplay size; this scales it up.
 * Tuned so a militia stands about 95% of a lane's height.
 */
export const WORLD_ART_SCALE = 0.9;

/** Top strip: gold, wave counter, gate health, pause. */
export const HUD = { y: 0, height: 88 } as const;

/**
 * Vertical budget, top to bottom: HUD, a band of sky and hills, five lanes,
 * then the card tray. In landscape the height is the scarce axis, so these
 * numbers are tight and must keep adding up to DESIGN.height.
 */
const HORIZON = 88;

export const GRID = {
  rows: 5,
  cols: 8,
  x0: 230,
  y0: HUD.height + HORIZON,
  cellW: 200,
  cellH: 150,
} as const;

export const FIELD = {
  x: 0,
  /** Top of the lanes. */
  y: GRID.y0,
  width: DESIGN.width,
  height: GRID.rows * GRID.cellH,
  /** Scenery band drawn above the lanes: sky, hills, treeline. */
  horizon: HORIZON,
} as const;

export const WALL = { x: 0, width: GRID.x0, gateWidth: 150 } as const;

/** Bottom strip: the card tray, the sell tool, the hero and their spells. */
export const TRAY = {
  y: FIELD.y + FIELD.height,
  height: DESIGN.height - (FIELD.y + FIELD.height),
  cardW: 132,
  cardH: 130,
  gap: 8,
  /** Left edge of the first card. */
  x0: 24,
} as const;

export const HERO_BAR = { x: 1010, y: TRAY.y, height: TRAY.height } as const;

/** Enemies enter here and walk toward the wall. */
export const SPAWN_X = DESIGN.width + 110;

/** Centre of a grid cell in screen coordinates. */
export function cellCenter(row: number, col: number): { x: number; y: number } {
  return {
    x: GRID.x0 + col * GRID.cellW + GRID.cellW / 2,
    y: GRID.y0 + row * GRID.cellH + GRID.cellH / 2,
  };
}

/** The ground line a unit standing in a row rests on. */
export function laneGroundY(row: number): number {
  return GRID.y0 + row * GRID.cellH + GRID.cellH * 0.9;
}

export function laneCenterY(row: number): number {
  return GRID.y0 + row * GRID.cellH + GRID.cellH / 2;
}

export function colFromX(x: number): number {
  return Math.floor((x - GRID.x0) / GRID.cellW);
}

export function rowFromY(y: number): number {
  return Math.floor((y - GRID.y0) / GRID.cellH);
}

export function isInsideField(x: number, y: number): boolean {
  const c = colFromX(x);
  const r = rowFromY(y);
  return c >= 0 && c < GRID.cols && r >= 0 && r < GRID.rows;
}

/** X of the wall face that enemies attack. */
export const WALL_FACE_X = GRID.x0 - 6;

/**
 * Meta screens (menu, map, armoury) lay out inside a centred column rather
 * than spreading across the full width, which would leave text unreadably wide.
 */
export const PANEL = { width: 1120, x: DESIGN.width / 2 } as const;
