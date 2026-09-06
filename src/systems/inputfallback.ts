/**
 * A safety net for Phaser's per-object hit testing.
 *
 * Phaser only hit-tests game objects that its InputPlugin has moved into its
 * internal list, and it transforms the pointer through state cached inside the
 * plugin. On some devices that plumbing has been observed to go quiet - the
 * loop runs, the scene draws, `pointer.x/y` are correct, and yet
 * `hitTestPointer` returns nothing, so buttons do not respond.
 *
 * This module repeats the hit test from the display list instead, using the
 * same maths Phaser uses (`InputManager.hitTest`), and dispatches the pointer
 * events itself when - and only when - Phaser's own test came up empty. When
 * input is healthy this costs one extra hit test per press and changes nothing.
 */
import Phaser from 'phaser';

type Interactive = Phaser.GameObjects.GameObject & {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  scrollFactorX: number;
  scrollFactorY: number;
  displayOriginX: number;
  displayOriginY: number;
  parentContainer: Phaser.GameObjects.Container | null;
  getWorldTransformMatrix(
    m?: Phaser.GameObjects.Components.TransformMatrix,
    p?: Phaser.GameObjects.Components.TransformMatrix,
  ): Phaser.GameObjects.Components.TransformMatrix;
};

const INSTALLED = Symbol('inputFallback');

/** Depth-first walk of the display list, in the order things are drawn. */
function collect(
  list: Phaser.GameObjects.GameObject[],
  camera: Phaser.Cameras.Scene2D.Camera,
  out: Interactive[],
): void {
  for (const child of list) {
    const holder = child as unknown as { list?: Phaser.GameObjects.GameObject[] };
    if (child.input?.enabled && child.willRender(camera)) out.push(child as Interactive);
    if (Array.isArray(holder.list)) collect(holder.list, camera, out);
  }
}

/** The topmost interactive object under the pointer, or undefined. */
function hitTest(scene: Phaser.Scene, pointer: Phaser.Input.Pointer): Interactive | undefined {
  const camera = scene.cameras.main;
  if (!camera) return undefined;

  const candidates: Interactive[] = [];
  collect(scene.children.list, camera, candidates);

  const world = camera.getWorldPoint(pointer.x, pointer.y);
  const point = new Phaser.Math.Vector2();
  const matrix = new Phaser.GameObjects.Components.TransformMatrix();
  const parentMatrix = new Phaser.GameObjects.Components.TransformMatrix();

  // Back to front: the last thing drawn is the first thing pressed.
  for (let i = candidates.length - 1; i >= 0; i -= 1) {
    const obj = candidates[i];
    const px = world.x + camera.scrollX * obj.scrollFactorX - camera.scrollX;
    const py = world.y + camera.scrollY * obj.scrollFactorY - camera.scrollY;

    if (obj.parentContainer) {
      obj.getWorldTransformMatrix(matrix, parentMatrix);
      matrix.applyInverse(px, py, point);
    } else {
      Phaser.Math.TransformXY(px, py, obj.x, obj.y, obj.rotation, obj.scaleX, obj.scaleY, point);
    }

    const input = obj.input;
    if (!input) continue;
    if (input.hitAreaCallback(input.hitArea, point.x + obj.displayOriginX, point.y + obj.displayOriginY, obj)) {
      return obj;
    }
  }
  return undefined;
}

/**
 * Installs the net on one scene. Safe to call on every scene create: the
 * listeners live on the scene's input plugin, which drops them on shutdown.
 */
export function installInputFallback(scene: Phaser.Scene): void {
  const relay = (event: 'pointerdown' | 'pointerup') => (pointer: Phaser.Input.Pointer): void => {
    // Phaser found something, so Phaser is dispatching it. Nothing to do.
    if (scene.input.hitTestPointer(pointer).length > 0) return;
    const target = hitTest(scene, pointer);
    if (!target) return;
    target.emit(event, pointer, target.input?.localX ?? 0, target.input?.localY ?? 0);
    scene.input.emit(event === 'pointerdown' ? 'gameobjectdown' : 'gameobjectup', pointer, target);
  };

  scene.input.on('pointerdown', relay('pointerdown'));
  scene.input.on('pointerup', relay('pointerup'));
}

/**
 * Installs the net on every scene in the game, now and on each restart.
 *
 * Scenes do not exist yet when the game is constructed - the scene manager
 * boots its queue on the game's READY event - so this waits for that, while
 * still handling a game that is already running.
 */
export function installInputFallbackEverywhere(game: Phaser.Game): void {
  const attach = (): void => {
    for (const scene of game.scene.scenes) {
      const marked = scene as unknown as Record<symbol, boolean>;
      if (marked[INSTALLED]) continue;
      marked[INSTALLED] = true;
      scene.events.on(Phaser.Scenes.Events.CREATE, () => installInputFallback(scene));
      if (scene.sys.isActive() && scene.input) installInputFallback(scene);
    }
  };
  // Registered after the scene manager's own READY listener, so by the time
  // this runs the scene list is populated.
  game.events.on(Phaser.Core.Events.READY, attach);
  attach();
}

/**
 * What the net would hit for this pointer, and how many interactive objects it
 * can see at all. Used by the on-screen touch debug so a device that will not
 * respond can say whether the objects exist and where the press lands on them.
 */
export function describeFallbackHit(scene: Phaser.Scene, pointer: Phaser.Input.Pointer): string {
  const camera = scene.cameras.main;
  const candidates: Interactive[] = [];
  if (camera) collect(scene.children.list, camera, candidates);
  const target = hitTest(scene, pointer);
  const holder = target as unknown as { list?: Array<{ type: string; text?: string }> } | undefined;
  const name = target ? (holder?.list?.find((c) => c.type === 'Text')?.text ?? target.type) : 'NOTHING';
  return `${name} (of ${candidates.length})`;
}
