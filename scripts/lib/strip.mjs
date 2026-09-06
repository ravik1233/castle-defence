/**
 * Splitting an animation strip into poses.
 *
 * Kept apart from the importer because this is the part that decides whether
 * a walk cycle is four frames or five, and it is worth testing without a
 * browser and a real PNG in the way.
 */

/**
 * Groups filled columns into runs of drawn content.
 *
 * A gap wide enough to read as background between two figures ends a pose;
 * the narrow ones inside a single figure - between a boot and a trailing
 * spear - do not.
 */
export function splitPoses(filled, width) {
  const gap = Math.max(4, Math.round(width * 0.012));
  const runs = [];
  let start = -1;
  let empty = 0;
  for (let x = 0; x <= width; x += 1) {
    if (x < width && filled[x] > 0) {
      if (start < 0) start = x;
      empty = 0;
    } else if (start >= 0) {
      empty += 1;
      if (empty >= gap || x === width) {
        runs.push([start, x - empty]);
        start = -1;
        empty = 0;
      }
    }
  }
  return runs.filter(([a, b]) => b - a > width * 0.01);
}

/**
 * Folds a split down to the number of poses a strip is supposed to have.
 *
 * A dropped weapon lying beside its dying owner belongs to that pose, but the
 * background between them is real background, so no gap threshold separates
 * that from two neighbouring figures. Knowing the strip holds five poses does:
 * merge across the narrowest gaps until five remain.
 */
export function mergeToCount(runs, want) {
  const out = runs.map(([a, b]) => [a, b]);
  while (out.length > want) {
    let best = 0;
    let bestGap = Infinity;
    for (let i = 0; i < out.length - 1; i += 1) {
      const g = out[i + 1][0] - out[i][1];
      if (g < bestGap) {
        bestGap = g;
        best = i;
      }
    }
    out.splice(best, 2, [out[best][0], out[best + 1][1]]);
  }
  return out;
}

/**
 * Scale for each pose so the standing ones come out the same height.
 *
 * The last pose is the death, which is legitimately shorter than the rest;
 * folding it into the average would stretch every other frame to compensate,
 * so it borrows the median scale instead of setting its own.
 */
export function frameScales(heights, target) {
  if (heights.length === 0) return [];
  const upright = heights.slice(0, Math.max(1, heights.length - 1));
  const median = [...upright].sort((a, b) => a - b)[Math.floor(upright.length / 2)];
  return heights.map((h, i) => (i < heights.length - 1 ? target / h : target / median));
}
