/**
 * The first-level tutorial.
 *
 * Two steps, each gated on the player actually doing the thing. The first
 * wave waits until one Militia is ready; enemy kills then teach the Ember
 * loop directly through play.
 */
import Phaser from 'phaser';
import { DESIGN, FIELD, cellCenter } from '../core/layout';
import { TextButton, textStyle } from '../ui/kit';

export interface TutorialHost {
  /** Screen position of a card in the tray, or undefined if not in the deck. */
  cardPosition(defenderId: string): { x: number; y: number } | undefined;
  /** Holds the wave timer while the player is being taught. */
  setWavesHeld(held: boolean): void;
  /** Number of live defenders of a kind. */
  countPlaced(defenderId: string): number;
}

interface Step {
  text: string;
  /** Where to point. */
  target: () => { x: number; y: number } | undefined;
  /** True once the player has done it. */
  done: (host: TutorialHost) => boolean;
}

export class Tutorial {
  private index = 0;
  private layer: Phaser.GameObjects.Container;
  private banner: Phaser.GameObjects.Container;
  private label: Phaser.GameObjects.Text;
  private pointer: Phaser.GameObjects.Container;
  private ring: Phaser.GameObjects.Image;
  private finished = false;
  private readonly steps: Step[];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly host: TutorialHost,
    private readonly onFinish: () => void,
  ) {
    this.steps = [
      {
        text: 'Tap the Militia card.\nGoblins release Ember when defeated.',
        target: () => host.cardPosition('militia'),
        done: () => this.cardChosen === 'militia',
      },
      {
        text: 'Place the Militia near the wall.\nSpend each Ember while the assault is moving.',
        target: () => cellCenter(2, 0),
        done: (h) => h.countPlaced('militia') >= 1,
      },
    ];

    this.layer = scene.add.container(0, 0).setDepth(8500);

    this.ring = scene.add
      .image(0, 0, 'ui.ring.gold')
      .setDisplaySize(210, 210)
      .setAlpha(0.9);
    this.layer.add(this.ring);
    scene.tweens.add({
      targets: this.ring,
      scaleX: { from: this.ring.scaleX * 0.82, to: this.ring.scaleX * 1.02 },
      scaleY: { from: this.ring.scaleY * 0.82, to: this.ring.scaleY * 1.02 },
      duration: 780,
      yoyo: true,
      repeat: -1,
    });

    // A chunky arrow rather than a hand: it reads at any size and needs no art.
    this.pointer = scene.add.container(0, 0);
    const arrow = scene.add
      .triangle(0, 0, 0, 0, 46, -34, -46, -34, 0xffd257)
      .setStrokeStyle(5, 0x6a4a12);
    this.pointer.add(arrow);
    this.layer.add(this.pointer);
    // The bob runs on the arrow, not the container: tweening the container
    // would fight every repositioning between steps.
    scene.tweens.add({
      targets: arrow,
      y: { from: 0, to: 22 },
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.banner = scene.add.container(DESIGN.width / 2, FIELD.y + FIELD.height - 80);
    const plate = scene.add.image(0, 0, 'ui.panel.small').setDisplaySize(820, 150);
    this.label = scene.add
      .text(0, -6, '', { ...textStyle('small'), align: 'center', wordWrap: { width: 740 } })
      .setOrigin(0.5);
    this.banner.add([plate, this.label]);
    this.layer.add(this.banner);

    const skip = new TextButton(scene, DESIGN.width - 120, FIELD.y + 50, 'SKIP', {
      width: 190,
      height: 78,
      size: 'small',
      tone: 'stone',
      onClick: () => this.finish(),
    });
    this.layer.add(skip);

    host.setWavesHeld(true);
    this.show();
  }

  private cardChosen = '';

  /** Battle tells the tutorial what the player just did. */
  noteCardSelected(id: string): void {
    this.cardChosen = id;
  }

  private show(): void {
    const step = this.steps[this.index];
    if (!step) {
      this.finish();
      return;
    }
    this.label.setText(step.text);
    const target = step.target();
    if (target) {
      this.ring.setPosition(target.x, target.y).setVisible(true);
      this.pointer.setPosition(target.x, target.y + 110).setVisible(true);
      // Keep the banner away from whatever is being pointed at.
      this.banner.y =
        target.y > FIELD.y + FIELD.height * 0.5 ? FIELD.y + 110 : FIELD.y + FIELD.height - 80;
    } else {
      this.ring.setVisible(false);
      this.pointer.setVisible(false);
    }
    this.layer.setAlpha(0);
    this.scene.tweens.add({ targets: this.layer, alpha: 1, duration: 220 });
  }

  update(): void {
    if (this.finished) return;
    const step = this.steps[this.index];
    if (!step) return;
    if (!step.done(this.host)) {
      // Cells move with the grid, cards do not; re-point every frame is cheap.
      const target = step.target();
      if (target && this.ring.visible) {
        this.ring.setPosition(target.x, target.y);
        this.pointer.x = target.x;
      }
      return;
    }
    this.index += 1;
    if (this.index >= this.steps.length) {
      this.finish();
      return;
    }
    this.show();
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.host.setWavesHeld(false);
    this.scene.tweens.add({
      targets: this.layer,
      alpha: 0,
      duration: 260,
      onComplete: () => this.layer.destroy(),
    });
    this.onFinish();
  }

  get isDone(): boolean {
    return this.finished;
  }
}
