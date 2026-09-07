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

1. **DEFEND** from the menu now opens the continent, not a level list.
2. Four regions sit on drawn land: The Broken Fields, The Ashen Woods, The
   Gates of the Abyss, Throne of the Demon King. Only the first is open;
   the last is marked CROWN PACK.
3. The region you are up to is ringed in gold and says YOU ARE HERE.
4. Tap your region. The briefing names the commander, their two spells and
   the units mustered there. **RIDE OUT** opens that region's forts.
5. Tap a locked region: it should tell you to hold the one before it. Tap
   the Crown Pack region: it should offer the pack.

### Commanders change how you fight

6. In the Broken Fields the spell bar is Sir Aldric's: **Holy Smite** and
   **Rally**.
7. Reach the Ashen Woods and the bar is Bran Ironbark's instead:
   **Rockfall** (a lane, with a slow) and **War Horn**. Same fort, different
   game. Use `?reach=2` (below) rather than playing ten forts to see it.
8. ARMOURY → HERO shows all four commanders. Ones whose region you have not
   reached read NOT YET MET; premium ones read CROWN PACK.

### Regions hand you units

9. Arriving in the Ashen Woods should immediately put **Frostmage**,
   **Bombard** and **Arbalest** in the armoury, without a level unlock.
10. The Abyss adds Cleric, Monk and Ballista. The Throne adds the Paladin.

### The fight has phases now

11. Between waves the HUD reads **MUSTER — Ns to the assault** and a gold
    **CALL THEM ON +N** button appears at the top right. That is the lull:
    build in it.
12. Every muster pays a lump of gold — a `MUSTER +55` floats up — instead of
    the old invisible trickle. Gold arrives in amounts you can count and plan
    around.
13. Tap **CALL THEM ON** and the wave starts immediately, paying **4 gold per
    second of lull you gave up**. The number on the button counts down as the
    lull runs out, so calling early is worth more than calling late.
14. Clearing a wave ends the assault straight away — you do not wait out the
    clock for the lull to start.
15. Waves marked as big are now **SIEGE** waves: the banner says SIEGE
    ENGINES and the phase line says the engines are ranging on the wall. The
    wall takes damage **with nothing touching it**, roughly every 5 seconds.
16. The engines aim at the lane holding the **fewest defenders**. Stack one
    killing lane and a siege will open one of the others.

### The wall can break

17. In a battle, let one lane's gate section fall. That lane's bar empties,
    the section is gone, and enemies walk **into the keep**.
18. Defenders inside the keep still shoot them, and the keep's own garrison
    fires as well — a breach is survivable, not instant death.
19. The **Keep Heart** bar (top centre) only drops once something is inside
    hitting it. Lose the heart and the run ends.
20. **REPAIR** rebuilds a fallen section for 75 gold at 60% health. Costly
    on purpose: it should hurt to rebuild mid-fight.
21. Finishing with any section breached caps you at **one star**, even on a
    clean-looking win.

### The cutthroat

22. The **Cutthroat** does not walk to the heart. Once it is through, it
    turns into a *neighbouring lane* and attacks your defenders from
    behind, where they cannot answer. Kill it or lose the lane.

### Damage types

23. Tap and **hold** any card in the tray (about half a second) for its
    entry. Damage is typed: physical, fire, frost, holy.
24. Holy vs undead is 1.7×; frost vs demons 1.4×; fire vs demons 0.6×. The
    hit flash tells you which way it went — gold for strong, grey for weak.
25. Only a few units crit, and they do it on a **counted** swing, not a
    dice roll: the Paladin's smite lands on every third swing, always. Watch
    it three times and it should be exactly regular.

### The War Ledger

26. Menu → **WAR LEDGER**. Three tabs: OUR FORCES, THE HORDE, WHAT BEATS
    WHAT. Every unit and enemy with real numbers, and the type table in
    full. Nothing in there should say "???" or be blank.

---

## 2. Test URLs

These work on the live build and in `npm run dev`. They are compiled out of
shipping builds.

| URL | What it does |
| --- | --- |
| `?unlock=1` | Crown Pack, every level, 250k gold |
| `?reach=2` | Stop the campaign at region 2 — the fastest way to see a different commander and muster |
| `?reach=3` / `?reach=4` | Same for the Abyss and the Throne |
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
npm run smoke     # boots a battle in Chromium and asserts it plays
npm run touchtest # taps land where fingers are, on three phone sizes
npm run pwacheck  # Chrome on Android will offer to install it
```

`hittest`, `breachtest`, `damagetest`, `siegetest`, `smoke` and `touchtest`
need a server up:

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
