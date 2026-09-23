/**
 * Asset registry.
 *
 * Every texture in the game is declared here as a vector document, rasterised
 * once into a Phaser texture.
 *
 * WHAT THE BOOT PAYS FOR
 * ----------------------
 * Only what the first screen shows. A unit the art pack has drawn poses for
 * never assembles a puppet, so neither its parts nor its poses are touched at
 * boot: `ensureUnitArt` streams the poses behind the menu and each fort waits
 * on its own cast before it starts. Skipping that work took the boot from 41
 * seconds and 46 MB to about 2 and 10.
 *
 * PAINTED ART SLOT-IN
 * -------------------
 * If `public/assets/painted/manifest.json` exists it is read first. Any key it
 * lists is loaded from a PNG instead of being drawn, e.g.
 *
 *   { "unit.orc.head": "orc_head.png", "bg.fields": "fields_2048.png" }
 *
 * so an illustrator can replace the vector art unit by unit, with no code
 * change. See docs/ART_BIBLE.md for sizes and pivots.
 */
import type Phaser from 'phaser';
import { Svg } from './Svg';
import { ALL_CHARACTER_ART } from './cast';
import { characterArt } from './compose';
import * as structures from './structures';
import * as scenery from './scenery';
import * as props from './props';
import * as tiles from './tiles';
import { spellIcon, spellIconKey } from './spells';
import { ALL_SPELLS } from '../data/heroes';

/** Characters and props are drawn at 2x their in-game size for crispness. */
export const SUPERSAMPLE = 2;

export interface TextureSpec {
  key: string;
  svg: Svg;
  /** Rasterisation multiplier; 1 for art already authored at final size. */
  scale: number;
}

// The query is intentional. Painted files are stable public URLs rather than
// Vite-hashed imports, so a version here guarantees that a deployed art pass
// cannot be hidden behind an older service-worker entry.
export const PAINTED_MANIFEST_URL = 'assets/painted/manifest.json?v=regional-environment-6';

