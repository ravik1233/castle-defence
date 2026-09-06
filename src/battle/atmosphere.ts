/**
 * Atmosphere: the drifting, flickering, glowing things that stop a static
 * battlefield looking like a slide.
 *
 * Everything here is decorative and driven by tweens, so it costs nothing in
 * the simulation. Lights use a radial texture rather than flat shapes - an
 * additive flat circle reads as a grey disc, which is worse than no light.
 */
import Phaser from 'phaser';
import type { Biome } from '../art/scenery';
import { DESIGN, FIELD, WALL } from '../core/layout';

export interface AtmosphereOptions {
  /** 0 disables everything; 1 is the full effect. */
  intensity?: number;
}

const TINTS: Record<string, { shaft: number; grade: number }> = {
  fields: { shaft: 0xfff0c0, grade: 0xffe2b0 },
  woods: { shaft: 0xc9c0e0, grade: 0xbfb4e0 },
  abyss: { shaft: 0xff9b6a, grade: 0xff8a5a },
  throne: { shaft: 0xd06aff, grade: 0xc06aff },
};

export class Atmosphere {
  private readonly items: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly biome: Biome,
    opts: AtmosphereOptions = {},
  ) {
    const intensity = opts.intensity ?? 1;
    if (intensity <= 0) return;
    this.addSkyDrift(intensity);
    this.addSunWash();
    this.addMotes(intensity);
    this.addTorchGlow(intensity);
    this.addVignette();
  }

  private track<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.items.push(o);
    return o;
  }

  /** Slow clouds or ash banks across the horizon band. */
  private addSkyDrift(intensity: number): void {
    const dark = this.biome.id === 'abyss' || this.biome.id === 'throne';
    const count = Math.round(5 * intensity);
    for (let i = 0; i < count; i += 1) {
      const y = FIELD.y - FIELD.horizon + 12 + (i % 3) * 20;
      const w = 240 + ((i * 97) % 260);
      const cloud = this.track(
        this.scene.add
          .image(-w, y, 'fx.glow')
          .setDisplaySize(w, 60)
          .setTint(dark ? 0x6a3346 : 0xffffff)
          .setAlpha(dark ? 0.3 : 0.42)
          .setDepth(-900),
      ) as Phaser.GameObjects.Image;
      this.scene.tweens.add({
        targets: cloud,
        x: DESIGN.width + w,
        duration: 48000 + i * 11000,
        repeat: -1,
        delay: -((i * 40000) / count),
      });
    }
  }

  /** The key light of the scene, washing down from the sky. */
  private addSunWash(): void {
    // Only over the field: washing the castle wall bleaches it.
    this.track(
      this.scene.add
        .image(WALL.width, FIELD.y - FIELD.horizon, 'fx.sunwash')
        .setOrigin(0, 0)
        .setDisplaySize(DESIGN.width - WALL.width, FIELD.height * 0.55)
        .setTint(TINTS[this.biome.id]?.grade ?? 0xffffff)
        .setAlpha(0.5)
        .setDepth(4300)
        .setBlendMode(Phaser.BlendModes.ADD),
    );
  }

  /** Dust, ash or embers drifting over the lanes. */
  private addMotes(intensity: number): void {
    const count = Math.round(26 * intensity);
    const rises = this.biome.id === 'abyss' || this.biome.id === 'throne';
    const tint = Phaser.Display.Color.HexStringToColor(this.biome.mote).color;
    for (let i = 0; i < count; i += 1) {
      const x = WALL.width + Math.random() * (DESIGN.width - WALL.width);
      const y = FIELD.y + Math.random() * FIELD.height;
      const size = 6 + Math.random() * 14;
      const mote = this.track(
        this.scene.add
          .image(x, y, 'fx.glow')
          .setDisplaySize(size, size)
          .setTint(tint)
          .setAlpha(0)
          .setDepth(5500)
          .setBlendMode(Phaser.BlendModes.ADD),
      ) as Phaser.GameObjects.Image;
      const drift = 40 + Math.random() * 90;
      this.scene.tweens.add({
        targets: mote,
        y: rises ? y - 300 - Math.random() * 200 : y + 140,
        x: x - drift + Math.random() * drift * 2,
        alpha: { from: 0.65, to: 0 },
        duration: 6000 + Math.random() * 7000,
        repeat: -1,
        delay: Math.random() * 6000,
        onRepeat: () => {
          mote.setPosition(
            WALL.width + Math.random() * (DESIGN.width - WALL.width),
            rises ? FIELD.y + FIELD.height - Math.random() * 140 : FIELD.y + Math.random() * FIELD.height,
          );
        },
      });
    }
  }

  /** Wall torches pulse, so the castle edge is not a dead grey strip. */
  private addTorchGlow(intensity: number): void {
    const spacing = 168;
    for (let y = FIELD.y + 40; y < FIELD.y + FIELD.height; y += spacing) {
      const glow = this.track(
        this.scene.add
          .image(WALL.width - 40, y, 'fx.glow')
          .setDisplaySize(200 * intensity, 200 * intensity)
          .setTint(0xffab3d)
          .setAlpha(0.34)
          .setDepth(2100)
          .setBlendMode(Phaser.BlendModes.ADD),
      ) as Phaser.GameObjects.Image;
      this.scene.tweens.add({
        targets: glow,
        scale: { from: glow.scale * 0.85, to: glow.scale * 1.12 },
        alpha: { from: 0.24, to: 0.42 },
        duration: 620 + Math.random() * 480,
        yoyo: true,
        repeat: -1,
        delay: Math.random() * 500,
      });
    }
  }

  /** Darkens the edges so the eye stays on the lanes. */
  private addVignette(): void {
    // Drawn wider than the screen so the falloff never reads as an oval.
    this.track(
      this.scene.add
        .image(DESIGN.width / 2, FIELD.y + FIELD.height / 2, 'fx.vignette')
        .setDisplaySize(DESIGN.width * 1.5, (FIELD.height + FIELD.horizon) * 1.25)
        .setDepth(4400),
    );
  }

  destroy(): void {
    for (const item of this.items) item.destroy();
    this.items.length = 0;
  }
}
