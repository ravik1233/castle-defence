/**
 * Splitting an animation strip into poses.
 *
 * The failure that matters here is silent: a strip that comes out as four
 * poses or six still imports, and the unit just animates wrongly forever.
 */
import { describe, expect, it } from 'vitest';
import { frameScales, mergeToCount, splitPoses } from '../scripts/lib/strip.mjs';

/** Column occupancy for figures at the given [start, end] spans. */
function columns(width: number, spans: Array<[number, number]>): number[] {
  const filled = new Array(width).fill(0);
  for (const [a, b] of spans) for (let x = a; x <= b; x += 1) filled[x] = 10;
  return filled;
}

describe('splitPoses', () => {
  it('finds one run per figure when they are clearly apart', () => {
    const runs = splitPoses(columns(1000, [[10, 100], [200, 290], [400, 490]]), 1000);
    expect(runs).toHaveLength(3);
  });

  it('ignores specks too small to be a figure', () => {
    const runs = splitPoses(columns(1000, [[10, 100], [500, 503]]), 1000);
    expect(runs).toHaveLength(1);
  });

  it('does not split a figure across the narrow gaps inside it', () => {
    // A boot, then two pixels of background, then a trailing spear.
    const runs = splitPoses(columns(1000, [[10, 100], [103, 140]]), 1000);
    expect(runs).toHaveLength(1);
  });
});

describe('mergeToCount', () => {
  it('folds a dropped weapon back into the pose it belongs to', () => {
    // Five figures, and the last one has shed its spear a little to the right.
    const runs: Array<[number, number]> = [
      [0, 90], [200, 290], [400, 490], [600, 690], [800, 880], [900, 960],
    ];
    const merged = mergeToCount(runs, 5);
    expect(merged).toHaveLength(5);
    // The dying figure and its spear became one span, and nothing else moved.
    expect(merged[4]).toEqual([800, 960]);
    expect(merged[0]).toEqual([0, 90]);
  });

  it('leaves a clean strip alone', () => {
    const runs: Array<[number, number]> = [[0, 90], [200, 290], [400, 490], [600, 690], [800, 890]];
    expect(mergeToCount(runs, 5)).toEqual(runs);
  });
});

describe('frameScales', () => {
  it('brings the standing poses to one height', () => {
    const scales = frameScales([200, 176, 170, 182, 120], 320);
    const heights = [200, 176, 170, 182].map((h, i) => h * scales[i]);
    for (const h of heights) expect(h).toBeCloseTo(320, 6);
  });

  it('leaves the death pose shorter instead of stretching it upright', () => {
    const scales = frameScales([200, 176, 170, 182, 120], 320);
    expect(120 * scales[4]).toBeLessThan(300);
  });

  it('does not let the death pose drag the other frames off scale', () => {
    // A death drawn very short must not make everything else grow.
    const tall = frameScales([200, 200, 200, 200, 200], 320);
    const withShortDeath = frameScales([200, 200, 200, 200, 90], 320);
    expect(withShortDeath.slice(0, 4)).toEqual(tall.slice(0, 4));
  });
});
