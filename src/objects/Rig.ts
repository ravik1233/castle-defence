/**
 * Animated cut-out puppet.
 *
 * Parts are positioned from the shared `characterLayout`, then driven
 * procedurally each frame - no spritesheets, so animation stays smooth at any
 * scale and new characters need no extra art work.
 */
import Phaser from 'phaser';
import { REST_POSE, armLength, characterLayout } from '../art/compose';
import type { CharacterArt } from '../art/humanoid';
import { SUPERSAMPLE, paintedFrameSet, paintedRig } from '../art/registry';
import { WORLD_ART_SCALE } from '../core/layout';

export type RigAnim = 'idle' | 'walk' | 'attack' | 'cast' | 'hurt' | 'die' | 'spawn';

interface PartView {
  name: string;
  image: Phaser.GameObjects.Image;
  baseX: number;
  baseY: number;
  baseRotation: number;
}

export interface RigOptions {
  /** 1 faces right (defenders), -1 faces left (attackers). */
  facing?: 1 | -1;
  /** Multiplier on top of the global art scale. */
  scale?: number;
  /** Randomises animation phase so a crowd does not march in lockstep. */
  phase?: number;
}

/**
 * Texture key holding a single painted image of a whole character.
 * When one exists it replaces the generated part rig entirely - see
 * docs/GEMINI_ART_PROMPTS.md.
 */
export function fullSpriteKey(artId: string): string {
  return `unit.${artId}.full`;
}

/**
 * Optional second painted pose, swapped in while the unit swings or casts.
 * Everything else - walking, being hit, dying - stays procedural, so this is
 * the only extra drawing worth asking an artist for.
 */
/** Where a painted weapon rides when held: a little above the horizontal. */
const WEAPON_REST = -0.18;

/**
 * How long the one-shot animations run, matching the rigged versions exactly.
 * A frame-played swing that lands early would deal its damage before the
 * picture shows the blow.
 */
const ONE_SHOT: Partial<Record<RigAnim, number>> = { attack: 0.42, cast: 0.55 };

export function attackSpriteKey(artId: string): string {
  return `unit.${artId}.attack`;
}

export class Rig extends Phaser.GameObjects.Container {
  readonly art: CharacterArt;
  private readonly views = new Map<string, PartView>();
  /** Set when the character is a single painted sprite rather than parts. */
  private readonly sprite?: Phaser.GameObjects.Image;
  /** Texture keys for the painted idle and (optional) attack poses. */
  private readonly poseIdle?: string;
  private readonly poseAttack?: string;
  private readonly artScale: number;
  /** Hand distance for a painted rig, whose arms are not the vector arms. */
  private readonly paintedArmLen?: number;
  /** Set when the unit has drawn animation frames rather than a rig. */
  private readonly frames?: Phaser.GameObjects.Image;
  private frameCount = 0;
  private shownFrame = -1;
  private facingSign: 1 | -1;
  private anim: RigAnim = 'idle';
  private t: number;
  private animT = 0;
  private attackHit = false;
  private onAttackHit?: () => void;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  /** Set while an attack or cast one-shot is playing. */
  private oneShot = false;

