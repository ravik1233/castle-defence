/** Runtime ground contact: region materials, feathered wear and soft shadows. */
import type Phaser from 'phaser';
import { ENVIRONMENT_MATERIAL } from './environment';
import type { BiomeId } from './scenery';

const W = 384;
const H = 128;
type Patch = 'earth' | 'stone' | 'shadow' | 'edge';

/** Read the visible base rather than anchoring transparent canvas padding. */
export interface ArtBounds { x: number; y: number; width: number; height: number; originY: number }
const boundsCache = new WeakMap<Phaser.Textures.Texture, Map<string | number, ArtBounds>>();

export function visibleArtBounds(scene: Phaser.Scene, key: string, frameName: string | number = '__BASE'): ArtBounds {
  const texture = scene.textures.get(key);
  let cache = boundsCache.get(texture);
  if (!cache) boundsCache.set(texture, cache = new Map());
  const known = cache.get(frameName);
  if (known) return known;
  const frame = texture.get(frameName);
  const canvas = document.createElement('canvas');
  canvas.width = frame.cutWidth;
  canvas.height = frame.cutHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(frame.source.image as CanvasImageSource, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let x0 = canvas.width, y0 = canvas.height, x1 = 0, y1 = 0;
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      // Exclude the faint baked shadow when finding the solid structure's base.
      if (pixels[(y * canvas.width + x) * 4 + 3]! <= 96) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y);
      x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
    }
  }
  const bounds = x1 > x0 && y1 > y0
    ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0, originY: y1 / canvas.height }
    : { x: 0, y: 0, width: canvas.width, height: canvas.height, originY: 1 };
  cache.set(frameName, bounds);
  return bounds;
}

/** Each region shares four tiny cached contact textures, created on demand. */
export function groundPatch(scene: Phaser.Scene, biome: BiomeId, patch: Patch): string {
  const key = `ground.contact.${biome}.${patch}`;
  if (scene.textures.exists(key)) return key;
  const material = ENVIRONMENT_MATERIAL[biome];
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  let seed = 4721;
  const random = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const cx = W / 2, cy = H / 2;
  // Draw inside an elliptical coordinate system so the shadow never has a rim.
  ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.28);
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.45);
  const color = patch === 'shadow' ? material.shadow : patch === 'stone' ? material.stone : material.soil;
  gradient.addColorStop(0, color + (patch === 'shadow' ? '9e' : '65'));
  gradient.addColorStop(0.45, color + (patch === 'shadow' ? '62' : '32'));
  gradient.addColorStop(1, color + '00');
  if (patch !== 'edge') {
    ctx.fillStyle = gradient;
    ctx.fillRect(-W / 2, -H * 2, W, H * 4);
  }
  ctx.restore();
  if (patch !== 'shadow') {
    for (let i = 0; i < (patch === 'edge' ? 110 : 170); i += 1) {
      const angle = random() * Math.PI * 2;
      const r = Math.sqrt(random());
      const x = cx + Math.cos(angle) * r * W * 0.42;
      const y = cy + Math.sin(angle) * r * (patch === 'edge' ? 9 : 34);
      ctx.globalAlpha = (1 - r) * (patch === 'edge' ? 0.64 : 0.3);
      ctx.fillStyle = i % 3 === 0 ? material.grain : patch === 'stone' ? material.stone : material.growth;
      ctx.beginPath(); ctx.ellipse(x, y, 1 + random() * 3, 0.6 + random(), 0, 0, Math.PI * 2); ctx.fill();
      if (patch === 'earth' && !material.paving && !material.wet && i % 8 === 0) {
        ctx.strokeStyle = material.growth; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2, y - 4 - random() * 5); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    if (patch === 'stone' || (material.paving && patch === 'earth')) {
      ctx.strokeStyle = material.shadow; ctx.lineWidth = 1; ctx.globalAlpha = 0.2;
      for (let i = 0; i < 5; i += 1) {
        const x = 80 + i * 47;
        ctx.beginPath(); ctx.moveTo(x, 49); ctx.lineTo(x + 8, 61); ctx.lineTo(x + 3, 77); ctx.stroke();
      }
    }
  }
  scene.textures.addCanvas(key, canvas);
  return key;
}

export function lightStructure(image: Phaser.GameObjects.Image, biome: BiomeId): void {
  const { light, baseLight } = ENVIRONMENT_MATERIAL[biome];
  image.setTint(light, light, baseLight, baseLight);
}

/** Local foundation follows its structure and is removed with it. */
export class BuildingGround {
  private readonly images: Phaser.GameObjects.Image[];
  constructor(scene: Phaser.Scene, biome: BiomeId, x: number, y: number, width: number, onWall: boolean) {
    const material = ENVIRONMENT_MATERIAL[biome];
    this.images = [
      scene.add.image(x, y + 2, groundPatch(scene, biome, onWall || material.paving ? 'stone' : 'earth')).setDisplaySize(width * 1.36, 58).setDepth(y - 0.2),
      scene.add.image(x, y, groundPatch(scene, biome, 'shadow')).setDisplaySize(width * 1.12, 28).setDepth(y - 0.1),
      scene.add.image(x, y + 2, groundPatch(scene, biome, 'edge')).setDisplaySize(width * 1.08, 36).setDepth(y + 0.1),
    ];
  }
  setPosition(x: number, y: number): void {
    this.images.forEach((image, i) => image.setPosition(x, y + (i === 1 ? 0 : 2)).setDepth(y + (i === 0 ? -0.2 : i === 1 ? -0.1 : 0.1)));
  }
  destroy(): void { this.images.forEach(image => image.destroy()); }
}
