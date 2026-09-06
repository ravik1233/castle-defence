/**
 * Asset registry.
 *
 * Every texture in the game is declared here as a vector document, rasterised
 * once at boot into a Phaser texture. Nothing is fetched over the network, so
 * the game boots instantly and works offline.
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

/** Characters and props are drawn at 2x their in-game size for crispness. */
export const SUPERSAMPLE = 2;

export interface TextureSpec {
  key: string;
  svg: Svg;
  /** Rasterisation multiplier; 1 for art already authored at final size. */
  scale: number;
}

export const PAINTED_MANIFEST_URL = 'assets/painted/manifest.json';

function specs(): TextureSpec[] {
  const out: TextureSpec[] = [];
  const add = (key: string, svg: Svg, scale = SUPERSAMPLE): void => {
    out.push({ key, svg, scale });
  };

  for (const spec of Object.values(ALL_CHARACTER_ART)) {
    const art = characterArt(spec);
    for (const part of art.parts) add(`unit.${spec.id}.${part.name}`, part.svg);
  }

  add('build.tithe', structures.tithe().svg);
  add('build.barricade', structures.barricade().svg);
  add('build.ballista', structures.ballista().svg);
  add('build.bombard', structures.bombard().svg);
  add('build.brazier', structures.brazier().svg);

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
  for (const id of ['coin', 'mana', 'gem', 'heart', 'skull', 'crown', 'star', 'star_empty'] as props.PickupId[]) {
    add(`icon.${id}`, props.pickup(id));
  }

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

async function paintedOverrides(): Promise<Record<string, string>> {
  try {
    const res = await fetch(PAINTED_MANIFEST_URL, { cache: 'no-cache' });
    if (!res.ok) return {};
    const json: unknown = await res.json();
    return typeof json === 'object' && json !== null ? (json as Record<string, string>) : {};
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
  const all = [...specs(), ...extra];
  const overrides = await paintedOverrides();

  // Painted packs may add keys the generator never produces - a whole-body
  // sprite (`unit.orc.full`) instead of parts, say - so anything in the
  // manifest that is not a generated key is loaded on its own.
  const generated = new Set(all.map((s) => s.key));
  const extraPainted = Object.keys(overrides).filter(
    (key) => !key.startsWith('_') && !generated.has(key),
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