  constructor(scene: Phaser.Scene, x: number, y: number, art: CharacterArt, opts: RigOptions = {}) {
    super(scene, x, y);
    this.art = art;
    this.facingSign = opts.facing ?? 1;
    this.artScale = (opts.scale ?? 1) * WORLD_ART_SCALE;
    this.t = opts.phase ?? Math.random() * 10;

    const sk = art.skeleton;
    this.shadow = scene.add.ellipse(0, 0, sk.hipWidth * 2.4 * this.artScale, sk.hipWidth * 0.8 * this.artScale, 0x120c1c, 0.32);
    this.add(this.shadow);

    // Painted art path: one image, animated procedurally.
    const painted = fullSpriteKey(art.id);
    if (scene.textures.exists(painted)) {
      this.poseIdle = painted;
      const attack = attackSpriteKey(art.id);
      if (scene.textures.exists(attack)) this.poseAttack = attack;
      const img = scene.add.image(0, 0, painted);
      img.setOrigin(0.5, 1);
      img.setDisplaySize((img.width / img.height) * this.worldHeight, this.worldHeight);
      this.sprite = img;
      this.add(img);
      this.setScale(this.facingSign, 1);
      scene.add.existing(this);
      return;
    }

    /*
     * Drawn frames win over everything else. If an artist has drawn the poses
     * there is nothing to assemble, nothing to guess at, and nothing that can
     * come out wrong: the unit simply shows the pose it is in.
     */
    const strip = paintedFrameSet(art.id);
    if (strip && scene.textures.exists(`unit.${art.id}.frame0`)) {
      this.frameCount = strip.count;
      const img = scene.add.image(0, 0, `unit.${art.id}.frame0`);
      // Frames share one canvas with the feet on its bottom edge, so anchoring
      // there puts every pose on the ground without further arithmetic.
      img.setOrigin(0.5, 1);
      img.setDisplaySize((strip.width / strip.height) * this.worldHeight, this.worldHeight);
      this.frames = img;
      this.add(img);
      this.setScale(this.facingSign, 1);
      scene.add.existing(this);
      return;
    }

    /*
     * Painted parts path: the same cut-out puppet as the vector rig, but the
     * pieces are painted and the assembly comes from the art pack rather than
     * from the generated skeleton. Everything below this - every pose, every
     * animation - reads `views` by name, so it works unchanged.
     */
    const rig = paintedRig(art.id);
    if (rig && scene.textures.exists(`unit.${art.id}.torso`)) {
      // Back to front, so an arm passes in front of the chest and behind the head.
      const order = [
        'cape',
        'wings',
        'armBack',
        'legBack',
        'torso',
        'head',
        'legFront',
        'offhand',
        'armFront',
        'weapon',
      ];
      const k = this.worldHeight / rig.height;
      for (const name of order) {
        const slot = rig.parts[name];
        const key = `unit.${art.id}.${name}`;
        if (!slot || !scene.textures.exists(key)) continue;
        /*
         * The same rest angles the vector rig uses. Without them every joint
         * sits at zero, which reads as a mannequin: both arms hanging dead
         * straight, legs parallel, and a weapon lying flat on the horizontal.
         *
         * The weapon is the exception. Painted weapons are drawn lying
         * horizontally on the sheet, so it carries the angle it should sit at
         * when held; setPose re-solves its position from the hand each frame
         * and cancels the arm's rest angle out of the rotation, which leaves
         * exactly this.
         */
        const rest = (REST_POSE as unknown as Record<string, number>)[name] ?? 0;
        const baseRotation = name === 'weapon' ? WEAPON_REST : rest;
        const img = scene.add.image(slot.x * k, slot.y * k, key);
        img.setOrigin(slot.pivot[0], slot.pivot[1]);
        img.setDisplaySize(slot.w * k, slot.h * k);
        img.setRotation(baseRotation);
        this.add(img);
        this.views.set(name, {
          name,
          image: img,
          baseX: slot.x * k,
          baseY: slot.y * k,
          baseRotation,
        });
      }
      const arm = rig.parts.armFront;
      if (arm) this.paintedArmLen = arm.h * k * 0.82;
      this.setScale(this.facingSign, 1);
      scene.add.existing(this);
      return;
    }

    for (const p of characterLayout(art, REST_POSE)) {
      const key = `unit.${art.id}.${p.name}`;
      const img = scene.add.image(p.x * this.artScale, p.y * this.artScale, key);
      img.setOrigin(p.part.pivotX, p.part.pivotY);
      img.setScale(this.artScale / SUPERSAMPLE);
      img.setRotation(p.rotation);
      this.add(img);
      this.views.set(p.name, {
        name: p.name,
        image: img,
        baseX: p.x * this.artScale,
        baseY: p.y * this.artScale,
        baseRotation: p.rotation,
      });
    }

    this.setScale(this.facingSign, 1);
    scene.add.existing(this);
  }

