/**
 * Battle income, in whole coins.
 *
 * Gold used to arrive as a continuous trickle, which meant the player could
 * never say what a decision cost - only that they had more later. Everything
 * here pays in lumps a player can count and plan against: a wage at each
 * muster, and a bounty for giving the muster up early.
 */

/** Base wage paid at the start of every muster. */
export const MUSTER_PAY = 55;
/** Gold per whole second of muster given up by calling the assault on. */
export const CALL_BOUNTY = 4;

/**
 * What a muster pays. Scaled per region the same way kill bounties are, so
 * the wage keeps buying roughly the same thing as costs rise.
 */
export function musterPay(chapter: number, trickle = 0): number {
  return Math.round((MUSTER_PAY + trickle * 8) * (1 + (Math.max(1, chapter) - 1) * 0.15));
}

/** What calling the assault on with this much muster left would pay. */
export function callBounty(secondsLeft: number): number {
  return Math.max(0, Math.round(secondsLeft)) * CALL_BOUNTY;
}
