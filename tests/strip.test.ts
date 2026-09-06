/**
 * Sizing the poses in an animation strip.
 *
 * The failure that matters here is silent: frames that come out at slightly
 * different sizes still import, and the unit throbs as it walks forever.
 */
import { describe, expect, it } from 'vitest';
import { frameScales } from '../scripts/lib/strip.mjs';

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
