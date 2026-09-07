# How to test The Last Gate

Two ways in. **On your phone** is the one that matters — it is an Android
game — but the desktop browser is faster for checking a specific screen.

**Live build:** https://castle-defense-game-cd83.netlify.app

On Android, open that in Chrome, turn the phone sideways, and take the
"Install for fullscreen play" offer on the menu. Installed, it runs with no
URL bar and no browser chrome, which is the only way the tap positions and
the layout are really being tested.

---

## 1. The fifteen-minute pass

Do these in order. Each one is a thing that recently changed.

### The continent

1. **DEFEND** opens a continent of **seven regions**, not four: the Broken
   Fields, the Barrow Moors, the Ashen Woods, the Iron Highlands, the
   Drowned Coast, the Fallen March, the Throne. Fifteen forts each — 105.
2. The first three are free. Regions 4–7 read **CROWN PACK**.
3. Your region is ringed gold and says YOU ARE HERE; the rest read LOCKED
   until you reach them.
4. Tap a region: the briefing names its commander, their two spells, and the
   five units the people there muster.

### Each region is its own war

5. **Region 1 — goblins.** Grunts, runners, bombers, hobgoblins, thieves,
   wolf riders, and Snagrat the Goblin King at fort 15. Nothing else. This is
   the balance baseline.
6. **Region 2 — the undead**, held by the dwarves of Kar Duhrn. Skeletons,
   shamblers, ghouls, ravens, a vampire, a bone golem, a lich, and Malgrith
   the Necromancer.
7. **Region 3 — orcs**, held by the elves of Elarion, ending at Warlord
   Gorzak.
8. **Region 4 — beasts** in the Iron Highlands. **Region 5 — the drowned
   host** on the coast. **Region 6 — the Fallen**, our own turned knights.
   **Region 7 — demons**, which you do not see anywhere before the Throne.
9. A fort should **never** field something from another region's family. If a
   skeleton turns up in the Broken Fields, that is a bug.

### The rule each horde fights by

10. **Undead rise.** Kill a skeleton with an ordinary blade and it gets back
    up once, at half health. Kill it with **holy or fire** and it stays down
    — and so does anything that dies in a lane holding a **Runesmith** or
    **Gravewarden** (consecrated ground).
11. **Orcs rage.** A wounded orc hits harder — up to half again at death's
    door. Wounding without killing makes it worse.
12. **Beasts run in packs.** One dire wolf is slow; four together are visibly
    faster. Net or root them and the pack bonus stops mattering.
13. **The Fallen carry shields.** Ordinary blows mostly hit the shield — a
    100-damage hit put only 13 into a fallen knight's body in testing. A
    **Shieldbreaker** ignores the shield entirely (52 through, shield
    untouched).
14. **Demons step through portals.** One meets your line and comes out behind
    it — unless a **ward** (Reliquary, Lastward) is alive in that lane.
15. **Goblin thieves take gold.** Watch the purse drop when one lands a hit.

### The ground

16. Forts are no longer flat. Look for **rock** (nothing builds on it, but a
    shooter beside it reaches further), **rubble** (nothing builds), **marsh**
    (everything crossing slows), **tall grass** (cover — units in it take
    less), an **old shrine** (whoever stands on it hits harder) and an **ore
    seam** (a tithe there pays half again).
17. The **Drowned Coast is mostly water**. Only Sael's five float; everything
    else needs dry ground. Every lane keeps at least two dry cells, so you
    can always build something.
18. Tap a card onto rock or water with the wrong unit: it should refuse and
    say **"cannot build on rock"** rather than just failing.
19. The country matches the region — wet moors, rocky highlands, deep grass
    in the woods, broken stone at the Throne — and later forts in a region
    are rougher than its first ones.

### Commanders change how you fight

20. Each region's spell bar is its commander's: Aldric's Smite and Rally,
    Bran's Rockfall and War Horn, **Faelith's Arrow Storm and Quickstep**,
    Seraphina's Chain Lightning and Blizzard, **Nerion's Undertow and Spring
    Tide**, Maerwyn's Sanctuary and Word of Ending.
21. ARMOURY → HERO shows all six. Ones whose region you have not reached read
    NOT YET MET.

### The fight has phases now

22. Between waves the HUD reads **MUSTER — Ns to the assault** and a gold
    **CALL THEM ON +N** button appears at the top right. That is the lull:
    build in it.
23. Every muster pays a lump of gold — a `MUSTER +55` floats up — instead of
    the old invisible trickle. Gold arrives in amounts you can count and plan
    around.
24. Tap **CALL THEM ON** and the wave starts immediately, paying **4 gold per
    second of lull you gave up**. The number on the button counts down as the
    lull runs out, so calling early is worth more than calling late.
25. Clearing a wave ends the assault straight away — you do not wait out the
    clock for the lull to start.
26. Waves marked as big are now **SIEGE** waves: the banner says SIEGE
    ENGINES and the phase line says the engines are ranging on the wall. The
    wall takes damage **with nothing touching it**, roughly every 5 seconds.
27. The engines aim at the lane holding the **fewest defenders**. Stack one
    killing lane and a siege will open one of the others.

### Packing for a fort

The gap between battles is a real part of the game now.

28. Choosing a fort opens **the loadout**, not the battle: the fort's brief,
    your six cards, what is fitted to the wall, and what is in your pack.
29. Tap a card in hand to drop it; tap one from MUSTERED to take it. Six is
    the limit and two is the floor.
30. **MARCH OUT** starts the fight with exactly what is on that screen.
31. Winning pays **salvage** as well as gold — the result screen says how much.
    Salvage comes from what you killed, how many stars, and a bonus the first
    time a fort is held.
