/**
 * Imports painted art into the game.
 *
 *   node scripts/import-art.mjs [inputDir]     (default: art-in/)
 *
 * Drop PNGs named after the texture key they replace:
 *
 *   art-in/unit.orc.full.png       -> whole-body painted orc
 *   art-in/build.ballista.png      -> painted ballista
 *   art-in/bg.fields.png           -> painted battlefield backdrop
 *
 * For each file this script:
 *   1. knocks out a flat background colour if it finds one (image generators
 *      rarely produce real transparency, so the prompts ask for a solid
 *      chroma colour instead), including a de-spill pass on the edges
 *   2. trims transparent margins, so the character's feet end up exactly on
 *      the bottom edge - which is where the game anchors it
 *   3. writes the result into public/assets/painted/ and updates manifest.json
 *
 * Pixel work happens in Chromium because it is already here for the tests; no
 * native image dependency to install.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { launchBrowser } from './browser.mjs';

const inputDir = process.argv[2] ?? 'art-in';
const outDir = join('public', 'assets', 'painted');
const manifestPath = join(outDir, 'manifest.json');

if (!existsSync(inputDir)) {
  console.error(`No input folder at ${inputDir}. Create it and drop your PNGs in.`);
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const files = readdirSync(inputDir).filter((f) => /\.(png|webp|jpg|jpeg)$/i.test(f));
if (files.length === 0) {
  console.error(`No images in ${inputDir}.`);
  process.exit(1);
}

const browser = await launchBrowser();
const page = await browser.newPage();
await page.setContent('<body style="margin:0"></body>');

const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8'))
  : {};

for (const file of files) {
  const key = basename(file, extname(file));
  const dataUri = `data:image/${extname(file).slice(1).replace('jpg', 'jpeg')};base64,${readFileSync(join(inputDir, file)).toString('base64')}`;

  const result = await page.evaluate(async ({ src, isBackdrop }) => {
    const img = new Image();
    img.src = src;
    await img.decode();

    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);
    const px = data.data;

    let removed = 0;
    if (!isBackdrop) {
      // Sample the corners: if they agree, that colour is the background.
      const corner = (x, y) => {
        const i = (y * c.width + x) * 4;
        return [px[i], px[i + 1], px[i + 2], px[i + 3]];
      };
      const corners = [
        corner(0, 0),
        corner(c.width - 1, 0),
        corner(0, c.height - 1),
        corner(c.width - 1, c.height - 1),
      ];
      const alreadyTransparent = corners.every((p) => p[3] < 16);
      if (!alreadyTransparent) {
        const near = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 60;
        const agree = corners.filter((p) => near(p, corners[0])).length;
        if (agree >= 3) {
          const [br, bg, bb] = corners[0];
          // Distance-based key with a soft edge, so hair and cloth keep detail.
          const hard = 70;
          const soft = 150;
          for (let i = 0; i < px.length; i += 4) {
            const d = Math.hypot(px[i] - br, px[i + 1] - bg, px[i + 2] - bb);
            if (d < hard) {
              px[i + 3] = 0;
              removed += 1;
            } else if (d < soft) {
              const t = (d - hard) / (soft - hard);
              px[i + 3] = Math.round(px[i + 3] * t);
              // De-spill: pull the pixel away from the background colour.
              px[i] = Math.round(px[i] + (px[i] - br) * (1 - t) * 0.6);
              px[i + 1] = Math.round(px[i + 1] + (px[i + 1] - bg) * (1 - t) * 0.6);
              px[i + 2] = Math.round(px[i + 2] + (px[i + 2] - bb) * (1 - t) * 0.6);
            }
          }
        }
      }
      ctx.putImageData(data, 0, 0);
    }

    const alpha = ctx.getImageData(0, 0, c.width, c.height).data;

    // Column occupancy, used both to trim and to spot a multi-up sheet.
    const solidCols = new Array(c.width).fill(0);
    let minY = c.height;
    let maxY = -1;
    for (let y = 0; y < c.height; y += 1) {
      for (let x = 0; x < c.width; x += 1) {
        if (alpha[(y * c.width + x) * 4 + 3] > 8) {
          solidCols[x] += 1;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxY < 0) return { error: 'image is fully transparent after keying' };

    /*
     * Image models like to answer "a character" with a sheet of three poses.
     * Trimming that to its content bounds would import all three as one
     * sprite, so runs of empty columns are treated as gaps between figures
     * and the widest figure is taken.
     */
    const gapThreshold = Math.max(6, Math.round(c.width * 0.012));
    const islands = [];
    let runStart = -1;
    let emptyRun = 0;
    for (let x = 0; x <= c.width; x += 1) {
      const filled = x < c.width && solidCols[x] > 0;
      if (filled) {
        if (runStart < 0) runStart = x;
        emptyRun = 0;
      } else if (runStart >= 0) {
        emptyRun += 1;
        if (emptyRun >= gapThreshold || x === c.width) {
          islands.push([runStart, x - emptyRun]);
          runStart = -1;
          emptyRun = 0;
        }
      }
    }
    const wide = islands.filter(([a, b]) => b - a > c.width * 0.06);
    const chosen = wide.length
      ? wide.reduce((best, cur) => (cur[1] - cur[0] > best[1] - best[0] ? cur : best))
      : [0, c.width - 1];
    const minX = chosen[0];
    const maxX = chosen[1];

    // Vertical bounds of the chosen figure only.
    minY = c.height;
    maxY = -1;
    for (let y = 0; y < c.height; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        if (alpha[(y * c.width + x) * 4 + 3] > 8) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          break;
        }
      }
    }

    const tw = maxX - minX + 1;
    const th = maxY - minY + 1;
    const out = document.createElement('canvas');
    out.width = tw;
    out.height = th;
    out.getContext('2d').drawImage(c, minX, minY, tw, th, 0, 0, tw, th);

    return {
      png: out.toDataURL('image/png'),
      width: tw,
      height: th,
      source: `${img.width}x${img.height}`,
      keyed: removed > 0,
      figures: wide.length,
    };
  }, { src: dataUri, isBackdrop: key.startsWith('bg.') });

  if (result.error) {
    console.error(`  ${key}: ${result.error}`);
    continue;
  }

  const outName = `${key}.png`;
  writeFileSync(join(outDir, outName), Buffer.from(result.png.split(',')[1], 'base64'));
  manifest[key] = outName;
  console.log(
    `  ${key}: ${result.source} -> ${result.width}x${result.height}` +
      (result.keyed ? ' (background removed)' : '') +
      (result.figures > 1 ? ` (sheet of ${result.figures}, took the widest)` : ''),
  );
}

manifest._comment =
  'Generated by scripts/import-art.mjs. Maps a texture key to a PNG in this folder. See docs/GEMINI_ART_PROMPTS.md.';
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await browser.close();
console.log(`\nWrote ${Object.keys(manifest).length - 1} entries to ${manifestPath}`);
console.log('Run `npm run dev` and the painted art replaces the vector art immediately.');
