/**
 * Normalise an image-generated grid into a Phaser-ready packed sprite sheet.
 *
 * Image generators rarely return dimensions divisible by the requested grid.
 * This tool samples the source on fractional cell boundaries, contains every
 * pose in an exact square cell, preserves alpha, and registers a standard
 * 4x2 or 4x4 action map in the painted-art manifest.
 *
 *   node scripts/import-packed-sheet.mjs input.png militia 256 2
 */
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchBrowser } from './browser.mjs';

const [input, artId, sizeArg = '256', rowsArg = '4'] = process.argv.slice(2);
if (!input || !artId) {
  console.error('Usage: node scripts/import-packed-sheet.mjs <input.png> <art-id> [cell-size] [rows]');
  process.exit(1);
}

const cellSize = Number(sizeArg);
const rows = Number(rowsArg);
if (!Number.isInteger(cellSize) || cellSize < 128 || cellSize > 1024) {
  console.error('Cell size must be an integer from 128 to 1024.');
  process.exit(1);
}
if (rows !== 2 && rows !== 4) {
  console.error('Rows must be 2 (eight frames) or 4 (sixteen frames).');
  process.exit(1);
}

const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.setContent('<body></body>');
  const src = `data:image/png;base64,${readFileSync(input).toString('base64')}`;
  const result = await page.evaluate(async ({ src, cellSize, rows }) => {
    const image = new Image();
    image.src = src;
    await image.decode();

    const cols = 4;
    const source = document.createElement('canvas');
    source.width = image.width;
    source.height = image.height;
    const sourceCtx = source.getContext('2d', { willReadFrequently: true });
    sourceCtx.drawImage(image, 0, 0);
    const pixels = sourceCtx.getImageData(0, 0, image.width, image.height).data;

    const alpha = (x, y) => pixels[(y * image.width + x) * 4 + 3];
    const bestSplit = (expected, radius, occupancy) => {
      let best = expected;
      let bestScore = Infinity;
      let bestInk = Infinity;
      const start = Math.max(1, Math.floor(expected - radius));
      const end = Math.min(Math.ceil(expected + radius), occupancy.length - 2);
      for (let p = start; p <= end; p += 1) {
        const ink = occupancy[p];
        // Prefer a transparent gutter, then the closest low-ink column/row.
        const score = ink * 1000 + Math.abs(p - expected);
        if (score < bestScore) {
          best = p;
          bestInk = ink;
          bestScore = score;
        }
      }
      return { position: best, ink: bestInk };
    };

    // Generated grids are approximate. Find the low-ink horizontal gutters
    // around the expected quarter marks before splitting the rows.
    const rowInk = new Array(image.height).fill(0);
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) if (alpha(x, y) > 8) rowInk[y] += 1;
    }
    const rowCuts = [0];
    const crossings = [];
    for (let row = 1; row < rows; row += 1) {
      const split = bestSplit((row * image.height) / rows, image.height * 0.07, rowInk);
      rowCuts.push(split.position);
      crossings.push({ axis: 'row', index: row, ink: split.ink });
    }
    rowCuts.push(image.height);

    const canvas = document.createElement('canvas');
    canvas.width = cols * cellSize;
    canvas.height = rows * cellSize;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    for (let row = 0; row < rows; row += 1) {
      const sy0 = rowCuts[row];
      const sy1 = rowCuts[row + 1];
      const colInk = new Array(image.width).fill(0);
      for (let x = 0; x < image.width; x += 1) {
        for (let y = sy0; y < sy1; y += 1) if (alpha(x, y) > 8) colInk[x] += 1;
      }
      const colCuts = [0];
      for (let col = 1; col < cols; col += 1) {
        const split = bestSplit((col * image.width) / cols, image.width * 0.08, colInk);
        colCuts.push(split.position);
        crossings.push({ axis: `row ${row + 1}`, index: col, ink: split.ink });
      }
      colCuts.push(image.width);

      for (let col = 0; col < cols; col += 1) {
        const sx0 = colCuts[col];
        const sx1 = colCuts[col + 1];
        const sw = sx1 - sx0;
        const sh = sy1 - sy0;
        // Keep a transparent safety gutter. A weapon touching the cell edge
        // bleeds into the next Phaser frame when texture filtering is active.
        const padding = Math.max(6, Math.round(cellSize * 0.025));
        const available = cellSize - padding * 2;
        const scale = Math.min(available / sw, available / sh);
        const dw = sw * scale;
        const dh = sh * scale;
        const dx = col * cellSize + (cellSize - dw) / 2;
        const dy = row * cellSize + (cellSize - dh) / 2;
        ctx.drawImage(image, sx0, sy0, sw, sh, dx, dy, dw, dh);
      }
    }
    return { png: canvas.toDataURL('image/png').split(',')[1], crossings };
  }, { src, cellSize, rows });

  const unsafe = result.crossings.filter((split) => split.ink > 2);
  if (unsafe.length) {
    console.error(`No clean gutter in ${artId}: ${JSON.stringify(unsafe)}`);
    process.exitCode = 1;
    process.exit(1);
  }

  const outDir = join('public', 'assets', 'painted');
  const filename = `unit.${artId}.sheet.png`;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, filename), Buffer.from(result.png, 'base64'));

  const manifestPath = join(outDir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  // A packed sheet supersedes the legacy one-file-per-pose set. Keeping those
  // entries would make Preload decode both versions and add dead weight to the
  // offline bundle even though Rig always chooses the packed animation.
  for (let frame = 0; frame < 64; frame += 1) {
    const key = `unit.${artId}.frame${frame}`;
    const legacy = manifest[key];
    if (typeof legacy !== 'string') continue;
    const legacyPath = join(outDir, legacy);
    if (existsSync(legacyPath)) unlinkSync(legacyPath);
    delete manifest[key];
  }
  const animations = rows === 2
    ? {
        idle: { frames: [0, 1], fps: 4 },
        walk: { frames: [2, 3], fps: 8 },
        attack: { frames: [4, 5], fps: 8 },
        cast: { frames: [4, 5], fps: 8 },
        hurt: { frames: [6], fps: 5 },
        spawn: { frames: [1, 0], fps: 5 },
        die: { frames: [6, 7], fps: 4 },
      }
    : {
        idle: { frames: [0, 1, 2, 3], fps: 5 },
        walk: { frames: [4, 5, 6, 7], fps: 10 },
        attack: { frames: [8, 9, 10, 11], fps: 12 },
        cast: { frames: [9, 10, 11], fps: 8 },
        hurt: { frames: [12], fps: 5 },
        spawn: { frames: [13, 0], fps: 7 },
        die: { frames: [14, 15], fps: 5 },
      };
  manifest[`unit.${artId}.frames`] = {
    sheet: filename,
    count: rows * 4,
    width: cellSize,
    height: cellSize,
    names: [],
    animations,
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Imported ${artId}: 4x${rows} source -> ${cellSize}px cells (${filename})`);
} finally {
  await browser.close();
}
