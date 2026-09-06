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
import { frameScales } from './lib/strip.mjs';

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
  /**
   * Knocks out the flat chroma background and returns the keyed canvas.
   *
   * Compared on chromaticity - each channel as a fraction of the pixel's own
   * total - which is what makes this work at all.
   *
   * Plain RGB distance puts a grey steel helmet only ~144 from this green,
   * near enough that any key wide enough to catch shaded background also eats
   * the helmet, and a half-transparent helmet reads as a washed-out one.
   * Channel differences fix that but fail the other way: they shrink as a
   * colour darkens, so the dark green that JPEG smears along every outline
   * survives as a bright halo. A fraction of the total does not change when a
   * pixel is merely lighter or darker, so both cases come out right.
   */
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
    const bSum = br + bg + bb || 1;
    const bcr = br / bSum;
    const bcg = bg / bSum;
    // Chromaticity distances, so these are small numbers. A pure chroma screen
    // sits a long way from anything in a painted character.
    const hard = 0.1;
    const soft = 0.26;
    for (let i = 0; i < px.length; i += 4) {
      const sum = px[i] + px[i + 1] + px[i + 2] || 1;
      const d = Math.hypot(px[i] / sum - bcr, px[i + 1] / sum - bcg);
      if (d < hard) {
        px[i + 3] = 0;
      } else if (d < soft) {
        const t = (d - hard) / (soft - hard);
        px[i + 3] = Math.round(px[i + 3] * t);
        // De-spill, or every edge keeps a green rim against a dark battlefield.
        px[i] = Math.round(px[i] + (px[i] - br) * (1 - t) * 0.6);
        px[i + 1] = Math.round(px[i + 1] + (px[i + 1] - bg) * (1 - t) * 0.6);
        px[i + 2] = Math.round(px[i + 2] + (px[i + 2] - bb) * (1 - t) * 0.6);
      }
    }
    /*
     * Then shave one pixel off every edge. JPEG smears the background a little
     * way into the outline, and those pixels are genuinely part-background -
     * no threshold separates them from the outline itself, but nothing is lost
     * by dropping the outermost ring, and the last of the green rim goes with
     * it. Only partly-transparent pixels are touched, so solid art is safe.
     */
    const w = c.width;
    const h = c.height;
    const alpha = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i += 1) alpha[i] = px[i * 4 + 3];
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = y * w + x;
        if (alpha[i] === 0 || alpha[i] > 235) continue;
        const bare =
          (x > 0 && alpha[i - 1] === 0) ||
          (x < w - 1 && alpha[i + 1] === 0) ||
          (y > 0 && alpha[i - w] === 0) ||
          (y < h - 1 && alpha[i + w] === 0);
        if (bare) px[i * 4 + 3] = 0;
      }
    }

    ctx.putImageData(data, 0, 0);
    return c;
  };

  /**
   * Connected components over the alpha channel: one per drawn shape.
   *
   * Column occupancy looked simpler and was wrong. An attacking spear reaches
   * across the background into the next pose's columns, so whole figures fuse
   * together; shapes do not care where they sit.
   */
  window.__islands = (c) => {
    const { width: w, height: h } = c;
    const px = c.getContext('2d').getImageData(0, 0, w, h).data;
    const seen = new Uint8Array(w * h);
    const labels = new Int32Array(w * h).fill(-1);
    const stack = new Int32Array(w * h);
    const out = [];

    for (let start = 0; start < w * h; start += 1) {
      if (seen[start] || px[start * 4 + 3] <= 24) continue;
      let top = 0;
      stack[top] = start;
      top += 1;
      seen[start] = 1;
      const id = out.length;
      let minX = w;
      let maxX = -1;
      let minY = h;
      let maxY = -1;
      let area = 0;

      while (top > 0) {
        top -= 1;
        const p = stack[top];
        labels[p] = id;
        const x = p % w;
        const y = (p - x) / w;
        area += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const n = ny * w + nx;
            if (seen[n] || px[n * 4 + 3] <= 24) continue;
            seen[n] = 1;
            stack[top] = n;
            top += 1;
          }
        }
      }
      out.push({ id, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area });
    }
    window.__labels = labels;
    window.__labelW = w;
    return out;
  };

  /**
   * Draws one pose onto a fixed canvas, centred and standing on the floor.
   *
   * Masked to the shapes that belong to this pose: the pose beside it may have
   * a spear passing straight through this one's box, and importing the tip of
   * a neighbour's weapon would be worse than any seam.
   */
  window.__frame = (box, ids, scale, cw, ch, anchor) => {
    const raw = document.createElement('canvas');
    raw.width = box.w;
    raw.height = box.h;
    const rctx = raw.getContext('2d', { willReadFrequently: true });
    rctx.drawImage(window.__sheet, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
    const data = rctx.getImageData(0, 0, box.w, box.h);
    const px = data.data;
    const mine = new Set(ids);
    const labels = window.__labels;
    const lw = window.__labelW;
    for (let y = 0; y < box.h; y += 1) {
      for (let x = 0; x < box.w; x += 1) {
        if (!mine.has(labels[(box.y + y) * lw + (box.x + x)])) px[(y * box.w + x) * 4 + 3] = 0;
      }
    }
    rctx.putImageData(data, 0, 0);

    const out = document.createElement('canvas');
    out.width = cw;
    out.height = ch;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    const dw = Math.round(box.w * scale);
    const dh = Math.round(box.h * scale);
    ctx.drawImage(raw, 0, 0, box.w, box.h, anchor, ch - dh, dw, dh);
    return out.toDataURL('image/png');
  };
});

