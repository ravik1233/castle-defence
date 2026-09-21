/**
 * When a card arrives, and what the next fort does about it.
 *
 * The campaign used to hand a region's whole muster over at its first fort:
 * seventeen cards at the Broken Fields, then fifteen forts with nothing new
 * in any of them. That is a lump, not a progression - it buries the player
 * at the moment they know least, and then gives them nothing to look forward
 * to for an hour.
 *
 * So cards drip, one at a time, and the fort *after* each one is built to
 * give it something to do. Unlock, then showcase, on repeat. Something new
 * happens in eleven forts out of every fifteen instead of one.
 *
 * THE RULE THAT KEEPS A SHOWCASE FROM BEING A TUTORIAL
 * ---------------------------------------------------
 * A showcase invites the new card. It never requires it. The fort after the
 * Archer puts flyers in the sky, and the Archer is the neat answer - but a
 * Bombard shoots air too, and so does letting them reach the wall and
 * meeting them with the commander and the reserves. The card should be about
 * twice as good as the next-best answer, never the only one. That is how a
 * fort teaches and still leaves room to be solved a different way.
 */
import type { DefenderDef, EnemyDef } from './types';

/** Forts in every region. */
export const REGION_LENGTH = 15;

/**
 * Which fort of a region each of its five cards arrives at.
 *
 * Spread so that a card and its showcase never collide with the region's
 * consolidation forts (5, 8, 11) or its boss (15).
 */
export const CARD_FORTS = [1, 3, 6, 9, 12] as const;

/**
 * Region 1, hand-dealt.
 *
 * It carries seventeen cards rather than five and opens with two scripted
 * forts, so it cannot use the ordinary rhythm. Militia and the Engineer are
 * fixed by the tutorial's own deck; everything after that alternates card,
 * showcase, card, showcase, with the Crown Pack's cards riding alongside the
 * free ones so that buying the pack thickens each fort rather than dumping
 * nine more cards at the first.
 */
const REGION_ONE: Array<{ fort: number; cards: string[] }> = [
  { fort: 1, cards: ['militia'] },
  { fort: 2, cards: ['dwarf_engineer'] },
  { fort: 3, cards: ['archer', 'watchman'] },
  { fort: 5, cards: ['barricade', 'spearwall'] },
  { fort: 7, cards: ['guardian', 'oilpot'] },
  { fort: 9, cards: ['frostmage', 'brazier'] },
  { fort: 11, cards: ['arbalest', 'pavise'] },
  { fort: 13, cards: ['bombard', 'pyromancer', 'confessor'] },
  { fort: 14, cards: ['skywatch', 'paladin'] },
];

/** The first global level number of a region. */
export function regionBase(region: number): number {
  return (region - 1) * REGION_LENGTH + 1;
}

/**
 * The fort each card is unlocked at, as a global level number.
 *
 * Read off the roster rather than typed beside each unit: the authored
 * `unlockLevel` already says which region a card belongs to, and this only
 * decides where inside that region it lands. A card that is added to a
 * region later is dealt a slot automatically instead of quietly arriving at
 * fort one with everything else.
 */
export function dripUnlocks(roster: DefenderDef[]): Map<string, number> {
  const out = new Map<string, number>();

  for (const step of REGION_ONE) {
    for (const id of step.cards) out.set(id, step.fort);
  }

  const byRegion = new Map<number, DefenderDef[]>();
  for (const def of roster) {
    const region = Math.floor((def.unlockLevel - 1) / REGION_LENGTH) + 1;
    if (region <= 1) continue;
    const list = byRegion.get(region) ?? [];
    list.push(def);
    byRegion.set(region, list);
  }

  for (const [region, defs] of byRegion) {
    // Cheapest first: a region should open with something the player can
    // actually afford on the Ember its first fort hands them.
    const ordered = defs.slice().sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));
    ordered.forEach((def, i) => {
      const fort = CARD_FORTS[Math.min(i, CARD_FORTS.length - 1)]!;
      out.set(def.id, regionBase(region) + fort - 1);
    });
  }
  return out;
}

/** True when this fort is the one a card arrives at. */
export function cardsArrivingAt(unlocks: Map<string, number>, level: number): string[] {
  const out: string[] = [];
  for (const [id, at] of unlocks) if (at === level) out.push(id);
  return out;
}

/**
 * What a card most wants to see walking at it.
 *
 * Picked from the region's own pool by what the card is for, so a showcase
 * is authored once here rather than a hundred and five times by hand, and a
 * region whose roster changes still gets a fort that makes its point.
 */
export function showcaseEnemy(
  card: DefenderDef,
  roster: EnemyDef[],
  ceiling = Infinity,
): string | undefined {
  /*
   * Never heavier than what this fort was already going to field.
   *
   * A showcase is allowed to bring its enemy forward of where the region
   * would have revealed it, which is the whole mechanism - but forward is
   * not the same as above its weight. Without this ceiling the Throne's
   * second fort reached for the lightest *armoured* demon it could find,
   * which is still a Balor, and came out 2.8 times the fort before it.
   */
  const pool = roster.filter((e) => e.threat <= ceiling);
  if (!pool.length) return undefined;
  /*
   * The lightest body that makes the point, not the heaviest.
   *
   * A showcase often has to bring its enemy forward of where the region
   * would have revealed it, and reaching for the heaviest flyer or the
   * heaviest armoured thing turns a lesson into an ambush - it put a Bone
   * Golem into the seventh fort of the Barrow Moors and made it 2.4 times
   * the fort before it. The cheapest one teaches exactly as well: what the
   * player needs to learn is that these fly, and three cheap flyers show
   * that better than one expensive one anyway.
   */
  const teacher = (list: EnemyDef[]): EnemyDef | undefined =>
    list.slice().sort((a, b) => a.threat - b.threat)[0];
  const attack = card.attack;

  // A bow that can be raised is taught by something in the air. This is the
  // Archer fort: flyers arrive, the Archer answers them neatly, and a
  // Bombard, a Skywatch or the commander and the reserves all answer them
  // expensively - which is the texture every showcase is aiming for.
  if (attack && attack.targets !== 'ground' && attack.range >= 400) {
    const flyer = teacher(pool.filter((e) => e.flying));
    if (flyer) return flyer.id;
  }
  // Holy is only ever a choice against what holy was written for.
  if (attack?.damageType === 'holy') {
    const cursed = teacher(pool.filter((e) => e.kind === 'undead' || e.kind === 'demon'));
    if (cursed) return cursed.id;
  }
  // Splash and pierce are taught by numbers, not by one big body.
  if (card.role === 'aoe' || (attack?.splash ?? 0) > 0 || (attack?.pierce ?? 0) > 0) {
    const cheapest = teacher(pool);
    if (cheapest) return cheapest.id;
  }
  // Anything that hits hard once is taught by plate.
  const armoured = teacher(pool.filter((e) => e.armor >= 2 || e.kind === 'armoured'));
  if (armoured) return armoured.id;

  return teacher(pool)?.id;
}
