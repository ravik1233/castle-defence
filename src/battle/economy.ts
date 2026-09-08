/**
 * The in-battle Ember economy.
 *
 * Gold is permanent and lives in the profile. Ember exists for one battle:
 * it is spent on deployments and earned from visible actions such as kills
 * and finite mineral veins. Nothing here pays a passive wage between waves.
 */

/** Existing roster prices were authored on a 25-gold step. */
export const LEGACY_GOLD_PER_EMBER = 25;
/** Slightly generous once the horde becomes heavier, without returning to
 * fractional or trickling income. */
export const LEGACY_BOUNTY_PER_EMBER = 10;
/** Every vein is finite and advertises this many deposits. */
export const EMBER_DEPOSITS_PER_VEIN = 3;

/** Small whole-number cost shown and charged during battle. */
export function emberCost(legacyGold: number): number {
  return Math.max(1, Math.round(legacyGold / LEGACY_GOLD_PER_EMBER));
}

/** Whole Ember released when an enemy falls. */
export function emberBounty(legacyBounty: number): number {
  return Math.max(1, Math.round(legacyBounty / LEGACY_BOUNTY_PER_EMBER));
}

/**
 * Kept for campaign balance calculations while old level data is migrated.
 * A muster deliberately pays nothing: battle income comes from play.
 */
export function musterPay(_chapter: number, _trickle = 0): number {
  return 0;
}
