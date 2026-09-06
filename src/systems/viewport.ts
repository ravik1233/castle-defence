/**
 * Viewport fitting.
 *
 * Mobile browsers make `height: 100%` a lie: it resolves against the *layout*
 * viewport, which includes the strip behind a collapsing URL bar. The canvas
 * then ends up taller than the screen, so everything is drawn slightly higher
 * than it appears and every tap lands short of its target.
 *
 * The fix is to size the game container from the *visual* viewport, and to
 * re-measure whenever the browser changes its mind about how big that is -
 * which on iOS happens on scroll, on rotate, on keyboard show/hide, and a
 * beat or two after first paint.
 */
import type Phaser from 'phaser';

function viewportSize(): { width: number; height: number } {
  const vv = window.visualViewport;
  return {
    width: Math.round(vv?.width ?? window.innerWidth),
    height: Math.round(vv?.height ?? window.innerHeight),
  };
}

export function installViewportFit(game: Phaser.Game, parentId = 'game'): void {
  const parent = document.getElementById(parentId);
  let last = '';

  const apply = (): void => {
    const { width, height } = viewportSize();
    const key = `${width}x${height}`;
    if (parent) {
      parent.style.width = `${width}px`;
      parent.style.height = `${height}px`;
    }
    // refresh() re-measures the canvas rect, which is what input maps through.
    game.scale.setParentSize(width, height);
    game.scale.refresh();
    if (key !== last) {
      last = key;
      game.events.emit('viewportchange', width, height);
    }
  };

  apply();

  for (const event of ['resize', 'orientationchange', 'pageshow'] as const) {
    window.addEventListener(event, apply, { passive: true });
  }
  window.visualViewport?.addEventListener('resize', apply, { passive: true });
  window.visualViewport?.addEventListener('scroll', apply, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) apply();
  });

  // Mobile browsers settle their chrome after first paint, so re-measure for
  // the first couple of seconds rather than trusting the initial numbers.
  for (const delay of [100, 300, 600, 1200, 2500]) {
    setTimeout(apply, delay);
  }

  if (typeof ResizeObserver !== 'undefined' && parent) {
    new ResizeObserver(() => game.scale.refresh()).observe(parent);
  }
}

/**
 * Draws a marker wherever the game thinks a pointer went down.
 * Enabled with ?touchdebug=1 - the fastest way to confirm a tap lands where
 * a finger actually is on a real device.
 */
export function installTouchDebug(game: Phaser.Game): void {
  const dot = document.createElement('div');
  dot.style.cssText =
    'position:fixed;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;' +
    'border:3px solid #5fd07a;background:rgba(95,208,122,.25);pointer-events:none;z-index:99999;' +
    'transition:opacity .5s ease;opacity:0';
  const label = document.createElement('div');
  label.style.cssText =
    'position:fixed;left:8px;bottom:8px;z-index:99999;color:#5fd07a;font:12px/1.4 monospace;' +
    'background:rgba(0,0,0,.6);padding:6px 8px;border-radius:6px;pointer-events:none';
  document.body.append(dot, label);

  window.addEventListener(
    'pointerdown',
    (e) => {
      dot.style.left = `${e.clientX}px`;
      dot.style.top = `${e.clientY}px`;
      dot.style.opacity = '1';
      setTimeout(() => (dot.style.opacity = '0'), 700);
      const scene = game.scene.getScenes(true)[0];
      const p = scene?.input.activePointer;
      const b = game.scale.canvasBounds;
      label.textContent =
        `screen ${Math.round(e.clientX)},${Math.round(e.clientY)}  ` +
        `game ${Math.round(p?.worldX ?? 0)},${Math.round(p?.worldY ?? 0)}\n` +
        `canvas ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}  ` +
        `dpr ${window.devicePixelRatio}`;
      label.style.whiteSpace = 'pre';
    },
    { passive: true },
  );
}
