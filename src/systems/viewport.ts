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

/**
 * Phaser caches the canvas rect and only re-reads it on refresh. Any layout
 * change it does not hear about leaves input mapping to a stale rectangle,
 * which shows up as taps landing a fixed distance from their targets. This
 * compares the cached rect against the live one and heals it.
 *
 * Returns the discrepancy it found, for the debug overlay.
 */
export function reconcileBounds(game: Phaser.Game): number {
  const rect = game.canvas.getBoundingClientRect();
  const bounds = game.scale.canvasBounds;
  const drift = Math.max(
    Math.abs(rect.left + window.scrollX - bounds.x),
    Math.abs(rect.top + window.scrollY - bounds.y),
    Math.abs(rect.width - bounds.width),
    Math.abs(rect.height - bounds.height),
  );
  if (drift > 0.5) game.scale.refresh();
  return drift;
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

  // Last line of defence: re-measure before Phaser handles a press. The
  // listener is on capture, so the correction lands before the game sees the
  // event, and a getBoundingClientRect per press costs nothing.
  for (const event of ['pointerdown', 'touchstart', 'mousedown'] as const) {
    window.addEventListener(event, () => reconcileBounds(game), { capture: true, passive: true });
  }

  if (typeof ResizeObserver !== 'undefined' && parent) {
    new ResizeObserver(() => game.scale.refresh()).observe(parent);
  }
}

/**
 * The game is designed portrait. On a phone or tablet held sideways it would
 * otherwise be a narrow strip in the middle of a black screen, which reads as
 * broken rather than as a choice - so it asks to be turned. Desktop is left
 * alone: a laptop cannot be rotated, and a letterboxed portrait game in a
 * browser window is normal.
 */
export function installOrientationHint(): void {
  const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  if (!touch) return;

  const hint = document.createElement('div');
  hint.style.cssText =
    'position:fixed;inset:0;z-index:9998;display:none;place-content:center;justify-items:center;gap:18px;' +
    'background:#120c1a;color:#f4ecdd;text-align:center;font:600 18px/1.5 Fredoka,system-ui,sans-serif;padding:32px';
  hint.innerHTML =
    '<div style="font-size:64px;line-height:1">⟳</div>' +
    '<div style="font-size:22px;color:#f5c542;letter-spacing:.12em">TURN YOUR DEVICE</div>' +
    '<div style="opacity:.75;max-width:22em">The Last Gate is played in portrait.</div>';
  document.body.append(hint);

  const update = (): void => {
    const w = window.visualViewport?.width ?? innerWidth;
    const h = window.visualViewport?.height ?? innerHeight;
    // Only when clearly sideways, so a nearly-square tablet is left playable.
    hint.style.display = w > h * 1.2 ? 'grid' : 'none';
  };
  update();
  for (const event of ['resize', 'orientationchange'] as const) {
    window.addEventListener(event, update, { passive: true });
  }
  window.visualViewport?.addEventListener('resize', update, { passive: true });
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
      const r = game.canvas.getBoundingClientRect();
      // Where the game *should* land for this press, if the mapping is right.
      const expectX = ((e.clientX - r.left) / r.width) * game.scale.width;
      const expectY = ((e.clientY - r.top) / r.height) * game.scale.height;
      const errX = Math.round((p?.worldX ?? 0) - expectX);
      const errY = Math.round((p?.worldY ?? 0) - expectY);
      label.textContent =
        `screen ${Math.round(e.clientX)},${Math.round(e.clientY)}  ` +
        `game ${Math.round(p?.worldX ?? 0)},${Math.round(p?.worldY ?? 0)}\n` +
        `expected ${Math.round(expectX)},${Math.round(expectY)}   ERROR ${errX},${errY}\n` +
        `rect ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}\n` +
        `phaser ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)}\n` +
        `viewport ${innerWidth}x${innerHeight} dpr ${window.devicePixelRatio}`;
      dot.style.borderColor = Math.abs(errX) + Math.abs(errY) > 8 ? '#e8455c' : '#5fd07a';
      label.style.whiteSpace = 'pre';
    },
    { passive: true },
  );
}
