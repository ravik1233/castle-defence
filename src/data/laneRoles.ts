/**
 * What makes one gate a different problem from the gate beside it.
 *
 * A doctrine changes how a whole fort is played. A lane role changes how one
 * of its five gates is played, which is a different thing: it means a single
 * battle can pose several problems at once, and the player has to decide
 * which of them to answer properly and which to leave to the reserves.
 *
 * That is the point of them. Reserves are four bodies shared across five
 * lanes, filling whichever one loses its holders - useful, but not a
 * decision. Once some lanes are cheap to hold and some are expensive, the
 * real question becomes which lane you deliberately under-defend, and the
 * reserve pool turns into strategy without a line of new reserve code.
 *
 * Like doctrines and ground, roles are dealt from the fort's own id, so every
 * player meets the same gates at the same fort, and they are declared in the
 * briefing before the deck is picked. A role discovered at wave four is not
 * strategy, it is a surprise.
 */
import { FIELD_COL0, GRID, WALL_COLS, isWallCol } from '../core/layout';
import type { DoctrineId } from './doctrines';
import type { TileKind } from './types';

export type LaneRoleId =
  | 'broken'
  | 'defile'
  | 'flooded'
  | 'collapsed'
  | 'sallyport'
  | 'consecrated'
  | 'seam'
  | 'windward'
  | 'killingground';

export interface LaneRoleDef {
  id: LaneRoleId;
  name: string;
  /** What is wrong with this gate, in the words the player gets up front. */
  blurb: string;
  /** The counter-play, so a role teaches rather than only warns. */
  answer: string;
}

export const LANE_ROLES: Record<LaneRoleId, LaneRoleDef> = {
  broken: {
    id: 'broken',
    name: 'Broken Rampart',
    blurb: 'This gate has no wall left to stand on. The parapet is rubble.',
    answer: 'Hold it forward on open ground, or give it up and let reserves pay for it.',
  },
  defile: {
    id: 'defile',
    name: 'Defile',
    blurb: 'A narrow cut. Almost nothing can be built here - and almost nothing gets through.',
    answer: 'One good unit is the whole garrison. Spend the rest elsewhere.',
  },
  flooded: {
    id: 'flooded',
    name: 'Flooded',
    blurb: 'The field is under water. Only what floats can be put on it, and they wade in slowly.',
    answer: 'Shoot it from the parapet, which is dry - or let the water buy you the time.',
  },
  collapsed: {
    id: 'collapsed',
    name: 'Collapsed Gate',
    blurb: 'This section is already down. The way in is open from the first wave.',
    answer: 'Rebuild it with Ember, or hold the gap with a body that can take a hit.',
  },
  sallyport: {
    id: 'sallyport',
    name: 'Sally Port',
    blurb: 'The one gate you can march out of. Kills in the open here pay double salvage.',
    answer: 'Push out when the lane is quiet, and get them home before the next wave.',
  },
  consecrated: {
    id: 'consecrated',
    name: 'Consecrated Ground',
    blurb: 'Holy ground. Nothing rises again here, and holy blows bite deeper.',
    answer: 'A gift. Spend your real answers on the other four gates.',
  },
  seam: {
    id: 'seam',
    name: 'Rich Seam',
    blurb: 'Two Ember veins run under this gate - and they know it. One more body every wave.',
    answer: 'Mine it and pay for the fort, or leave it and stay safe. Not both.',
  },
  windward: {
    id: 'windward',
    name: 'Windward Gate',
    blurb: 'The wind is straight down this lane. Everything shooting into it falls a quarter short.',
    answer: 'Melee does not care about the wind. Put a body here instead of a bow.',
  },
  killingground: {
    id: 'killingground',
    name: 'Killing Ground',
    blurb: 'Open, overlooked and bare. Shooters see a third further; nothing has anywhere to hide.',
    answer: 'A shooting gallery, if you garrison it. A corridor, if you do not.',
  },
};

/** How much each role bites, in one place so the briefing cannot lie. */
export const LANE_ROLE_EFFECT = {
  /** Windward and killing ground, against a shooter's reach in that lane. */
  windwardRange: 0.75,
  killingGroundRange: 1.3,
  /** Field kills in a sally port lane are worth this much salvage. */
  sallyPortSalvage: 2,
  /** A rich seam draws this many extra bodies per wave. */
  seamExtraPerWave: 1,
  /** Buildable field cells left in a defile. */
  defileBuildable: 2,
  /** Veins a rich seam lane carries. */
  seamVeins: 2,
} as const;

const ALL: LaneRoleId[] = Object.keys(LANE_ROLES) as LaneRoleId[];

/**
 * Where a role may appear at all.
 *
 * Flooded is the one with a real constraint behind it rather than a
 * flavour one. Every aquatic unit in the game is Sael's, sold in the Crown
 * Pack and not unlocked until the Drowned Coast - so a flooded lane in an
 * early region would be a mechanic the player cannot buy their way out of,
 * which is a paywall wearing a difficulty costume. It waits until the coast
 * is in sight, and even then the dry parapet is always a legitimate answer.
 */
function allowedIn(role: LaneRoleId, chapter: number): boolean {
  return role === 'flooded' ? chapter >= 4 : true;
}

