# Painted art with Gemini

You generate the images, the game picks them up. No code changes, no rebuild
of the art system — drop files in `art-in/`, run one command, done.

```bash
# 1. generate images with Gemini (prompts below)
# 2. save them into art-in/ named after the texture key, e.g. unit.orc.full.png
npm run art:import
npm run dev        # painted art is now in the game
```

The importer knocks out the background, trims the margins so the character's
feet land exactly where the game anchors them, and writes the manifest.

## The two rules that matter

**1. Generate on a flat chroma background, not "transparent".** Image models
say yes to "transparent background" and then hand you white or a checkerboard
pattern baked into the pixels. Ask for a solid colour instead and let the
importer key it out. Use `#00FF6A` (a green nothing in this game is coloured)
for everything except the green goblins and orcs — for those use `#FF00E5`
magenta.

**2. Every character faces RIGHT, full body, feet at the bottom.** The game
flips enemies horizontally itself. A character facing left will attack
backwards.

**3. One character per image, whole figure inside the frame.** Models like to
answer "a character" with a sheet of three poses. The importer copes - it
splits on the gaps and takes the widest figure - but you get a cleaner result
asking for one. Add *"a single character, one figure only, centred, whole
figure and weapon inside the frame with a small margin"* and, if it still
returns a sheet, just let the importer handle it.

**4. Keep the weapon roughly within the figure's height.** The game scales a
sprite so its full height fits a lane, so a spear standing a head above the
character makes the character himself render smaller than his neighbours.

## The style prompt

Start every prompt with this block. Generate **one** character first, get it
looking how you want, then attach that image as a style reference for all the
others — Gemini holds style well when it can see an example.

> Mobile game character art in the style of Clash Royale and Plants vs
> Zombies: bold clean shapes, thick dark outline, saturated colours, soft
> painted shading with a single light source from the upper left, subtle rim
> light, exaggerated cartoon proportions - noticeably large head, big hands,
> short sturdy legs. A single character, one figure only. Full body, side view
> in three-quarter turn, facing right, standing in an idle combat pose. Flat
> solid #00FF6A background, no shadow on the ground, no text, no border, no
> frame. Centred, whole figure and weapon inside the frame with a small margin.

Then add the character line from the table, then:

> Square image, high detail, clean edges.

## What to generate

Start with the six that carry the game — the first levels only show these. Do
the rest later; anything you have not painted keeps its vector art, and the two
styles can coexist while you work through the list.

### Priority 1 — the first hour of play

| Save as | Character prompt |
| --- | --- |
| `unit.militia.full.png` | A young human militia soldier, worn leather jerkin over a plain tunic, a simple round steel helmet, holding a wooden spear upright in his right hand. Brave but out of his depth. |
| `unit.archer.full.png` | A human archer in a green hooded cloak and leather bracers, longbow held ready at her side, quiver on her back, sharp focused expression. |
| `unit.guardian.full.png` | A heavily armoured human knight in blue-trimmed steel plate, a large kite shield raised on his left arm and a short sword in his right, visored helmet. Immovable. |
| `unit.goblin.full.png` | A small scrawny green goblin, long pointed ears, yellow eyes, sharp teeth in a nasty grin, ragged brown loincloth, clutching a rusty dagger. Use a **#FF00E5 magenta** background. |
| `unit.goblin_runner.full.png` | A lean bright-green goblin sprinting forward, huge floppy ears swept back, wild eyes, tattered orange rags, small wooden club. Reads as fast. Use a **#FF00E5 magenta** background. |
| `unit.orc.full.png` | A huge muscular dark-green orc brute, tusks jutting from a heavy jaw, angry brow, bare chest with leather straps, gripping a massive spiked wooden club. Use a **#FF00E5 magenta** background. |

### Priority 2 — the rest of the defenders

| Save as | Character prompt |
| --- | --- |
| `unit.arbalest.full.png` | A human crossbowman in a purple padded coat and steel cap, heavy crossbow held across his chest, calm and professional. |
| `unit.cleric.full.png` | A human cleric in cream and gold robes with a hood, holding a golden staff topped with a glowing warm light, serene expression, faint golden glow around her. |
| `unit.frostmage.full.png` | A human frost mage in deep blue robes and a tall pointed wizard hat, white hair, holding a staff topped with a glowing pale-blue ice crystal, cold mist at his feet. |
| `unit.monk.full.png` | A broad-shouldered warrior monk in orange robes with a bare muscular arm, shaved head and a dark beard, holding a heavy iron war hammer. |
| `unit.pyromancer.full.png` | A human fire mage in deep red robes and a pointed hat, holding a staff crowned with an orange flame, embers drifting around him. |
| `unit.paladin.full.png` | A noble paladin in gleaming white and gold plate armour with a red cape, winged helmet with a gold plume, holding a huge two-handed sword point-down. Heroic. |