  /**
   * Turns the character round.
   *
   * Almost nothing needs this - defenders face right and enemies face left
   * for their whole lives. A flanker does: once it is through the wall and
   * hunting back up a lane, it is walking the other way.
   */
  setFacing(sign: 1 | -1): void {
    if (this.facingSign === sign) return;
    this.facingSign = sign;
    this.setScale(sign, 1);
  }

  /** Height of the character in world pixels. */
  get worldHeight(): number {
    return this.art.height * this.artScale;
  }

  get headY(): number {
    return -this.art.skeleton.headCenter * this.artScale;
  }

  play(anim: RigAnim, onHit?: () => void): void {
    if (this.anim === anim && anim !== 'attack' && anim !== 'cast') return;
    // Spawn and death animate the container itself; cutting one short would
    // otherwise leave the unit stuck half-faded or half-scaled.
    if (this.anim === 'spawn' && anim !== 'die') this.resetTransform();
    this.anim = anim;
    this.animT = 0;
    this.attackHit = false;
    this.onAttackHit = onHit;
    this.oneShot = anim === 'attack' || anim === 'cast';
  }

  get current(): RigAnim {
    return this.anim;
  }

  /** Puts the container back to its neutral alpha, scale and rotation. */
  private resetTransform(): void {
    this.setAlpha(1);
    this.setScale(this.facingSign, 1);
    this.setRotation(0);
  }

  private part(name: string): PartView | undefined {
    return this.views.get(name);
  }

  /**
   * Painted sprites have no joints, so they are animated as a whole: bob,
   * lean, squash and stretch. It reads surprisingly well at phone size and
   * costs the artist nothing beyond one image.
   */
  private setSpritePose(bob: number, lean: number, tilt: number, squash = 0, striking = false): void {
    const img = this.sprite;
    if (!img) return;
    // Swap to the painted attack pose for the swing, if one was supplied.
    if (this.poseAttack) {
      const want = striking ? this.poseAttack : this.poseIdle!;
      if (img.texture.key !== want) img.setTexture(want);
    }
    const h = this.worldHeight;
    const w = (img.width / img.height) * h;
    img.setPosition(lean, bob);
    img.setRotation(tilt);
    img.setDisplaySize(w * (1 + squash * 0.5), h * (1 - squash));
  }

  private setPose(rot: Record<string, number>, bob: number, lean = 0): void {
    if (this.sprite) return;
    for (const [name, view] of this.views) {
      const extra = rot[name] ?? 0;
      view.image.setRotation(view.baseRotation + extra);
      const isLower = name === 'legBack' || name === 'legFront';
      view.image.y = view.baseY + (isLower ? 0 : bob);
      view.image.x = view.baseX + (isLower ? 0 : lean);
    }
    // The weapon rides in the hand, so it is re-solved from the arm angle.
    const weapon = this.part('weapon');
    const armFront = this.part('armFront');
    if (weapon && armFront) {
      const len = this.paintedArmLen ?? armLength(this.art.skeleton) * this.artScale;
      const r = armFront.image.rotation;
      weapon.image.x = armFront.image.x + Math.sin(r) * len;
      weapon.image.y = armFront.image.y + Math.cos(r) * len;
      weapon.image.setRotation(weapon.baseRotation - REST_POSE.armFront + r);
    }
    const offhand = this.part('offhand');
    if (offhand) {
      offhand.image.y = offhand.baseY + bob;
      offhand.image.x = offhand.baseX + lean;
    }
  }

  /** Shows one of the drawn poses. Indices follow the strip's own order. */
  private showFrame(i: number): void {
    const clamped = Math.max(0, Math.min(this.frameCount - 1, i));
    if (clamped === this.shownFrame) return;
    this.shownFrame = clamped;
    this.frames?.setTexture(`unit.${this.art.id}.frame${clamped}`);
  }

