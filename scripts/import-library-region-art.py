"""Turn the recovered regional reference boards into runtime game art.

The originals remain in docs/art-reference/region-art. Each 2x2 cyan board is
split, chroma-keyed, tightly cropped and fitted to a grounded 256px texture.
"""
from pathlib import Path
import json, re, shutil
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.art-library'
REFS = ROOT / 'docs/art-reference/region-art'
OUT = ROOT / 'public/assets/painted'

BACKGROUNDS = {
    'barrows': 'Barrow moors at dawn.png',
    'woods': 'Ashen Woods Battlefield.png',
    'highland': 'Iron Highlands: Snowlit Battle Plain.png',
    'coast': 'Rainlit drowned coast.png',
    'abyss': 'Obsidian battlefield beneath a blood-red sky.png',
    'throne': 'Infernal Throne Battlefield.png',
}

# Boards are deliberately grouped by country. Within each group the art IDs
# follow campaign unlock/threat order, making the mapping stable and auditable.
BOARDS = [
 ('Four Dwarven Defenders Sprite Board.png', ['dwarf_warrior','runesmith','gravewarden','bran']),
 ('Castle Defense Sprite Reference Board.png', ['dwarf_cannon','tithe','standing_stone','reliquary']),
 ('Stylized Undead Castle Defense Roster.png', ['skeleton','skeleton_archer','zombie','ghoul']),
 ('Undead Castle Defenders Sprite Board.png', ['grave_raven','vampire','bone_golem','lich']),
 ('Dark fantasy castle-defense sprite lineup.png', ['wraith','necromancer','plague_bat','martyr']),

 ('Four moonlit elf defenders sprite board.png', ['elf_ranger','elf_spellweaver','moonblade','faelith']),
 ('Four-hero castle defense sprite board.png', ['treesinger','hawkkeeper','orc_shaman','wyvern_rider']),
 ('Orc Unit Sprite Board.png', ['orc_axethrower','orc_powderkeg','orc_berserker','orc_ironback']),
 ('Four-panel castle defense sprite roster.png', ['orc','troll','orc_warlord','gatebreaker']),

 ('Four Fantasy Defenders on Cyan.png', ['warden','netcaster','houndmaster','seraphina']),
 ('Four-beast castle defense sprite board.png', ['dire_wolf','boar','harpy','giant_spider']),
 ('Castle defense beast lineup.png', ['cave_bear','beastlord','thornback','packmother']),
 ('Four-Unit Castle Defense Sprite Board.png', ['spitting_lizard','plague_bat','ballista','standing_stone']),

 ('Four Sea Defenders Sprite Reference Board.png', ['harpooner','tidecaller','deepwatch','nerion']),
 ('Oceanic Castle Defense Sprite Board.png', ['drowned_sailor','reef_crawler','siren','tide_raider']),
 ('Four Sea Monsters Sprite Reference Board.png', ['deep_serpent','tide_witch','barnacle_hulk','abyss_wisp']),
 ('Stylized coastal defense sprite board.png', ['kelp_thrall','coral_ward','raftwright','deepwatch']),

 ('Castle defenders in a cyan sprite board.png', ['templar','pavise','shieldbreaker','garrick']),
 ('Four stylized castle-defense character sprites.png', ['confessor','fallen_crossbow','fallen_knight','black_guard']),
 ('Four Fierce Castle Defense Sprites.png', ['cultist','inquisitor','betrayer','sworn_lance']),
 ('Four-Character Castle Defense Sprite Board.png', ['spearwall','watchman','bell_chanter','black_hawk']),

 ('Four castle defense hero sprites.png', ['warleader','kingsguard','maerwyn','lastward']),
 ('Four Demonic Defenders on Cyan.png', ['hellhound','portal_fiend','succubus','balor']),
 ('Four Demon Boss Sprite Showcase.png', ['demon_prince','hell_bombardier','brimstone_ogre','soul_harvester']),
]

def safe_name(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-') + '.png'

def chroma(im):
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r,g,b,a = px[x,y]
            # Generated boards use bright cyan/teal. Feather near-edge pixels.
            score = min(g, b) - r
            if g > 125 and b > 125 and score > 45:
                alpha = max(0, min(255, int((105 - score) * 4.25)))
                px[x,y] = (r,g,b,min(a,alpha))
    return im

def extract(board, index):
    im = Image.open(board).convert('RGBA')
    w,h = im.size
    col,row = index % 2,index // 2
    cell = im.crop((col*w//2,row*h//2,(col+1)*w//2,(row+1)*h//2))
    # A few oversized weapons cross the mathematical centre line. Insets
    # prevent a sliver of the neighbouring character entering this sprite.
    mx,my = round(cell.width*0.035),round(cell.height*0.025)
    cell = cell.crop((mx,my,cell.width-mx,cell.height-my))
    cell = chroma(cell)
    box = cell.getchannel('A').getbbox()
    if box: cell = cell.crop(box)
    canvas = Image.new('RGBA',(256,256))
    scale = min(226/max(1,cell.width),238/max(1,cell.height))
    cell = cell.resize((max(1,round(cell.width*scale)),max(1,round(cell.height*scale))),Image.Resampling.LANCZOS)
    canvas.alpha_composite(cell,((256-cell.width)//2,248-cell.height))
    return canvas

REFS.mkdir(parents=True,exist_ok=True); OUT.mkdir(parents=True,exist_ok=True)
manifest_path = OUT/'manifest.json'
manifest = json.loads(manifest_path.read_text())

for source in list(BACKGROUNDS.values()) + [b for b,_ in BOARDS]:
    shutil.copy2(SOURCE/source, REFS/safe_name(source.removesuffix('.png')))

for biome, source in BACKGROUNDS.items():
    im = Image.open(SOURCE/source).convert('RGB')
    im.thumbnail((1536,1536),Image.Resampling.LANCZOS)
    filename=f'bg.{biome}.region.webp'
    im.save(OUT/filename,'WEBP',quality=88,method=6)
    manifest[f'bg.{biome}']=filename

for board, ids in BOARDS:
    for i, art_id in enumerate(ids):
        filename=f'unit.{art_id}.region.png'
        extract(SOURCE/board,i).save(OUT/filename,optimize=True)
        # Do not replace a hand-authored animated Region 1 sheet.
        if not manifest.get(f'unit.{art_id}.frames'):
            manifest[f'unit.{art_id}.full']=filename

manifest['_region_art'] = 'Recovered source boards are preserved in docs/art-reference/region-art.'
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
print(f'Imported {len(BACKGROUNDS)} backgrounds and {sum(len(x[1]) for x in BOARDS)} figure slots.')