### Priority 3 — the rest of the horde

Use the **#FF00E5 magenta** background for anything green.

| Save as | Character prompt |
| --- | --- |
| `unit.goblin_bomber.full.png` | A goblin with a soot-blackened face and singed rags, wide manic grin, holding a round black bomb with a lit fuse in one hand and a torch in the other. |
| `unit.hobgoblin.full.png` | A larger orange-skinned hobgoblin soldier in scavenged mismatched armour and a dented helmet, short sword and a small round buckler, disciplined and mean. |
| `unit.imp.full.png` | A small red demon imp with little bat wings, curved black horns, glowing yellow eyes and a forked tail, cupping a ball of fire in its claws. Mischievous. |
| `unit.shaman.full.png` | A hunched green goblin shaman in a purple hooded robe hung with bones and feathers, glowing violet eyes, holding a crooked staff crowned with a purple orb. |
| `unit.orc_berserker.full.png` | A brown-skinned orc berserker mid-roar, wild black hair, scarred bare chest, swinging a huge double-headed axe. Reckless fury. |
| `unit.orc_warlord.full.png` | A massive armoured orc warlord in blackened plate with gold trim and a dark red cape, tusked helmet with small horns, two-handed greatsword. Commanding. |
| `unit.shadow_fiend.full.png` | A lean pitch-black demon hound-man, glowing orange eyes and mouth, wisps of dark smoke trailing from its limbs, crouched low and ready to leap. |
| `unit.troll.full.png` | An enormous hunched mossy-green troll with a huge belly, tiny eyes, jutting tusks and warty grey skin, dragging a tree-trunk club. Slow and immense. |
| `unit.wraith.full.png` | A floating hooded wraith in tattered dark purple robes, no face inside the hood except two glowing violet eyes, skeletal hands holding a scythe. |
| `unit.demon_knight.full.png` | A towering demon knight in blackened spiked armour with glowing red seams, curved horns rising from the helmet, tattered crimson cape, enormous greatsword. |
| `unit.demon_king.full.png` | THE final boss. A colossal demon king: crimson skin, a crown of huge black horns, burning golden eyes, black and gold armour, vast bat wings spread wide, a black greatsword wreathed in fire. Terrifying and regal. Fill the frame. |

### Heroes

| Save as | Character prompt |
| --- | --- |
| `unit.aldric.full.png` | A veteran human knight commander in polished steel plate with blue and gold trim, blue cape, winged helmet with a gold plume, sword raised and shield forward. Noble and weathered. |
| `unit.seraphina.full.png` | A storm sorceress in deep violet and silver robes, white hair streaming, glowing cyan eyes, large white feathered wings, holding a staff crowned with crackling blue lightning. |

### Buildings

These sit on the ground, so add: *"viewed from a low three-quarter angle,
sitting on flat ground, whole structure visible"*.

| Save as | Prompt |
| --- | --- |
| `build.tithe.png` | A small stone shrine with two carved pillars and a wooden roof, a golden coin offering bowl glowing warmly on its altar. |
| `build.barricade.png` | A defensive barricade of thick wooden stakes bound with iron bands, sharpened points at the top, weathered and battle-scarred. |
| `build.ballista.png` | A wooden siege ballista on a stone platform, a large iron-tipped bolt loaded, ropes and gears visible. |
| `build.bombard.png` | A squat black iron cannon on a heavy wooden carriage with iron-rimmed wheels, barrel angled up to the right, smoke curling from the muzzle. |
| `build.brazier.png` | A tall stone brazier on a carved pedestal, pale blue magical flame burning in its bowl, frost creeping down the stone. |

### Backdrops (optional, biggest visual win per image)

Landscape, **1920×1080 or wider**, no transparency needed — the importer leaves
`bg.*` files alone. Add: *"wide landscape game background, no characters, no
UI, no text, painted mobile game art"*.

