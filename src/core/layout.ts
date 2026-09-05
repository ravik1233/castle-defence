/**
 * Fixed design resolution and battlefield geometry.
 *
 * The game is authored portrait at 1080x1920 and scaled to fit the device, so
 * every screen position in the codebase is in these units.
 */
export const DESIGN = { width: 1080, height: 1920 } as const;

/** Art is drawn slightly smaller than gameplay size; this scales it up. */
export const WORLD_ART_SCALE = 1.13;

export const HUD = { y: 0, height: 150 } as const;
export const TRAY = { y: 158, height: 214, cardW: 150, cardH: 200, gap: 12 } as const;

export const GRID = {
  rows: 5,
  cols: 6,
  x0: 200,
  y0: 460,
  cellW: 146,
  cellH: 216,
} as const;

export const FIELD = {
  x: 0,
  /** Top of the lanes. */
  y: GRID.y0,
  width: DESIGN.width,
  height: GRID.rows * GRID.cellH,
  /** Scenery band drawn above the lanes, between the tray and row 0. */
  horizon: 80,
} as const;

export const WALL = { x: 0, width: GRID.x0, gateWidth: 120 } as const;

export const HERO_BAR = { y: 1566, height: 190 } as const;

/** Enemies enter here and walk toward the wall. */
export const SPAWN_X = DESIGN.width + 90;

/** Centre of a grid cell in screen coordinates. */
export function cellCenter(row: number, col: number): { x: number; y: number } {
  return {
    x: GRID.x0 + col * GRID.cellW + GRID.cellW / 2,
    y: GRID.y0 + row * GRID.cellH + GRID.cellH / 2,
  };
}

/** The ground line a unit standing in a row rests on. */
export function laneGroundY(row: number): number {
  return GRID.y0 + row * GRID.cellH + GRID.cellH * 0.86;
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
