/**
 * Imports painted animation strips - one row of drawn poses - into game frames.
 *
 *   node scripts/import-frames.mjs [inputDir]     (default: art-in/)
 *
 * Reads art-in/unit.<id>.frames.png and writes public/assets/painted/
 * unit.<id>.frame0.png ... plus a `unit.<id>.frames` manifest entry. The rig
 * plays those instead of assembling a puppet, so nothing has to guess where a
 * joint sits inside a painted limb.
 *
 * Registration is the whole job. An image generator draws each pose at a
 * slightly different size and a slightly different height, and a frame that
 * is 10% taller than its neighbour makes the unit throb as it walks. So every
 * frame is trimmed to its own content, the upright poses are scaled to a
 * common height, and all of them are seated on one ground line.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { launchBrowser } from './browser.mjs';
import { frameScales, mergeToCount, splitPoses } from './lib/strip.mjs';

const inputDir = process.argv[2] ?? 'art-in';
const outDir = join('public', 'assets', 'painted');
const previewDir = join('art-in', 'frames-preview');
const manifestPath = join(outDir, 'manifest.json');

/** Height in pixels of the standing figure. Twice what a phone draws. */
const FIGURE_HEIGHT = 320;

/** What each frame of a five-pose strip is for. */
const FRAME_NAMES = ['idle', 'walkA', 'walkB', 'attack', 'die'];

const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
mkdirSync(outDir, { recursive: true });
mkdirSync(previewDir, { recursive: true });

const strips = readdirSync(inputDir).filter((f) => /\.frames\.(png|jpe?g|webp)$/i.test(f)).sort();
if (strips.length === 0) {
  console.error(`No *.frames.png in ${inputDir}.`);
  process.exit(1);
}

const browser = await launchBrowser();
const page = await browser.newPage();
await page.setContent('<body style="margin:0"></body>');

await page.evaluate(() => {
  /** Knocks out the flat chroma background and returns the keyed canvas. */
  window.__key = (img) => {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const px = data.data;
    const at = (x, y) => {
      const i = (y * c.width + x) * 4;
      return [px[i], px[i + 1], px[i + 2]];
    };
    const corners = [at(0, 0), at(c.width - 1, 0), at(0, c.height - 1), at(c.width - 1, c.height - 1)];
    const near = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 60;
    if (corners.filter((p) => near(p, corners[0])).length < 3) return c;

    const [br, bg, bb] = corners[0];
    /*
     * A wider key than the parts sheets use. A strip often carries a patch of
     * ground under a falling figure, painted a shade off the background, and
     * a narrow key leaves it behind as a green scab stuck to the boots.
     */
    const hard = 100;
    const soft = 175;
    for (let i = 0; i < px.length; i += 4) {
      const d = Math.hypot(px[i] - br, px[i + 1] - bg, px[i + 2] - bb);
      if (d < hard) {
        px[i + 3] = 0;
      } else if (d < soft) {
        const t = (d - hard) / (soft - hard);
        px[i + 3] = Math.round(px[i + 3] * t);
        px[i] = Math.round(px[i] + (px[i] - br) * (1 - t) * 0.6);
        px[i + 1] = Math.round(px[i + 1] + (px[i + 1] - bg) * (1 - t) * 0.6);
        px[i + 2] = Math.round(px[i + 2] + (px[i + 2] - bb) * (1 - t) * 0.6);
      }
    }
    ctx.putImageData(data, 0, 0);
    return c;
  };

  /**
   * Splits a keyed strip into poses.
   *
   * Column occupancy rather than connected regions: a dropped weapon lying
   * apart from its dying owner is still part of that pose, and treating every
   * separate shape as its own frame would make six poses out of five.
   */
  window.__columns = (c) => {
    const { width: w, height: h } = c;
    const px = c.getContext('2d').getImageData(0, 0, w, h).data;
    const filled = new Array(w).fill(0);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (px[(y * w + x) * 4 + 3] > 24) filled[x] += 1;
      }
    }
    return { filled, width: w, height: h };
  };

  /** Content bounds of one column range, so a pose can be trimmed and seated. */
  window.__bounds = (c, x0, x1) => {
    const { width: w, height: h } = c;
    const px = c.getContext('2d').getImageData(0, 0, w, h).data;
    let minX = x1;
    let maxX = x0;
    let minY = h;
    let maxY = -1;
    for (let y = 0; y < h; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        if (px[(y * w + x) * 4 + 3] > 24) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  };

  /** Draws one pose onto a fixed canvas, centred and standing on the floor. */
  window.__frame = (box, scale, cw, ch) => {
    const out = document.createElement('canvas');
    out.width = cw;
    out.height = ch;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    const dw = Math.round(box.w * scale);
    const dh = Math.round(box.h * scale);
    ctx.drawImage(window.__sheet, box.x, box.y, box.w, box.h, Math.round((cw - dw) / 2), ch - dh, dw, dh);
    return out.toDataURL('image/png');
  };
});