function specs(drawn: ReadonlySet<string> = new Set()): TextureSpec[] {
  const out: TextureSpec[] = [];
  const add = (key: string, svg: Svg, scale = SUPERSAMPLE): void => {
    out.push({ key, svg, scale });
  };

  for (const spec of Object.values(ALL_CHARACTER_ART)) {
    /*
     * A unit whose poses were drawn never assembles a puppet: Rig returns as
     * soon as it finds the strip, and portraitForArt prefers it too. Building
     * its parts anyway cost the boot twice over - the geometry and the SVG
     * here, and the painted part file over the network below - for textures
     * nothing ever draws. Ninety-nine of the cast are in that state.
     */
    if (drawn.has(spec.id)) continue;
    const art = characterArt(spec);
    for (const part of art.parts) add(`unit.${spec.id}.${part.name}`, part.svg);
  }

  add('build.tithe', structures.tithe().svg);
  add('build.barricade', structures.barricade().svg);
  add('build.ballista', structures.ballista().svg);
  add('build.bombard', structures.bombard().svg);
  add('build.brazier', structures.brazier().svg);

  /*
   * Ground features, at twice their drawn size: they are soft-edged and
   * textured now rather than flat shapes with outlines, and at 1:1 the
   * texture smeared on a phone screen. Water and marsh also get the pieces
   * a lane-long run is built from, so a flooded lane is one body of water.
   */
  for (const id of ['water', 'marsh', 'highground', 'rubble', 'tallgrass', 'shrine', 'seam'] as tiles.GroundArtId[]) {
    add(`tile.${id}`, tiles.groundTile(id), SUPERSAMPLE);
  }
  for (const ground of tiles.STRIP_GROUNDS) {
    for (const piece of ['left', 'mid', 'right'] as tiles.StripPiece[]) {
      add(tiles.stripKey(ground, piece), tiles.stripTile(ground, piece), SUPERSAMPLE);
    }
  }

  for (const id of [
    'arrow',
    'bolt',
    'fireball',
    'frostbolt',
    'holybolt',
    'shadowbolt',
    'rock',
    'cannonball',
    'bomb',
    'spear_throw',
  ] as props.ProjectileId[]) {
    add(`shot.${id}`, props.projectile(id));
  }
  for (const id of [
    'spark',
    'smoke',
    'ember',
    'slash',
    'shockwave',
    'holy_ring',
    'frost_ring',
    'blood',
    'glow',
    'vignette',
    'sunwash',
  ] as props.FxId[]) {
    add(`fx.${id}`, props.effect(id));
  }
  for (const id of [
    'coin',
    'mana',
    'gem',
    'heart',
    'skull',
    'crown',
    'star',
    'star_empty',
    'hammer',
    'shield',
    'sword',
  ] as props.PickupId[]) {
    add(`icon.${id}`, props.pickup(id));
  }

  /*
   * A sigil per spell. Drawn rather than borrowed: every spell used to point
   * its icon at one of the generic battle effects, so five of them shared a
   * picture of a shockwave.
   */
  for (const s of ALL_SPELLS) add(spellIconKey(s.id), spellIcon(s.motif, s.tone));

  add('ui.card', props.cardFrame(150, 200), SUPERSAMPLE);
  add('ui.panel', props.panel(560, 360), 1);
  add('ui.panel.small', props.panel(340, 200), 1);
  add('ui.button.green', props.button(320, 96, '#4fae6a'), 1);
  add('ui.button.gold', props.button(320, 96, '#e0a92c'), 1);
  add('ui.button.red', props.button(320, 96, '#c0392b'), 1);
  add('ui.button.blue', props.button(320, 96, '#3d7fc4'), 1);
  add('ui.button.stone', props.button(320, 96, '#6a6478'), 1);
  add('ui.cell', props.cellHighlight(146, 236), 1);
  add('ui.ring.gold', props.targetRing(120, '#ffd257'), 1);
  add('ui.ring.red', props.targetRing(120, '#ff5a3d'), 1);
  const hb = props.healthBar(80, 14);
  add('ui.hp.back', hb.back, SUPERSAMPLE);
  add('ui.hp.green', hb.fill('#5fd07a'), SUPERSAMPLE);
  add('ui.hp.red', hb.fill('#e8455c'), SUPERSAMPLE);
  add('ui.hp.gold', hb.fill('#f0b429'), SUPERSAMPLE);

  return out;
}

/**
 * Backdrops are soft gradients and silhouettes, so they are rasterised at half
 * resolution and drawn scaled up. That is invisible on screen and cuts texture
 * memory by 4x, which matters a lot on low-end phones.
 */
export const BACKDROP_SCALE = 0.5;

/** Builds one biome backdrop on demand; safe to call repeatedly. */
export async function ensureBiome(
  scene: Phaser.Scene,
  biome: scenery.BiomeId,
  width: number,
  height: number,
  rows: number,
  horizon: number,
): Promise<void> {
  const key = `bg.${biome}`;
  if (scene.textures.exists(key)) return;
  await addTexture(
    scene,
    key,
    scenery.battlefield(scenery.BIOMES[biome], width, height, rows, horizon),
    BACKDROP_SCALE,
  );
}

/**
 * Decodes a vector document into an <img> at `scale` times its authored size.
 *
 * The result is handed to Phaser as an *image* rather than a canvas on
 * purpose: WebGL re-uploads canvas-backed texture sources every frame, which
 * costs more than the whole rest of the game put together. Image sources are
 * uploaded once.
 */