  /**
   * Plays the drawn poses: idle, two strides, the strike, and falling.
   *
   * The small motions on top - the breathing bob, the lunge into a swing, the
   * topple on death - are the same ones the rigs use. A drawn pose says what
   * the body is doing; the movement through it is still the game's job.
   */
  private updateFrames(): void {
    const img = this.frames;
    if (!img) return;
    const h = this.worldHeight;
    img.setPosition(0, 0);
    img.setRotation(0);
    img.setAlpha(1);
    img.setDisplaySize(img.width * (h / img.height), h);

    switch (this.anim) {
      case 'walk': {
        // Two strides is a whole cycle; four beats a second reads as marching.
        this.showFrame(1 + (Math.floor(this.t * 4) % 2));
        img.y = -Math.abs(Math.sin(this.t * 8)) * h * 0.015;
        break;
      }
      case 'attack':
      case 'cast': {
        const k = Math.min(1, this.animT / (ONE_SHOT[this.anim] ?? 0.42));
        this.showFrame(k > 0.28 && k < 0.82 ? 3 : 0);
        // Lean into the blow and settle back out of it.
        img.x = Math.sin(Math.min(1, k) * Math.PI) * h * 0.05;
        break;
      }
      case 'hurt': {
        this.showFrame(0);
        const k = Math.min(1, this.animT / 0.24);
        img.x = -Math.sin(k * Math.PI) * h * 0.04;
        img.setRotation(-Math.sin(k * Math.PI) * 0.08);
        break;
      }
      case 'die': {
        const k = Math.min(1, this.animT / 0.55);
        this.showFrame(this.frameCount - 1);
        img.setRotation(-0.5 * k);
        img.y = h * 0.06 * k;
        img.setAlpha(1 - k * 0.35);
        break;
      }
      case 'spawn': {
        const k = Math.min(1, this.animT / 0.3);
        this.showFrame(0);
        img.setAlpha(k);
        img.setDisplaySize(img.width * (h / img.height) * (0.7 + 0.3 * k), h * (0.7 + 0.3 * k));
        break;
      }
      default: {
        this.showFrame(0);
        img.y = -Math.abs(Math.sin(this.t * 2.2)) * h * 0.008;
      }
    }
  }

  override update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.t += dt;
    this.animT += dt;

    if (this.frames) {
      this.updateFrames();
      // A swing still has to tell the game when the blow lands, on the same
      // beat as the rigged one, or damage stops matching the picture.
      const d = ONE_SHOT[this.anim];
      if (d) {
        if (!this.attackHit && this.animT >= d * 0.55) {
          this.attackHit = true;
          this.onAttackHit?.();
        }
        if (this.animT >= d) {
          this.oneShot = false;
          this.play('idle');
        }
      }
      return;
    }
    const sk = this.art.skeleton;
    const unit = sk.headR * this.artScale * 0.1;

