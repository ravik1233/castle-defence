# Design and balance notes

## The fantasy

You are the last commander on the last wall. Everything east of you is already
gone. The game never lets you push forward — you only hold, and the reward for
holding is another wall to hold. The fail state is total and immediate: the
gate reaches zero, and that is the end of humanity, not a lost level.

## The loop

1. Place a **Tithe Shrine** to start gold flowing.
2. Spend that gold on defenders in the five lanes as the horde arrives.
3. Tap hero spells to save a lane that is about to break.
4. Survive every wave; the gate's remaining health becomes your star rating.
5. Spend the payout in the Armoury on permanent upgrades and a better deck.

A battle lasts 3–6 minutes: right for a phone, long enough to build an economy.

## Economy

| | |
| --- | --- |
| Starting gold | 175–300, rising through the campaign |
| Tithe Shrine | 50 gold, returns 25 every 7s (pays for itself in ~14s) |
| Cheapest defender | 50 (Militia, Barricade) |
| Most expensive | 375 (Paladin, Crown Pack) |
| Kill bounty | 6–80, +15% per chapter |
| Level reward | 120–1000, one third on replay |

Tuning intent: an economy-first opening is correct but risky — skipping the
first Militia to squeeze in a second Shrine should feel like a real gamble on
the first wave's timing.

## Difficulty

Enemy strength scales as `(1 + 0.22·(chapter−1)) · (1 + 0.045·wave)`
(`enemyScaling` in `src/battle/combat.ts`). Waves are generated from a threat
budget, not hand-listed: each level declares a starting budget and a growth
rate, and the generator spends it on that level's enemy pool, biased toward the
strongest thing it can afford so waves escalate on their own.

Because the generator is seeded from the level id, every player everywhere
fights exactly the same waves, and rebalancing a level is one number.

Every fifth wave and the final wave are "big": 1.55× budget and a warning
banner. Chapter finales add their boss.

## Roles

Each defender answers a specific threat, so the deck is a real decision:

| Role | Answer to | Cards |
| --- | --- | --- |
| Economy | The whole game | Tithe Shrine |
| Wall | Chargers, buying time | Barricade |
| Melee | Anything that reaches the line | Militia, Guardian, Monk, Paladin |
| Ranged | Flyers, packed lanes | Archer, Arbalest, Ballista |
| Splash | Swarms | Bombard, Pyromancer, Monk |
| Support | Tanks and berserkers | Cleric, Frost Adept, Warding Brazier |

Enemy behaviours are built to punish a one-note deck: **flyers** ignore ground
blockers until the wall, **leapers** hop the first line, **bombers** delete a
melee unit outright, **healers** undo chip damage, **summoners** add bodies,
and **chargers** sprint the last stretch.

## The heroes

Spells are the only thing that reacts in real time, and they are on cooldowns
rather than a second currency — one resource is enough on a phone.

- **Sir Aldric** (free) — *Holy Smite*: 320 damage in a small circle, 12s.
  *Rally*: all defenders +60% attack speed for 8s, 30s.
- **Seraphina** (Crown Pack) — *Chain Lightning*: 210 damage arcing through six
  enemies in a lane, 14s. *Blizzard*: freezes the whole field for 5s, 40s.

## Monetisation

One product at $4.99 and nothing else. No second currency, no energy timer, no
loot box, no ads inside a battle. The free campaign is 30 levels — a complete
game with a real ending. The Crown Pack is an epilogue plus tools, sold to
people who finished and want more, which is the version of this business model
players do not resent.

The pack deliberately includes the ad removal, so the honest pitch is "pay once
and the game stops asking you for anything".