function rasterize(svg: Svg, scale: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('failed to rasterise vector texture'));
    img.src = svg.toDataUri(scale);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${url}`));
    img.src = url;
  });
}

export interface BuildOptions {
  onProgress?: (done: number, total: number) => void;
}

/** Sheets fetched at once. Enough to fill the pipe, few enough to stay ordered. */
const SHEET_BATCH = 12;

/** The manifest's file map, kept after the boot read so art can stream later. */
let painted: Record<string, string> = {};

/** In-flight or finished sheet loads, so a unit is never fetched twice. */
const unitArt = new Map<string, Promise<void>>();

/** Every unit the pack has drawn poses for. */
export function drawnUnitIds(): string[] {
  return [...paintedFrames.keys()];
}

/**
 * Puts one unit's drawn poses in the texture manager.
 *
 * If the sheet cannot be fetched the unit falls back to the assembled puppet -
 * its painted parts if the pack has them, the generated ones otherwise. That
 * is the same fallback the boot used to provide by loading every unit's parts
 * up front; doing it here instead means it costs nothing until it is needed.
 */
async function loadUnitArt(scene: Phaser.Scene, id: string): Promise<void> {
  const strip = paintedFrames.get(id);
  if (!strip) return;
  const key = `unit.${id}.sheet`;
  if (scene.textures.exists(key) || scene.textures.exists(`unit.${id}.frame0`)) return;
  try {
    if (strip.sheet) {
      const img = await loadImage(`assets/painted/${strip.sheet}`);
      if (!scene.textures.exists(key)) {
        scene.textures.addSpriteSheet(key, img, {
          frameWidth: strip.width, frameHeight: strip.height, endFrame: strip.count - 1,
        });
      }
      return;
    }
    // The older packs ship one file per pose rather than a packed sheet.
    const loose = await Promise.all(
      Array.from({ length: strip.count }, (_, i) => painted[`unit.${id}.frame${i}`]).map(
        async (file) => (file ? loadImage(`assets/painted/${file}`) : undefined),
      ),
    );
    if (!loose.some(Boolean)) throw new Error(`no poses for ${id}`);
    loose.forEach((img, i) => {
      const frameKey = `unit.${id}.frame${i}`;
      if (img && !scene.textures.exists(frameKey)) scene.textures.addImage(frameKey, img);
    });
  } catch {
    await repairUnitArt(scene, id);
  }
}

/** Assembles a unit the slow way, for when its sheet did not arrive. */
async function repairUnitArt(scene: Phaser.Scene, id: string): Promise<void> {
  const spec = ALL_CHARACTER_ART[id];
  if (!spec) return;
  for (const part of characterArt(spec).parts) {
    const key = `unit.${id}.${part.name}`;
    if (scene.textures.exists(key)) continue;
    const file = painted[key];
    try {
      scene.textures.addImage(
        key,
        file ? await loadImage(`assets/painted/${file}`) : await rasterize(part.svg, SUPERSAMPLE),
      );
    } catch {
      // Nothing more to try for this part; the rig simply omits it.
    }
  }
}

/**
 * Ensures the drawn poses for these units are loaded, fetching only what is
 * missing. Idempotent and safe to await repeatedly or from several screens at
 * once: a unit already in flight is joined rather than fetched again.
 */
export async function ensureUnitArt(
  scene: Phaser.Scene,
  ids: Iterable<string>,
  opts: BuildOptions = {},
): Promise<void> {
  const wanted = [...new Set(ids)].filter((id) => paintedFrames.has(id));
  let done = 0;
  const total = wanted.length;
  if (!total) return;
  for (let i = 0; i < wanted.length; i += SHEET_BATCH) {
    await Promise.all(
      wanted.slice(i, i + SHEET_BATCH).map(async (id) => {
        let job = unitArt.get(id);
        if (!job) {
          job = loadUnitArt(scene, id);
          unitArt.set(id, job);
        }
        await job;
        done += 1;
        opts.onProgress?.(done, total);
      }),
    );
  }
}

/**
 * Whether a painted file is made redundant by an animation strip that has
 * already loaded, and so should never be fetched.
 *
 * Nothing belonging to a drawn unit is wanted at boot. Its poses - a packed
 * sheet, or the older loose per-frame files - are cast art, which streams
 * behind the menu; and its parts and whole-body sprite are dead either way,
 * because Rig takes the poses and returns before it looks at them.
 */
function supersededByStrip(key: string, drawn: ReadonlySet<string>): boolean {
  const m = /^unit\.(.+)\.[^.]+$/.exec(key);
  return m ? drawn.has(m[1]!) : false;
}

/**
 * Painted art that only a battle draws: the broken rampart, the breach and
 * the cracks for a section of wall, and any ground drawn for one region.
 *
 * None of it is on the way to the menu, and most of it belongs to one region
 * out of seven, so it is left out of the boot and fetched by `ensureRegionPaint`
 * for the fort that is about to be fought.
 */
const BATTLE_PAINT = /^(wall\.breach|wall\.cracks|rampart\.broken)(\.|$)/;

function regionSuffix(key: string): scenery.BiomeId | undefined {
  const tail = key.slice(key.lastIndexOf('.') + 1);
  return Object.prototype.hasOwnProperty.call(scenery.BIOMES, tail) ? (tail as scenery.BiomeId) : undefined;
}

function battleOnly(key: string): boolean {
  return BATTLE_PAINT.test(key) || (key.startsWith('tile.') && regionSuffix(key) !== undefined);
}

/** In-flight or finished loads of battle-only painted files, by key. */
const regionArt = new Map<string, Promise<void>>();

/**
 * Loads the battle-only painted art one region needs: the shared version of
 * each key and that region's own, never another region's. Idempotent, and a
 * missing file simply leaves the key absent so the battle draws its fallback.
 */
export async function ensureRegionPaint(scene: Phaser.Scene, biome: scenery.BiomeId): Promise<void> {
  const wanted = Object.keys(painted).filter((key) => {
    if (!battleOnly(key)) return false;
    const region = regionSuffix(key);
    return region === undefined || region === biome;
  });
  await Promise.all(
    wanted.map((key) => {
      let job = regionArt.get(key);
      if (!job) {
        job = (async () => {
          if (scene.textures.exists(key)) return;
          try {
            const img = await loadImage(`assets/painted/${painted[key]}`);
            if (!scene.textures.exists(key)) scene.textures.addImage(key, img);
          } catch {
            // The battle draws its vector fallback instead.
          }
        })();
        regionArt.set(key, job);
      }
      return job;
    }),
  );
}

/** True when this key's texture came from the painted pack rather than the generator. */
export function isPainted(key: string): boolean {
  return Object.prototype.hasOwnProperty.call(painted, key);
}

/**
 * How a painted parts sheet fits together: where each piece hangs, how big it
 * is, and what it pivots around. Produced by scripts/import-parts.mjs, which
 * synthesises it from the pieces' own proportions - the sheet itself says
 * nothing about assembly.
 *
 * Coordinates are in figure pixels measured up from the feet, so `y` is
 * negative going up and the whole thing scales by `height`.
 */
export interface PaintedRig {
  height: number;
  parts: Record<string, { x: number; y: number; w: number; h: number; pivot: [number, number] }>;
}

/**
 * A drawn animation strip: poses the artist actually drew, already trimmed to
 * a common size and seated on one ground line by scripts/import-frames.mjs.
 * Nothing here is assembled or guessed at - the game just plays what it was
 * given, which is why a unit with frames needs no rig at all.
 */
export interface PaintedFrames {
  count: number;
  width: number;
  height: number;
  names: string[];
  /** Optional packed sheet; frame indices run left-to-right then top-to-bottom. */
  sheet?: string;
  /** Transparent pixels below the shared ground line in each authored cell. */
  groundOffset?: number;
  animations?: Partial<Record<string, { frames: number[]; fps: number }>>;
}

/** Assemblies by unit art id, filled in as the manifest is read. */
const paintedRigs = new Map<string, PaintedRig>();
/** Drawn animation strips by unit art id. */
const paintedFrames = new Map<string, PaintedFrames>();

/** The drawn animation strip for a unit, if a painted pack supplied one. */
export function paintedFrameSet(artId: string): PaintedFrames | undefined {
  return paintedFrames.get(artId);
}

/** The painted assembly for a unit, if a painted parts pack supplied one. */
export function paintedRig(artId: string): PaintedRig | undefined {
  return paintedRigs.get(artId);
}

async function paintedOverrides(): Promise<Record<string, string>> {
  try {
    const res = await fetch(PAINTED_MANIFEST_URL, { cache: 'no-cache' });
    if (!res.ok) return {};
    const json: unknown = await res.json();
    if (typeof json !== 'object' || json === null) return {};

    // The manifest carries two kinds of entry: texture key -> filename, and
    // `unit.<id>.rig` -> an assembly. Only the former are files to fetch.
    const files: Record<string, string> = {};
    for (const [key, value] of Object.entries(json as Record<string, unknown>)) {
      if (key.endsWith('.rig') && typeof value === 'object' && value !== null) {
        paintedRigs.set(key.replace(/^unit\./, '').replace(/\.rig$/, ''), value as PaintedRig);
      } else if (key.endsWith('.frames') && typeof value === 'object' && value !== null) {
        paintedFrames.set(key.replace(/^unit\./, '').replace(/\.frames$/, ''), value as PaintedFrames);
      } else if (typeof value === 'string') {
        files[key] = value;
      }
    }
    return files;
  } catch {
    // No painted pack installed - vector art is the shipping art.
    return {};
  }
}

/**
 * Builds every texture into the scene's texture manager.
 * Resolves once the full atlas is available.
 */
export async function buildTextures(
  scene: Phaser.Scene,
  extra: TextureSpec[] = [],
  opts: BuildOptions = {},
): Promise<void> {
  const overrides = await paintedOverrides();
  painted = overrides;

  /*
   * Who no longer needs a puppet. A unit counts as drawn when the pack has
   * poses for it: a packed sheet, or the older one-file-per-frame set, which
   * Rig accepts just as readily. Their sheets are not fetched here - they are
   * the heaviest thing in the game and nothing on the way to the menu draws a
   * single one - but knowing their names now is what lets this skip the part
   * work they make pointless.
   */
  const sheeted = new Set<string>();
  const drawn = new Set<string>();
  for (const [id, strip] of paintedFrames) {
    if (strip.sheet) sheeted.add(id);
    if (strip.sheet || overrides[`unit.${id}.frame0`]) drawn.add(id);
  }

  const all = [...specs(drawn), ...extra];

  // Painted packs may add keys the generator never produces - a whole-body
  // sprite (`unit.orc.full`) instead of parts, say - so anything in the
  // manifest that is not a generated key is loaded on its own.
  const generated = new Set(all.map((s) => s.key));
  const extraPainted = Object.keys(overrides).filter(
    (key) =>
      !key.startsWith('_') && !generated.has(key) && !supersededByStrip(key, drawn) && !battleOnly(key),
  );

  let done = 0;
  const total = all.length + extraPainted.length;

  const batch = 24;
  for (let i = 0; i < all.length; i += batch) {
    const slice = all.slice(i, i + batch);
    await Promise.all(
      slice.map(async (spec) => {
        if (scene.textures.exists(spec.key)) {
          done += 1;
          return;
        }
        const painted = overrides[spec.key];
        try {
          if (painted) {
            const img = await loadImage(`assets/painted/${painted}`);
            scene.textures.addImage(spec.key, img);
          } else {
            scene.textures.addImage(spec.key, await rasterize(spec.svg, spec.scale));
          }
        } catch {
          // A single bad texture must never take the whole boot down.
          const canvas = document.createElement('canvas');
          canvas.width = 8;
          canvas.height = 8;
          scene.textures.addCanvas(spec.key, canvas);
        }
        done += 1;
        opts.onProgress?.(done, total);
      }),
    );
  }
  await Promise.all(
    extraPainted.map(async (key) => {
      try {
        scene.textures.addImage(key, await loadImage(`assets/painted/${overrides[key]}`));
      } catch {
        // A missing file in the manifest must not stop the game booting.
      }
      done += 1;
      opts.onProgress?.(done, total);
    }),
  );

  opts.onProgress?.(total, total);
}

/** Adds one ad-hoc vector texture (used for menu/map backdrops sized at runtime). */
export async function addTexture(scene: Phaser.Scene, key: string, svg: Svg, scale = 1): Promise<void> {
  if (scene.textures.exists(key)) return;
  scene.textures.addImage(key, await rasterize(svg, scale));
}

export { scenery, structures, props };