    switch (this.anim) {
      case 'walk': {
        const s = Math.sin(this.t * 7.5);
        const c = Math.cos(this.t * 7.5);
        if (this.sprite) {
          this.setSpritePose(-Math.abs(c) * unit * 2.2, 0, s * 0.055, Math.abs(s) * 0.04);
          break;
        }
        this.setPose(
          {
            legFront: s * 0.62,
            legBack: -s * 0.62,
            armFront: -s * 0.34,
            armBack: s * 0.34,
            torso: c * 0.05,
            head: -c * 0.05,
            cape: s * 0.12,
            wings: s * 0.1,
          },
          Math.abs(c) * unit * -1.4,
          0,
        );
        break;
      }
      case 'attack': {
        // wind up, strike, recover
        const d = 0.42;
        const k = Math.min(1, this.animT / d);
        const swing = k < 0.42 ? -1.15 * (k / 0.42) : 1.5 * ((k - 0.42) / 0.58) - 1.15;
        if (this.sprite) {
          // Pull back, then lunge: the same beat as the rigged swing.
          this.setSpritePose(-Math.sin(k * Math.PI) * unit, swing * unit * 3.2, swing * 0.16, -swing * 0.05, k > 0.3);
          if (!this.attackHit && k >= 0.55) {
            this.attackHit = true;
            this.onAttackHit?.();
          }
          if (k >= 1) {
            this.oneShot = false;
            this.anim = 'idle';
          }
          break;
        }
        this.setPose(
          {
            armFront: swing,
            armBack: -swing * 0.28,
            torso: swing * 0.14,
            head: swing * 0.08,
            legFront: swing * 0.1,
          },
          Math.sin(k * Math.PI) * unit * -2,
          Math.sin(k * Math.PI) * unit * 2.5,
        );
        if (!this.attackHit && k >= 0.55) {
          this.attackHit = true;
          this.onAttackHit?.();
        }
        if (k >= 1) {
          this.oneShot = false;
          this.anim = 'idle';
        }
        break;
      }
      case 'cast': {
        const d = 0.55;
        const k = Math.min(1, this.animT / d);
        const raise = -1.9 * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5);
        if (this.sprite) {
          this.setSpritePose(-unit * 2.4 * Math.sin(k * Math.PI), 0, 0, -0.06 * Math.sin(k * Math.PI), k > 0.25);
          if (!this.attackHit && k >= 0.5) {
            this.attackHit = true;
            this.onAttackHit?.();
          }
          if (k >= 1) {
            this.oneShot = false;
            this.anim = 'idle';
          }
          break;
        }
        this.setPose(
          {
            armFront: raise,
            armBack: raise * 0.18,
            torso: -0.06,
            head: -0.1,
          },
          -unit * 1.4 * Math.sin(k * Math.PI),
          0,
        );
        if (!this.attackHit && k >= 0.5) {
          this.attackHit = true;
          this.onAttackHit?.();
        }
        if (k >= 1) {
          this.oneShot = false;
          this.anim = 'idle';
        }
        break;
      }
      case 'hurt': {
        const k = Math.min(1, this.animT / 0.18);
        if (this.sprite) this.setSpritePose(0, -unit * 3 * (1 - k), 0.1 * (1 - k));
        else this.setPose({ torso: 0.12 * (1 - k), head: 0.2 * (1 - k) }, 0, -unit * 3 * (1 - k));
        if (k >= 1) this.anim = 'idle';
        break;
      }
      case 'die': {
        const k = Math.min(1, this.animT / 0.5);
        this.setRotation(this.facingSign * -1.35 * k);
        this.setAlpha(1 - k * 0.9);
        this.y += dt * 20;
        break;
      }
      case 'spawn': {
        const k = Math.min(1, this.animT / 0.35);
        this.setAlpha(k);
        this.setScale(this.facingSign * (0.7 + 0.3 * k), 0.7 + 0.3 * k);
        if (k >= 1) {
          this.resetTransform();
          this.anim = 'idle';
        }
        break;
      }
      default: {
        const s = Math.sin(this.t * 2.4);
        if (this.sprite) {
          this.setSpritePose(s * unit * 0.9, 0, s * 0.012, s * 0.012);
          break;
        }
        this.setPose(
          {
            armFront: s * 0.07,
            armBack: -s * 0.07,
            torso: s * 0.02,
            head: -s * 0.03,
            cape: s * 0.05,
            wings: Math.sin(this.t * 3.4) * 0.14,
          },
          s * unit * 0.7,
          0,
        );
        break;
      }
    }
  }

  get isBusy(): boolean {
    return this.oneShot;
  }

  private get tintTargets(): Phaser.GameObjects.Image[] {
    if (this.sprite) return [this.sprite];
    return [...this.views.values()].map((v) => v.image);
  }

  flash(color = 0xffffff, duration = 110): void {
    for (const img of this.tintTargets) img.setTintFill(color);
    this.scene.time.delayedCall(duration, () => {
      for (const img of this.tintTargets) img.clearTint();
    });
  }

  tintAll(color: number): void {
    for (const img of this.tintTargets) img.setTint(color);
  }

  clearTintAll(): void {
    for (const img of this.tintTargets) img.clearTint();
  }

  setShadowVisible(v: boolean): void {
    this.shadow.setVisible(v);
  }
}
