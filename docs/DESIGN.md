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

## Why landscape

The lanes run horizontally: enemies enter at the right edge and walk into the
wall on the left. Lane direction should match the long axis of the screen -
which is why Plants vs Zombies is landscape and Clash Royale, whose lanes run
up the screen, is portrait. Portrait here bought one-thumb play at the cost of
six cramped columns and no sightline down a lane; landscape gives eight columns
and room to see a wave coming.

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
banner. Region finales add their boss.

## Regions

The campaign is seven regions of fifteen forts. A region is not a reskin: it
changes who you fight, who fights beside you, what you cast, and what the
ground is made of.

| # | Region | Horde | Beside you | Commander |
| --- | --- | --- | --- | --- |
| 1 | The Broken Fields | Goblins | Men of the Reach | Sir Aldric |
| 2 | The Barrow Moors | Undead | Dwarves of Kar Duhrn | Bran Ironbark |
| 3 | The Ashen Woods | Orcs | Elves of Elarion | Faelith of Elarion |
| 4 | The Iron Highlands | Beasts | Wardens of the Green | Seraphina |
| 5 | The Drowned Coast | The drowned | Tidewardens of Sael | Nerion of Sael |
| 6 | The Fallen March | The Fallen | The Order of the Last Gate | Ser Garrick Vane |
| 7 | Throne of the Demon King | Demons | Whoever Is Left | Maerwyn the Grey |

Regions 1-3 are free; 4-7 come with the Crown Pack. Each horde carries one
behaviour of its own, and the region's own five defenders are raised to answer
it: the undead **rise again** unless holy or fire put them down, orcs **rage**
as they bleed, beasts run faster **in a pack**, the Fallen carry a **shield
wall**, demons **step** through a portal past whatever is blocking them, and
goblins **steal gold** off you when they land a hit. Each region ends on one of
the King's commanders, and the last on the King.

## What a fort demands

A hundred and five forts that differ only in what is walking at you are one
decision made a hundred and five times. So every fort past the third declares
a rule of its own before the deck is picked - the gate already open, no wage
between waves, nothing that shoots seeing far, half as many bodies at twice the
size, one of your cards spoken for elsewhere. There are twelve, listed with
their counter-play in `src/data/doctrines.ts`, and the counter is printed next
to the problem, because a rule discovered at wave four is a surprise rather
than a strategy.

A region deals its rules from a deck rather than drawing each fort's
independently: its five signature rules first, then two borrowed from
elsewhere. Nothing repeats until the rest has been dealt, so no region leans on
one idea and no two forts running pose the same demand.

## Ground

The field is not flat. A cell can be rubble (nothing builds on it), marsh
(slows what crosses), a shrine (whoever stands here hits harder), an ore seam
(an economy building pays half again), high ground (nothing stands on it, but a
shooter beside it sees further), tall grass (cover from what shoots back), or
open water - which only what floats can be placed on, and the Drowned Coast is
made of it. Ground is generated per fort from its id, so placement is a
decision about this fort rather than a habit.

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

Forty-seven cards in all, eight opened by the first region and five by each
after. Every card is held inside a damage-per-gold band for its role
(`src/data/balance.ts`), so no card leads its field by half again and the deck
stays a choice rather than a shopping list.

Enemy behaviours are built to punish a one-note deck: **flyers** ignore ground
blockers until the wall, **leapers** hop the first line, **bombers** delete a
melee unit outright, **healers** undo chip damage, **summoners** add bodies,
and **chargers** sprint the last stretch.

## The heroes

Spells are the only thing that reacts in real time, and they are on cooldowns
rather than a second currency — one resource is enough on a phone.

A commander comes with the land they hold: crossing a border replaces the hand
you fight with. Seven commanders, two spells each, one per region.

- **Sir Aldric** (free) — *Holy Smite*, *Rally*.
- **Bran Ironbark** (free) — *Rockfall*, *War Horn*.
- **Faelith of Elarion** (free) — *Arrow Storm*, *Quickstep*.
- **Seraphina** (Crown Pack) — *Chain Lightning*, *Blizzard*.
- **Nerion of Sael** (Crown Pack) — *Undertow*, *Spring Tide*.
- **Ser Garrick Vane** (Crown Pack) — *Breaking Blow*, *Close Ranks*.
- **Maerwyn the Grey** (Crown Pack) — *Sanctuary*, *Word of Ending*.

## Monetisation

One product at $4.99 and nothing else. No second currency, no energy timer, no
loot box, no ads inside a battle. The free campaign is 45 forts across three
regions — a complete game with a real ending. The Crown Pack is four more
regions plus the defenders and commanders raised there, sold to
people who finished and want more, which is the version of this business model
players do not resent.

The pack deliberately includes the ad removal, so the honest pitch is "pay once
and the game stops asking you for anything".