32. **ARMOURY → WORKSHOP** (or the button on the loadout) spends it.
    FORT EQUIPMENT is bought once and fitted three at a time; STOCK is made a
    piece at a time and burned inside one battle.
33. Fit **Reinforced Gates** and every lane's bar starts visibly longer. Fit
    **Deep Cellars** and you start the battle richer.
34. Fit **Signal Horn** and the CALL THEM ON bounty goes up by half.
35. Fit **Boiling Oil** and anything hacking at a gate section takes fire back
    every time it swings.
36. Fit **Watchfires** and the whole horde walks in slower.
37. **Keep Garrison** is Crown Pack: the garrison inside the keep cuts down
    what comes through a breach 60% faster.
38. Carrying stock puts a hammer button in the battle HUD with a count on it.
    Tap it and choose: **Barrel of Oil** burns the fullest lane, **Field
    Repair Kit** rebuilds a fallen section for free, **Warhorn Draught**
    speeds every defender for 10 seconds.
39. A repair kit with nothing to rebuild is refused rather than wasted.

### The wall can break

40. In a battle, let one lane's gate section fall. That lane's bar empties,
    the section is gone, and enemies walk **into the keep**.
41. Defenders inside the keep still shoot them, and the keep's own garrison
    fires as well — a breach is survivable, not instant death.
42. The **Keep Heart** bar (top centre) only drops once something is inside
    hitting it. Lose the heart and the run ends.
43. **REPAIR** rebuilds a fallen section for 75 gold at 60% health. Costly
    on purpose: it should hurt to rebuild mid-fight.
44. Finishing with any section breached caps you at **one star**, even on a
    clean-looking win.

### Sorties

The gate opens both ways now.

45. Tap **SORTIE** (next to SELL in the tray), then tap one of your placed
    units. It shouts SORTIE! and marches out of the wall, up its own lane.
46. Out there it stops to fight whatever it meets, exactly as it does on the
    wall — it is not invulnerable and nothing is supporting it.
47. Its cell stays reserved. Tap SORTIE and then that same empty square to
    call it back: it walks home and holds the line again.
48. Buildings refuse — a barricade or a ballista cannot walk.
49. Kills made far out in the field pay **half again**, and the float reads
    `+N salvage`. That is the whole argument for opening the gate: a body that
    dies out there never reaches the wall, and it pays better.
50. The risk is real — a lane with its defender out is a lane with nothing in
    it. Send someone out during a siege and see what the engines do to that
    lane.

### The cutthroat

51. The **Cutthroat** does not walk to the heart. Once it is through, it
    turns into a *neighbouring lane* and attacks your defenders from
    behind, where they cannot answer. Kill it or lose the lane.

### Damage types

52. Tap and **hold** any card in the tray (about half a second) for its
    entry. Damage is typed: physical, fire, frost, holy.
53. Holy vs undead is 1.7×; frost vs demons 1.4×; fire vs demons 0.6×. The
    hit flash tells you which way it went — gold for strong, grey for weak.
54. Only a few units crit, and they do it on a **counted** swing, not a
    dice roll: the Paladin's smite lands on every third swing, always. Watch
    it three times and it should be exactly regular.

### The War Ledger

55. Menu → **WAR LEDGER**. Three tabs: OUR FORCES, THE HORDE, WHAT BEATS
    WHAT. Every unit and enemy with real numbers, and the type table in
    full. Nothing in there should say "???" or be blank.

---

## 2. Test URLs

These work on the live build and in `npm run dev`. They are compiled out of
shipping builds.

| URL | What it does |
| --- | --- |
| `?unlock=1` | Crown Pack, every level, 250k gold |
| `?reach=2` | Stop the campaign at region 2 (the Barrow Moors) — the fastest way to see another horde, commander and muster |
| `?reach=5` / `?reach=7` | Same for the Drowned Coast and the Throne |
| `?scene=Battle&level=c2l4` | Straight into a fort |
| `?scene=Continent` | Straight to the continent |
| `?nomodal=1` | Skip the pre-battle briefing |
| `?touchdebug=1` | Draw where the game thinks your finger is |
| `/preview.html` | Every character, part by part |

Combine them: `?reach=2&scene=Battle&level=c2l1&nomodal=1` drops you into
the Ashen Woods with Bran commanding.

To wipe a phone back to a fresh save: Chrome → site settings → clear data,
or Settings inside the game → RESET.

---

## 3. Automated checks

```bash
npm test          # 86 unit tests: progression, combat maths, art, layout
npm run hittest   # every button responds across its own footprint, and the
                  # menu -> continent -> region -> forts route works
npm run breachtest# drives a real battle: breach, repair, keep garrison, stars
npm run damagetest# damage-type table and the counted crit, in the live game
npm run siegetest # muster pay, calling the assault on early, siege bombardment
npm run sortietest# a unit marches out, fights, comes home, and salvage pays more
npm run workshoptest # equipment bought between battles changes the next one
npm run familytest# the dead rise, orcs rage, packs run, shields hold, portals open
npm run smoke     # boots a battle in Chromium and asserts it plays
npm run touchtest # taps land where fingers are, on three phone sizes
npm run pwacheck  # Chrome on Android will offer to install it
```

The browser-driven checks need a server up:

```bash
npm run dev -- --port 5199
```

They drive a real browser, so they are slow on a machine with no GPU — a
few minutes each is normal, and a failure is a real failure, not a timeout.

---

## 4. What to report

The useful bug report here is: **which screen, what you tapped, what you
expected, what happened** — plus a screenshot if anything is drawn in the
wrong place. Tap positions and layout are the two things that have broken
before and will break again.