| Save as | Prompt |
| --- | --- |
| `bg.fields.png` | Rolling green farmland at golden hour, broken fences, distant blue hills, warm sunlight, a few scattered trees. Peaceful land about to be overrun. |
| `bg.woods.png` | A burnt forest of black leafless trees under a bruised purple sky, grey ash drifting, cold and dead. |
| `bg.abyss.png` | Cracked volcanic rock glowing with orange lava veins under a blood-red sky, jagged obsidian spires, embers rising. |
| `bg.throne.png` | The black basalt floor of a demon throne room, towering pillars, glowing red runes, deep shadow and hellfire light. |

## Animation frames (the route we are testing now)

A parts sheet has to be reassembled by code, and code has to guess where the
joints are inside each piece. That guessing is what made the first previews
look wrong. Drawn frames need no guessing at all: the game just plays them.

**The frames only work if they are registered.** Same canvas, same character
size, feet on one common line, no shift left or right. If a frame is drawn
slightly larger or higher than its neighbours the unit jitters as it plays,
and no amount of code fixes that afterwards. Say it explicitly, and check it
before generating the rest.

Five frames carry a whole unit. Everything else the rig already fakes well:

| Frame | What it shows |
| --- | --- |
| 1 idle | Standing, weight settled, weapon ready |
| 2 walk A | Mid-stride, near leg forward, opposite arm forward |
| 3 walk B | The opposite stride, near leg back |
| 4 attack | The strike itself, at full extension |
| 5 death | Falling backwards, off balance, weapon dropping |

### The prompt

Attach the unit's finished single-figure art as a reference image, then:

> Using the attached character exactly as drawn - same colours, same armour,
> same face, same weapon, same proportions - draw a 5-frame animation strip of
> that same character.
>
> Layout: one horizontal row, five equal square cells, left to right, no gaps,
> no dividing lines, no numbers, no text. The character is the same size in
> every cell and stands on the same ground line in every cell, feet at the same
> height, body centred in its cell. Facing right in all five.
>
> Frame 1: standing idle, weight settled, weapon held ready.
> Frame 2: walking, near leg forward mid-stride, opposite arm forward.
> Frame 3: walking, the opposite stride, near leg back.
> Frame 4: attacking, the strike at full extension.
> Frame 5: dying, falling backwards off balance, weapon dropping.
>
> Flat solid #00FF6A background across the whole strip. No shadows on the
> ground, no border, no frame, no text.

Use magenta `#FF00E5` instead for any green character, exactly as for the
single figures.

### Checking a strip before generating 24 more

Open it and look for these, in order - each one is fatal and none is fixable
in code:

1. Are all five the same character? Watch the helmet, the belt, the weapon.
2. Are the feet on one line? Lay a ruler along the bottom of the boots.
3. Is the character the same size in each cell?
4. Is every cell the same width, with the character centred in it?

If the strip passes, name it `art-in/unit.<id>.frames.png` and say so - the
importer for these is not written yet, deliberately, because it should be
built against a real strip rather than a guess about one.

## On proportions

Image models default to realistic human proportions. At gameplay size a
character is about 135px tall on a phone, and a realistic head becomes a dot.
Push for a **large head and big hands** in every prompt - it is the single
change that most improves how the cast reads in play, and it is what makes
Clash Royale and Plants vs Zombies legible at thumbnail size.

## Getting a consistent set

1. Generate `unit.militia.full.png` and iterate until you like it. That image
   is your style anchor.
2. For every other character, attach the anchor and prompt with
   *"Match the art style, colour treatment, outline weight and proportions of
   the attached reference image exactly."* plus the character line.
3. Keep the same aspect and framing across a group — all the humans roughly the
   same height in frame, the troll and Demon King noticeably taller.

## Checking your work

```bash
npm run art:import
npm run dev
```

Open `/preview.html` to see the whole cast side by side — mismatched style
shows up immediately there. The importer prints the trimmed size of each file;
if a character comes out much shorter or wider than the others, its framing was
off and the game will scale it oddly.

If a background did not key out cleanly, the character will have a coloured
halo. Regenerate with a flatter, more saturated chroma background rather than
fighting it in the importer.

## What painted art changes in the game

A painted `unit.<id>.full.png` replaces the whole generated puppet for that
character. The game animates it as one piece — bob, lean, squash and a lunge on
attack — instead of swinging individual limbs. That reads well at phone size
and means you never have to produce separate body parts.

Mixing is fine: painted units and vector units fight side by side, so you can
work through the list at your own pace.
