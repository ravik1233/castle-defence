/**
 * The in-battle Ember economy.
 *
 * Gold is permanent and lives in the profile. Ember exists for one battle:
 * it is spent on deployments and earned from visible actions such as kills
 * and finite mineral veins. Nothing here pays a passive wage between waves.
 *
 * Everything the player sees is counted in fives. A tray of cards priced at
 * 1, 2 and 4 reads like small change rather than a war chest, and the gap
 * between the cheapest card and the dearest is only ever a few clicks of the
 * counter. The same prices on a five-step read as decisions. Nothing about
 * the balance moves: every figure below is the old one multiplied out, so a
 * card that cost two militia still costs two militia.
 */

/** Existing roster prices were authored on a 25-gold step. */
export const LEGACY_GOLD_PER_EMBER = 25;
/** Slightly generous once the horde becomes heavier, without returning to
 * fractional or trickling income. */
export const LEGACY_BOUNTY_PER_EMBER = 10;
/** Every vein is finite and advertises this many deposits. */
export const EMBER_DEPOSITS_PER_VEIN = 3;
/** Ember is only ever counted, shown and spent in multiples of this. */
export const EMBER_STEP = 5;

/**
 * Puts a figure on the five-step, never letting it vanish.
 *
 * The floor matters as much as the rounding: a bounty or a refund that
 * rounded to nothing would read as the game quietly ignoring a kill.
 */
export function roundEmber(value: number): number {
  return Math.max(EMBER_STEP, Math.round(value / EMBER_STEP) * EMBER_STEP);
}

/** Small whole-number cost shown and charged during battle. */
export function emberCost(legacyGold: number): number {
  return roundEmber((legacyGold / LEGACY_GOLD_PER_EMBER) * EMBER_STEP);
}

/** Whole Ember released when an enemy falls. */
export function emberBounty(legacyBounty: number): number {
  return roundEmber((legacyBounty / LEGACY_BOUNTY_PER_EMBER) * EMBER_STEP);
}

/**
 * Battle income - a tithe's wage, a miner's haul - onto the same step.
 *
 * These are authored in the old whole-Ember units next to the unit they
 * belong to, so they are converted here rather than rewritten there: a
 * miner that still pays what a militia costs is the point of the number.
 */
export function emberIncome(amount: number): number {
  return roundEmber(amount * EMBER_STEP);
}

/**
 * Kept for campaign balance calculations while old level data is migrated.
 * A muster deliberately pays nothing: battle income comes from play.
 */
export function musterPay(_chapter: number, _trickle = 0): number {
  return 0;
}
