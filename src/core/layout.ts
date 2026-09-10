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

/**
 * The keep, at the far left: where the commander stands and the reserves
 * wait. Narrow on purpose - it is the last two hundred pixels of the realm,
 * and it should look like it.
 */
export const KEEP_STRIP = { x: 0, width: 200 } as const;

/**
 * Columns of the grid that are wall rather than open ground.
 *
 * The wall used to be a painted strip you could not stand on, with a gate
 * drawn across it. It is two tiles of the grid now, so it can be built on
 * like anywhere else: the parapet is a place to put a shooter, not just a
 * health bar that goes down.
 */
export const WALL_COLS = 2;

export const GRID = {
  rows: 5,
  /** Two of wall, then the open field. */
  cols: WALL_COLS + 6,
  x0: KEEP_STRIP.width,
  y0: HUD.height + HORIZON,
  cellW: 200,
  cellH: 150,
} as const;

/** The first column of open ground; everything left of it is parapet. */
export const FIELD_COL0 = WALL_COLS;

/** True for the two columns that are the wall itself. */
export function isWallCol(col: number): boolean {
  return col >= 0 && col < WALL_COLS;
}

export const FIELD = {
  x: 0,
  /** Top of the lanes. */
  y: GRID.y0,
  width: DESIGN.width,
  height: GRID.rows * GRID.cellH,
  /** Scenery band drawn above the lanes: sky, hills, treeline. */
  horizon: HORIZON,
} as const;

/**
 * The wall: the keep strip plus the two tiles that can be built on.
 *
 * There is no gate. One was drawn across the face, perpendicular to the
 * wall, and read as a door lying on its side - the lanes run left to right,
 * so anything standing square to them fights the perspective. A breached
 * section is a hole in the stonework now, which is what a breach looks like.
 */
export const WALL = {
  x: KEEP_STRIP.width,
  width: WALL_COLS * GRID.cellW,
} as const;

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

/** Anywhere a card may be played: the parapet counts, the keep strip does not. */
export function isInsideField(x: number, y: number): boolean {
  const c = colFromX(x);
  const r = rowFromY(y);
  return c >= 0 && c < GRID.cols && r >= 0 && r < GRID.rows;
}

/** X of the wall face that enemies attack: the outer edge of the parapet. */
export const WALL_FACE_X = WALL.x + WALL.width - 6;

/**
 * Left edge of the open field.
 *
 * Distinct from `WALL.width` now, which is only how wide the parapet is. Code
 * that wants "just inside the fighting ground" wants this.
 */
export const FIELD_X0 = WALL.x + WALL.width;

/**
 * Where the commander stands, and where the reserves wait behind him.
 *
 * A breached lane is not the end of the battle - enemies come through the
 * stonework into the keep, and only cutting down the commander loses the
 * day. He holds the centre lane; the reserves stack up the strip beside him.
 */
export const KEEP = { x: KEEP_STRIP.width / 2, radius: 54 } as const;

/** Where a reserve waits before it is called into a lane. */
export function reservePost(index: number): { x: number; y: number } {
  return {
    x: KEEP_STRIP.width * (index % 2 === 0 ? 0.32 : 0.68),
    y: laneGroundY(Math.min(GRID.rows - 1, Math.floor(index / 2))),
  };
}

/**
 * Meta screens (menu, map, armoury) lay out inside a centred column rather
 * than spreading across the full width, which would leave text unreadably wide.
 */
export const PANEL = { width: 1120, x: DESIGN.width / 2 } as const;
