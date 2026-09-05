/**
 * Shared UI furniture: buttons, panels, dialogs and the text style scale.
 * Everything here is built from the vector textures in `src/art/props.ts`.
 */
import Phaser from 'phaser';
import { audio, haptic } from '../systems/audio';

export const FONT = '"Fredoka", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';

export const COLORS: Record<
  'gold' | 'parchment' | 'ink' | 'danger' | 'good' | 'arcane' | 'muted',
  string
> = {
  gold: '#f5c542',
  parchment: '#f4ecdd',
  ink: '#1b1626',
  danger: '#e8455c',
  good: '#5fd07a',
  arcane: '#a45cf0',
  muted: '#a99cc4',
};

export type TextSize = 'tiny' | 'small' | 'body' | 'title' | 'huge';

const SIZES: Record<TextSize, number> = {
  tiny: 22,
  small: 28,
  body: 36,
  title: 56,
  huge: 84,
};

export function textStyle(
  size: TextSize,
  color: string = COLORS.parchment,
  extra: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${SIZES[size]}px`,
    color,
    fontStyle: '600',
    stroke: '#140f1e',
    strokeThickness: Math.max(3, SIZES[size] * 0.11),
    shadow: { offsetX: 0, offsetY: 3, color: '#00000066', blur: 6, fill: true },
    ...extra,
  };
}

/** Shrinks a text object until it fits, so long names never overflow. */
export function fitText(text: Phaser.GameObjects.Text, maxWidth: number): Phaser.GameObjects.Text {
  let guard = 0;
  while (text.width > maxWidth && guard < 30) {
    const size = parseInt(String(text.style.fontSize), 10);
    if (size <= 12) break;
    text.setFontSize(size - 2);
    guard += 1;
  }
  return text;
}

/** A row of filled/empty stars, centred on x. */
export function starRow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  earned: number,
  size = 46,
  total = 3,
): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y);
  const gap = size * 0.92;
  for (let i = 0; i < total; i += 1) {
    const star = scene.add
      .image(-((total - 1) / 2) * gap + i * gap, 0, i < earned ? 'icon.star' : 'icon.star_empty')
      .setDisplaySize(size, size);
    c.add(star);
  }
  return c;
}

export interface ButtonOptions {
  width?: number;
  height?: number;
  /** One of the ui.button.* texture variants. */
  tone?: 'green' | 'gold' | 'red' | 'blue' | 'stone';
  size?: TextSize;
  onClick?: () => void;
  enabled?: boolean;
  icon?: string;
}

export class TextButton extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private iconImg?: Phaser.GameObjects.Image;
  private enabledState = true;
  private handler?: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number, text: string, opts: ButtonOptions = {}) {
    super(scene, x, y);
    const w = opts.width ?? 360;
    const h = opts.height ?? 104;
    this.handler = opts.onClick;

    this.bg = scene.add.image(0, 0, `ui.button.${opts.tone ?? 'green'}`);
    this.bg.setDisplaySize(w, h);
    this.add(this.bg);

    this.label = scene.add
      .text(0, -3, text, textStyle(opts.size ?? 'body'))
      .setOrigin(0.5);
    this.add(this.label);

    if (opts.icon) {
      this.iconImg = scene.add.image(-w / 2 + 44, -2, opts.icon);
      this.iconImg.setDisplaySize(46, 46);
      this.add(this.iconImg);
      this.label.x = 22;
    }

    this.setSize(w, h);
    this.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    this.on('pointerdown', () => {
      if (!this.enabledState) {
        audio.play('deny');
        return;
      }
      haptic(10);
      audio.play('tap');
      this.scene.tweens.add({ targets: this, scaleX: 0.94, scaleY: 0.9, duration: 70, yoyo: true });
    });
    this.on('pointerup', () => {
      if (this.enabledState) this.handler?.();
    });
    this.setEnabled(opts.enabled ?? true);
    scene.add.existing(this);
  }

  setEnabled(v: boolean): this {
    this.enabledState = v;
    this.bg.setAlpha(v ? 1 : 0.45);
    this.label.setAlpha(v ? 1 : 0.5);
    this.iconImg?.setAlpha(v ? 1 : 0.5);
    return this;
  }

  setText(t: string): this {
    this.label.setText(t);
    return this;
  }

  onClick(fn: () => void): this {
    this.handler = fn;
    return this;
  }
}

export function panelImage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  key = 'ui.panel',
): Phaser.GameObjects.Image {
  const img = scene.add.image(x, y, key);
  img.setDisplaySize(w, h);
  return img;
}

export interface DialogOptions {
  title: string;
  body?: string;
  /** Rendered left to right under the body. */
  buttons: Array<{ text: string; tone?: ButtonOptions['tone']; onClick?: () => void }>;
  width?: number;
  height?: number;
  /** Extra content built inside the panel; receives panel-local coordinates. */
  build?: (container: Phaser.GameObjects.Container, w: number, h: number) => void;
  dismissable?: boolean;
}

/** Modal dialog with a dimmed backdrop. Returns a handle that closes it. */
export function showDialog(scene: Phaser.Scene, opts: DialogOptions): { close: () => void } {
  const cam = scene.cameras.main;
  const cx = cam.width / 2;
  const cy = cam.height / 2;
  const w = opts.width ?? 820;
  const h = opts.height ?? 560;

  const layer = scene.add.container(0, 0).setDepth(9000);
  // Exactly camera-sized: an oversized shade is pure overdraw on low-end GPUs.
  const shade = scene.add.rectangle(cx, cy, cam.width, cam.height, 0x0b0713, 0.72).setInteractive();
  layer.add(shade);

  const group = scene.add.container(cx, cy);
  layer.add(group);
  const panel = panelImage(scene, 0, 0, w, h);
  group.add(panel);

  const title = scene.add.text(0, -h / 2 + 62, opts.title, textStyle('title', COLORS.gold)).setOrigin(0.5);
  group.add(title);

  if (opts.body) {
    const body = scene.add
      .text(0, -h / 2 + 150, opts.body, {
        ...textStyle('small'),
        align: 'center',
        wordWrap: { width: w - 120 },
      })
      .setOrigin(0.5, 0);
    group.add(body);
  }

  opts.build?.(group, w, h);

  const close = (): void => {
    scene.tweens.add({
      targets: group,
      scaleX: 0.9,
      scaleY: 0.9,
      alpha: 0,
      duration: 130,
      onComplete: () => layer.destroy(),
    });
    scene.tweens.add({ targets: shade, alpha: 0, duration: 130 });
  };

  const n = opts.buttons.length;
  const bw = n > 1 ? Math.min(340, (w - 120) / n - 20) : 360;
  opts.buttons.forEach((b, i) => {
    const x = n === 1 ? 0 : -((n - 1) / 2) * (bw + 24) + i * (bw + 24);
    const btn = new TextButton(scene, x, h / 2 - 88, b.text, {
      width: bw,
      tone: b.tone ?? 'green',
      size: n > 2 ? 'small' : 'body',
      onClick: () => {
        b.onClick?.();
        close();
      },
    });
    group.add(btn);
  });

  if (opts.dismissable !== false) shade.on('pointerdown', close);

  group.setScale(0.86);
  group.setAlpha(0);
  scene.tweens.add({ targets: group, scaleX: 1, scaleY: 1, alpha: 1, duration: 190, ease: 'Back.easeOut' });

  return { close };
}

/** A floating number that rises and fades - damage, gold, healing. */
export function floatText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color = COLORS.parchment,
  size: TextSize = 'small',
): void {
  const t = scene.add.text(x, y, text, textStyle(size, color)).setOrigin(0.5).setDepth(8000);
  scene.tweens.add({
    targets: t,
    y: y - 70,
    alpha: 0,
    scaleX: 1.15,
    scaleY: 1.15,
    duration: 750,
    ease: 'Quad.easeOut',
    onComplete: () => t.destroy(),
  });
}

/** Gold/among-HUD readout with an icon. */
export class Counter extends Phaser.GameObjects.Container {
  private readonly label: Phaser.GameObjects.Text;
  private shown = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, icon: string, value = 0, size: TextSize = 'body') {
    super(scene, x, y);
    const img = scene.add.image(0, 0, icon).setDisplaySize(52, 52);
    this.add(img);
    this.label = scene.add.text(36, 0, String(value), textStyle(size, COLORS.parchment)).setOrigin(0, 0.5);
    this.add(this.label);
    this.shown = value;
    scene.add.existing(this);
  }

  set(value: number, animate = true): void {
    if (!animate) {
      this.shown = value;
      this.label.setText(String(Math.round(value)));
      return;
    }
    const from = this.shown;
    this.shown = value;
    this.scene.tweens.addCounter({
      from,
      to: value,
      duration: 260,
      onUpdate: (tw) => this.label.setText(String(Math.round(tw.getValue() ?? value))),
    });
  }
}
