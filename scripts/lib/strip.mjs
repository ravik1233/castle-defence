/**
 * Sizing the poses in an animation strip.
 *
 * Kept apart from the importer because it decides whether a unit throbs as it
 * walks, and that is worth testing without a browser and a real PNG in the
 * way.
 */

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