for (const file of strips) {
  const key = basename(file).replace(/\.frames\.(png|jpe?g|webp)$/i, '');
  const ext = file.split('.').pop().toLowerCase().replace('jpg', 'jpeg');
  const src = `data:image/${ext};base64,${readFileSync(join(inputDir, file)).toString('base64')}`;

  const strip = await page.evaluate(async (dataUri) => {
    const img = new Image();
    img.src = dataUri;
    await img.decode();
    const c = window.__key(img);
    window.__sheet = c;
    return window.__columns(c);
  }, src);

  const split = splitPoses(strip.filled, strip.width);
  const runs = mergeToCount(split, FRAME_NAMES.length);
  if (split.length < FRAME_NAMES.length) {
    // Too few means two figures are touching, and nothing here can separate
    // them - that one has to be drawn again.
    console.error(
      `  ${key}: only ${split.length} separate shapes, expected ${FRAME_NAMES.length}.` +
        ' Two poses are touching; the strip needs regenerating.',
    );
  }

  const boxes = [];
  for (const [x0, x1] of runs) {
    boxes.push(await page.evaluate(({ a, b }) => window.__bounds(window.__sheet, a, b), { a: x0, b: x1 }));
  }
  if (boxes.length === 0) {
    console.error(`  ${key}: nothing found after keying`);
    continue;
  }

  const upright = boxes.slice(0, Math.max(1, boxes.length - 1));
  const scales = frameScales(boxes.map((b) => b.h), FIGURE_HEIGHT);

  // One canvas size for every frame, so the game can swap them without moving.
  const cw = Math.ceil(Math.max(...boxes.map((b, i) => b.w * scales[i])));
  const ch = Math.ceil(Math.max(...boxes.map((b, i) => b.h * scales[i])));

  for (const [i, box] of boxes.entries()) {
    const png = await page.evaluate(
      ({ b, s, w, h }) => window.__frame(b, s, w, h),
      { b: box, s: scales[i], w: cw, h: ch },
    );
    const outName = `${key}.frame${i}.png`;
    writeFileSync(join(outDir, outName), Buffer.from(png.split(',')[1], 'base64'));
    manifest[`${key}.frame${i}`] = outName;
  }

  manifest[`${key}.frames`] = {
    count: boxes.length,
    width: cw,
    height: ch,
    names: FRAME_NAMES.slice(0, boxes.length),
  };

  const drift = Math.round((Math.max(...upright.map((b) => b.h)) / Math.min(...upright.map((b) => b.h)) - 1) * 100);
  console.log(
    `  ${key}: ${boxes.length} poses -> ${cw}x${ch}` +
      (drift > 3 ? `  (${drift}% size drift across the strip, normalised out)` : ''),
  );
}

manifest._comment =
  'Texture key -> file in this folder. A *.rig entry is a painted parts assembly; a *.frames entry is a drawn animation strip. Written by the scripts/import-*.mjs tools.';
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await browser.close();
console.log(`\n${strips.length} strip(s) imported.`);
