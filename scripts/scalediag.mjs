/** Dumps Phaser's scale internals across device pixel ratios. A fractional
 *  dpr (Windows at 125%) is the one case the touch tests never covered. */
import { launchBrowser } from './browser.mjs';
const base = process.argv[2] ?? 'http://localhost:5199';
const b = await launchBrowser();
for (const dpr of [1, 1.25, 1.5, 2, 2.5]) {
  const p = await b.newPage({ viewport: { width: 1466, height: 716 }, deviceScaleFactor: dpr });
  await p.goto(`${base}/`, { waitUntil: 'load' });
  await p.waitForFunction(
    () => globalThis.__game?.scene.getScenes(true)[0]?.scene.key === 'MainMenu',
    { timeout: 180000 },
  );
  await p.waitForTimeout(1200);
  const d = await p.evaluate(() => {
    const g = globalThis.__game;
    const s = g.scale;
    const cam = g.scene.getScenes(true)[0].cameras.main;
    const r = g.canvas.getBoundingClientRect();
    return {
      game: `${s.gameSize.width}x${s.gameSize.height}`,
      base: `${Math.round(s.baseSize.width)}x${Math.round(s.baseSize.height)}`,
      display: `${Math.round(s.displaySize.width)}x${Math.round(s.displaySize.height)}`,
      canvasAttr: `${g.canvas.width}x${g.canvas.height}`,
      canvasCss: `${Math.round(r.width)}x${Math.round(r.height)}`,
      zoom: s.zoom,
      dispScale: s.displayScale.x.toFixed(4),
      camZoom: cam.zoom,
      camSize: `${Math.round(cam.width)}x${Math.round(cam.height)}`,
      renderer: g.renderer.type === 2 ? 'WEBGL' : 'CANVAS',
    };
  });
  console.log(`dpr ${dpr}:`, JSON.stringify(d));
  await p.close();
}
await b.close();