/**
 * Assigns every drawn shape to a pose.
 *
 * The biggest shapes are the figures - a body dwarfs a dropped weapon - so
 * they set the poses, ordered left to right. Everything else joins whichever
 * figure it sits nearest, which puts a fallen spear back with the man who
 * dropped it and leaves a neighbour's reaching weapon where it belongs.
 */
function groupIntoPoses(islands, want) {
  const biggest = islands.reduce((m, p) => Math.max(m, p.area), 0);
  const real = islands.filter((p) => p.area > biggest * 0.01);
  const figures = [...real].sort((a, b) => b.area - a.area).slice(0, want);
  figures.sort((a, b) => a.x + a.w / 2 - (b.x + b.w / 2));

  const poses = figures.map((f) => ({ ids: [f.id], boxes: [f], cx: f.x + f.w / 2 }));
  for (const p of real) {
    if (figures.includes(p)) continue;
    const cx = p.x + p.w / 2;
    let best = poses[0];
    for (const pose of poses) {
      if (Math.abs(cx - pose.cx) < Math.abs(cx - best.cx)) best = pose;
    }
    best.ids.push(p.id);
    best.boxes.push(p);
  }

  return poses.map((pose, i) => {
    const x0 = Math.min(...pose.boxes.map((b) => b.x));
    const y0 = Math.min(...pose.boxes.map((b) => b.y));
    const x1 = Math.max(...pose.boxes.map((b) => b.x + b.w));
    const y1 = Math.max(...pose.boxes.map((b) => b.y + b.h));
    // The figure, kept apart from the box: a pose is measured and lined up by
    // its body, never by a weapon that happens to reach further this frame.
    const figure = figures[i];
    return {
      ids: pose.ids,
      box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 },
      figure: { cx: figure.x + figure.w / 2, bottom: figure.y + figure.h, h: figure.h },
    };
  });
}

for (const file of strips) {
  const key = basename(file).replace(/\.frames\.(png|jpe?g|webp)$/i, '');
  const ext = file.split('.').pop().toLowerCase().replace('jpg', 'jpeg');
  const src = `data:image/${ext};base64,${readFileSync(join(inputDir, file)).toString('base64')}`;

  const islands = await page.evaluate(async (dataUri) => {
    const img = new Image();
    img.src = dataUri;
    await img.decode();
    const c = window.__key(img);
    window.__sheet = c;
    return window.__islands(c);
  }, src);

  const poses = groupIntoPoses(islands, FRAME_NAMES.length);
  if (poses.length < FRAME_NAMES.length) {
    console.error(
      `  ${key}: only ${poses.length} figures found, expected ${FRAME_NAMES.length}.` +
        ' Two poses are touching; the strip needs regenerating.',
    );
    continue;
  }

  const boxes = poses.map((p) => p.box);
  // Scale on the body's height, not the box's. A frame whose spear reaches
  // above the helmet would otherwise be shrunk to make room for it.
  const scales = frameScales(poses.map((p) => p.figure.h), FIGURE_HEIGHT);
  const upright = boxes.slice(0, boxes.length - 1);

  // One canvas size for every frame, so the game can swap them without moving.
  // Wide enough for the furthest reach on either side of the body, tall
  // enough for the tallest pose - one size, so nothing jumps between frames.
  const left = Math.max(...poses.map((p, i) => (p.figure.cx - p.box.x) * scales[i]));
  const right = Math.max(...poses.map((p, i) => (p.box.x + p.box.w - p.figure.cx) * scales[i]));
  const cw = Math.ceil(left + right);
  const ch = Math.ceil(Math.max(...boxes.map((b, i) => b.h * scales[i])));

  for (const [i, pose] of poses.entries()) {
    const png = await page.evaluate(
      ({ b, ids, s, w, h, anchor }) => window.__frame(b, ids, s, w, h, anchor),
      {
        b: pose.box,
        ids: pose.ids,
        s: scales[i],
        w: cw,
        h: ch,
        // Where the body's centre line must land, so it stays put frame to frame.
        anchor: Math.round(left - (pose.figure.cx - pose.box.x) * scales[i]),
      },
    );
    const outName = `${key}.frame${i}.png`;
    writeFileSync(join(outDir, outName), Buffer.from(png.split(',')[1], 'base64'));
    manifest[`${key}.frame${i}`] = outName;
  }

  manifest[`${key}.frames`] = {
    count: poses.length,
    width: cw,
    height: ch,
    names: FRAME_NAMES.slice(0, poses.length),
  };

  const drift = Math.round((Math.max(...upright.map((b) => b.h)) / Math.min(...upright.map((b) => b.h)) - 1) * 100);
  console.log(
    `  ${key}: ${poses.length} poses from ${islands.length} shapes -> ${cw}x${ch}` +
      (drift > 3 ? `  (${drift}% size drift, normalised out)` : ''),
  );
}

manifest._comment =
  'Texture key -> file in this folder. A *.rig entry is a painted parts assembly; a *.frames entry is a drawn animation strip. Written by the scripts/import-*.mjs tools.';
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await browser.close();
console.log(`\n${strips.length} strip(s) imported.`);