/**
 * Roles that would undo, duplicate or contradict a rule the whole fort is
 * already fought under.
 *
 * Sally port against Hold the Line is the sharp one: the doctrine forbids
 * sorties outright, so the role would advertise a gate the player is not
 * allowed to use.
 */
function conflicts(role: LaneRoleId, doctrines: readonly DoctrineId[]): boolean {
  const against: Partial<Record<LaneRoleId, DoctrineId[]>> = {
    collapsed: ['breached'],
    seam: ['frozenground'],
    sallyport: ['holdtheline'],
    windward: ['night'],
  };
  return (against[role] ?? []).some((d) => doctrines.includes(d));
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Fisher-Yates against a seeded stream, so every player is dealt the same hand. */
function shuffle<T>(items: T[], seed: number): T[] {
  const out = items.slice();
  let s = seed || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * How many gates this fort makes awkward.
 *
 * Region 1 shows a player five identical gates for seven forts before it
 * makes one of them different, because the first thing anyone learns should
 * not be an exception to a rule nobody has told them yet. After that a fort
 * poses one, and the hard end of a region poses two.
 */
function roleCount(index: number, chapter: number): number {
  if (chapter === 1 && index < 7) return 0;
  if (index >= 13) return 2;
  if (index >= 7) return 1;
  return index % 2 === 1 ? 1 : 0;
}

/**
 * The roles this fort's gates are fought under, by lane.
 *
 * Dealt from a shuffled deck per region rather than rolled per fort, for the
 * same reason the doctrines are: rolling independently makes the same role
 * land five times in fifteen forts by pure chance, and "the flooded region"
 * is one idea rather than fifteen.
 */
export function laneRolesFor(
  levelId: string,
  index: number,
  chapter: number,
  doctrines: readonly DoctrineId[] = [],
): Array<LaneRoleId | undefined> {
  const lanes: Array<LaneRoleId | undefined> = new Array(GRID.rows).fill(undefined);
  const count = roleCount(index, chapter);
  if (!count) return lanes;

  const deck = shuffle(
    ALL.filter((r) => allowedIn(r, chapter) && !conflicts(r, doctrines)),
    hash(`${chapter}:lanes`),
  );
  if (!deck.length) return lanes;

  // Walk the region's deck rather than re-drawing it, so two forts running
  // do not pose the same gate and a region gets through its whole hand.
  let cursor = 0;
  for (let i = 0; i < index; i += 1) cursor += roleCount(i, chapter);

  const rowOrder = shuffle(
    Array.from({ length: GRID.rows }, (_, r) => r),
    hash(`${levelId}:lanes`),
  );
  for (let n = 0; n < count; n += 1) {
    const role = deck[(cursor + n) % deck.length]!;
    const row = rowOrder[n]!;
    lanes[row] = role;
  }
  return lanes;
}

/** Every lane carrying this role. */
export function lanesWith(
  roles: ReadonlyArray<LaneRoleId | undefined> | undefined,
  id: LaneRoleId,
): number[] {
  const out: number[] = [];
  (roles ?? []).forEach((role, row) => {
    if (role === id) out.push(row);
  });
  return out;
}

/**
 * Cuts the ground a role's lane is fought on.
 *
 * Applied after the region's own terrain, and deliberately allowed to
 * overrule it - including the guarantee that every lane keeps dry cells to
 * build on. A flooded gate with two patches of dry field would not be a
 * flooded gate; the dry ground it keeps is the parapet, which is the answer
 * the role is written around.
 */
export function applyLaneRoles(
  tiles: TileKind[][],
  roles: ReadonlyArray<LaneRoleId | undefined>,
): TileKind[][] {
  const out = tiles.map((row) => row.slice());
  const fieldCols = Array.from({ length: GRID.cols }, (_, c) => c).filter(
    (c) => !isWallCol(c) && c !== FIELD_COL0,
  );

  roles.forEach((role, row) => {
    const cells = out[row];
    if (!role || !cells) return;
    switch (role) {
      case 'broken':
        for (let c = 0; c < WALL_COLS; c += 1) cells[c] = 'rubble';
        break;
      case 'defile': {
        // Keep the cells nearest the wall: a defile the player can only hold
        // at the far end is a defile they cannot reinforce.
        const kept = new Set(fieldCols.slice(0, LANE_ROLE_EFFECT.defileBuildable));
        for (const c of fieldCols) if (!kept.has(c)) cells[c] = 'rubble';
        for (const c of kept) cells[c] = 'plain';
        break;
      }
      case 'flooded':
        for (const c of fieldCols) cells[c] = 'water';
        break;
      case 'seam': {
        for (const c of fieldCols) if (cells[c] === 'seam') cells[c] = 'plain';
        for (const c of fieldCols.slice(0, LANE_ROLE_EFFECT.seamVeins)) cells[c] = 'seam';
        break;
      }
      case 'killingground':
        // Bare ground: the range is granted by the lane itself, so what the
        // tiles have to say is that there is nowhere here to hide.
        for (const c of fieldCols) if (cells[c] === 'tallgrass') cells[c] = 'plain';
        break;
      default:
        // collapsed, sallyport, consecrated and windward change the fight,
        // not the floor.
        break;
    }
  });
  return out;
}
