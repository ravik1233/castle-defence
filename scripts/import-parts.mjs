/**
 * Imports painted parts sheets - head, arms, torso, legs, weapon drawn as
 * separate pieces on a chroma background - into per-part game textures.
 *
 *   node scripts/import-parts.mjs [inputDir]     (default: art-in/)
 *
 * Reads art-in/unit.<id>.parts.png and writes public/assets/painted/
 * unit.<id>.<part>.png for each piece, plus an assembly in the manifest
 * saying where each piece hangs and what it pivots around. The rig then
 * animates them as a cut-out puppet, which is what makes a painted unit walk
 * and swing rather than bob about as one flat image.
 *
 * The sheet says nothing about how the pieces fit together, so the assembly
 * is synthesised from their proportions using the same humanoid rules the
 * vector rig uses.
 *
 * Classification is a heuristic and heuristics are wrong sometimes, so every
 * sheet also gets a labelled preview in art-in/parts-preview/ and any piece
 * can be corrected by hand in scripts/art-parts.json.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { launchBrowser } from './browser.mjs';

const inputDir = process.argv[2] ?? 'art-in';
const outDir = join('public', 'assets', 'painted');
const previewDir = join('art-in', 'parts-preview');
const manifestPath = join(outDir, 'manifest.json');
const overridesPath = join('scripts', 'art-parts.json');

/** Height in pixels of an assembled figure. Plenty for a phone at 2x. */
const FIGURE_HEIGHT = 512;

const overrides = existsSync(overridesPath) ? JSON.parse(readFileSync(overridesPath, 'utf8')) : {};
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};

mkdirSync(outDir, { recursive: true });
mkdirSync(previewDir, { recursive: true });

const sheets = readdirSync(inputDir).filter((f) => /\.parts\.(png|jpe?g|webp)$/i.test(f)).sort();
if (sheets.length === 0) {
  console.error(`No *.parts.png in ${inputDir}.`);
  process.exit(1);
}

const browser = await launchBrowser();
const page = await browser.newPage();
await page.setContent('<body style="margin:0"></body>');

/**
 * Everything that touches pixels runs in the page: Chromium is already here
 * for the tests, so there is no native image dependency to install.
 */
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
      return [px[i], px[i + 1], px[i + 2], px[i + 3]];
    };
    const corners = [
      at(0, 0),
      at(c.width - 1, 0),
      at(0, c.height - 1),
      at(c.width - 1, c.height - 1),
    ];
    if (corners.every((p) => p[3] < 16)) return c;
    const near = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 60;
    if (corners.filter((p) => near(p, corners[0])).length < 3) return c;

    const [br, bg, bb] = corners[0];
    const hard = 70;
    const soft = 150;
    for (let i = 0; i < px.length; i += 4) {
      const d = Math.hypot(px[i] - br, px[i + 1] - bg, px[i + 2] - bb);
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
    ctx.putImageData(data, 0, 0);
    return c;
  };

  /**
   * Connected components over the alpha channel: one per drawn piece.
   * Iterative flood fill - a sheet is a few million pixels and recursion
   * would blow the stack on the first large torso.
   */
  window.__islands = (c) => {
    const { width: w, height: h } = c;
    const px = c.getContext('2d').getImageData(0, 0, w, h).data;
    const seen = new Uint8Array(w * h);
    const out = [];
    const stack = new Int32Array(w * h);

    for (let start = 0; start < w * h; start += 1) {
      if (seen[start] || px[start * 4 + 3] <= 24) continue;
      let top = 0;
      stack[top] = start;
      top += 1;
      seen[start] = 1;
      let minX = w;
      let maxX = -1;
      let minY = h;
      let maxY = -1;
      let area = 0;

      while (top > 0) {
        top -= 1;
        const p = stack[top];
        const x = p % w;
        const y = (p - x) / w;
        area += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        // 8-connected: line art leaves diagonal single-pixel bridges.
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
      out.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, area });
    }
    return out;
  };
});

/**
 * Works out which piece is which.
 *
 * Sheets are laid out consistently enough to read geometrically: the torso is
 * the biggest piece, the head sits above it in the middle column, arms and
 * legs flank it, and the weapon lies along the bottom. Within one flank the
 * lowest piece is the leg and the one above it the arm; anything higher is a
 * wing or a cape, which the rig also has slots for.
 *
 * It is a heuristic, so every sheet gets a labelled preview and any piece can
 * be corrected by index in scripts/art-parts.json.
 */
function classify(islands, sheetW, byIndex) {
  const parts = islands.map((p, i) => ({ ...p, i, cx: p.x + p.w / 2, cy: p.y + p.h / 2 }));
  const named = new Map();
  const take = (part, name) => {
    if (part && !named.has(part.i)) named.set(part.i, name);
  };

  /*
   * The torso is the biggest piece drawn in the middle column - not simply the
   * biggest piece. A wing that overlaps an arm merges with it into one island
   * bigger than the torso, which is how the demon king ended up wearing a
   * forearm for a chest.
   */
  const middle = parts.filter((p) => Math.abs(p.cx - sheetW / 2) < sheetW * 0.1);
  const torso = (middle.length ? middle : parts).reduce((a, b) => (b.area > a.area ? b : a));
  take(torso, 'torso');

  const rest = parts.filter((p) => p !== torso);
  const central = rest.filter((p) => Math.abs(p.cx - torso.cx) < sheetW * 0.18);
  const sides = rest.filter((p) => !central.includes(p));

  // Middle column: head above, weapon and anything else below.
  const above = central.filter((p) => p.cy < torso.cy).sort((a, b) => b.area - a.area);
  take(above[0], 'head');

  const below = central.filter((p) => p.cy >= torso.cy).sort((a, b) => b.cy - a.cy);
  const longThin = (p) => Math.max(p.w, p.h) / Math.max(1, Math.min(p.w, p.h)) > 2.2;
  const weapon = below.find(longThin) ?? below[0];
  take(weapon, 'weapon');
  for (const p of below) take(p, 'offhand');

  // Each flank, bottom up: leg, then arm, then a wing or cape above that.
  for (const side of ['Back', 'Front']) {
    // The sheet is drawn facing right, so its right-hand column is the near side.
    const col = sides
      .filter((p) => (side === 'Front' ? p.cx > torso.cx : p.cx < torso.cx))
      .sort((a, b) => b.cy - a.cy);
    take(col[0], `leg${side}`);
    take(col[1], `arm${side}`);
    for (const p of col.slice(2)) take(p, side === 'Front' ? 'wings' : 'cape');
  }

  // Hand corrections win over all of it.
  for (const [i, name] of Object.entries(byIndex ?? {})) named.set(Number(i), name || null);

  return parts.map((p) => ({ ...p, name: named.get(p.i) ?? null }));
}

/**
 * Places the pieces into a figure.
 *
 * The sheet says nothing about assembly, so this is the standard humanoid
 * build the vector rig already uses: head above the torso with a little
 * overlap, arms hung from the shoulder line, legs from the hips. Coordinates
 * are in figure pixels measured up from the feet, which is where the game
 * anchors a unit.
 */
function assemble(byName) {
  const torso = byName.torso;
  const leg = byName.legFront ?? byName.legBack;
  const head = byName.head;
  if (!torso || !leg || !head) return null;

  // Pieces overlap where they join, so stacking their heights overstates it.
  const raw = head.h * 0.88 + torso.h + leg.h * 0.92;
  const scale = FIGURE_HEIGHT / raw;
  const s = (v) => v * scale;

  const hipY = -s(leg.h * 0.92);
  const shoulderY = hipY - s(torso.h) + s(torso.h * 0.14);
  // pivot is where in the piece its joint sits; x,y is where that joint lands.
  const layout = {
    torso: { x: 0, y: hipY, pivot: [0.5, 1] },
    head: { x: 0, y: hipY - s(torso.h * 0.96), pivot: [0.5, 1] },
    legBack: { x: -s(torso.w * 0.18), y: hipY, pivot: [0.5, 0.08] },
    legFront: { x: s(torso.w * 0.18), y: hipY, pivot: [0.5, 0.08] },
    armBack: { x: -s(torso.w * 0.42), y: shoulderY, pivot: [0.5, 0.1] },
    armFront: { x: s(torso.w * 0.42), y: shoulderY, pivot: [0.5, 0.1] },
    // These two are whatever was left over on each flank - a pair of wings on
    // a demon, robe panels on a shaman - so each hangs on the side it was
    // drawn on rather than both stacking behind the same shoulder.
    cape: { x: -s(torso.w * 0.32), y: shoulderY, pivot: [0.5, 0.28] },
    wings: { x: s(torso.w * 0.32), y: shoulderY, pivot: [0.5, 0.28] },
    offhand: { x: -s(torso.w * 0.5), y: shoulderY + s(torso.h * 0.4), pivot: [0.5, 0.5] },
    weapon: { x: s(torso.w * 0.62), y: shoulderY + s(torso.h * 0.55), pivot: [0.16, 0.5] },
  };

  const out = { height: FIGURE_HEIGHT, parts: {} };
  for (const [name, piece] of Object.entries(byName)) {
    const slot = layout[name];
    if (!slot) continue;
    out.parts[name] = {
      x: Math.round(slot.x),
      y: Math.round(slot.y),
      w: Math.round(s(piece.w)),
      h: Math.round(s(piece.h)),
      pivot: slot.pivot,
    };
  }
  return out;
}

const SLOTS = ['head', 'torso', 'armBack', 'armFront', 'legBack', 'legFront', 'weapon', 'offhand', 'cape', 'wings'];

for (const file of sheets) {
  const key = basename(file).replace(/\.parts\.(png|jpe?g|webp)$/i, '');
  const ext = file.split('.').pop().toLowerCase().replace('jpg', 'jpeg');
  const src = `data:image/${ext};base64,${readFileSync(join(inputDir, file)).toString('base64')}`;

  const found = await page.evaluate(async (dataUri) => {
    const img = new Image();
    img.src = dataUri;
    await img.decode();
    const c = window.__key(img);
    const all = window.__islands(c);
    /*
     * Gemini signs its output with a small sparkle, and paint strokes shed
     * loose flecks. Anything that tiny is never a body part - and worse, a
     * sliver in the wrong place wins a slot the real piece should have had,
     * which is how the imp ended up wielding a speck instead of its fireball.
     */
    const biggest = all.reduce((m, p) => Math.max(m, p.area), 0);
    const pieces = all.filter((p) => p.area > biggest * 0.02);
    window.__sheet = c;
    return { pieces, width: c.width, height: c.height, dropped: all.length - pieces.length };
  }, src);

  const named = classify(found.pieces, found.width, overrides[key]);
  const byName = {};
  for (const p of named) if (p.name && !byName[p.name]) byName[p.name] = p;

  const rig = assemble(byName);
  if (!rig) {
    console.error(`  ${key}: no torso/head/leg found - check ${previewDir}/${key}.png`);
  }

  // Cut each piece out at the size the assembly wants it.
  for (const [name, piece] of Object.entries(byName)) {
    const target = rig?.parts[name];
    if (!target) continue;
    const png = await page.evaluate(
      ({ box, w, h }) => {
        const out = document.createElement('canvas');
        out.width = Math.max(1, w);
        out.height = Math.max(1, h);
        const ctx = out.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(window.__sheet, box.x, box.y, box.w, box.h, 0, 0, out.width, out.height);
        return out.toDataURL('image/png');
      },
      { box: { x: piece.x, y: piece.y, w: piece.w, h: piece.h }, w: target.w, h: target.h },
    );
    const outName = `${key}.${name}.png`;
    writeFileSync(join(outDir, outName), Buffer.from(png.split(',')[1], 'base64'));
    manifest[`${key}.${name}`] = outName;
  }

  if (rig) manifest[`${key}.rig`] = rig;

  // A labelled preview, because a wrong guess here is invisible in the game
  // until a unit walks with its cape for a leg.
  const preview = await page.evaluate(
    ({ pieces, sheetW, sheetH }) => {
      const scale = Math.min(1, 900 / Math.max(sheetW, sheetH));
      const out = document.createElement('canvas');
      out.width = Math.round(sheetW * scale);
      out.height = Math.round(sheetH * scale);
      const ctx = out.getContext('2d');
      ctx.fillStyle = '#20203a';
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.drawImage(window.__sheet, 0, 0, out.width, out.height);
      ctx.lineWidth = 2;
      ctx.font = '700 18px system-ui';
      for (const p of pieces) {
        const known = p.name !== null;
        ctx.strokeStyle = known ? '#5fd07a' : '#e8455c';
        ctx.strokeRect(p.x * scale, p.y * scale, p.w * scale, p.h * scale);
        const label = `${p.i}:${p.name ?? 'UNUSED'}`;
        ctx.fillStyle = known ? '#5fd07a' : '#e8455c';
        ctx.fillRect(p.x * scale, p.y * scale - 20, ctx.measureText(label).width + 8, 20);
        ctx.fillStyle = '#101018';
        ctx.fillText(label, p.x * scale + 4, p.y * scale - 4);
      }
      return out.toDataURL('image/png');
    },
    { pieces: named, sheetW: found.width, sheetH: found.height },
  );
  writeFileSync(join(previewDir, `${key}.png`), Buffer.from(preview.split(',')[1], 'base64'));

  const missing = SLOTS.slice(0, 7).filter((s) => !byName[s]);
  const spare = named.filter((p) => !p.name).length;
  console.log(
    `  ${key}: ${found.pieces.length} pieces` +
      (found.dropped ? ` (+${found.dropped} specks dropped)` : '') +
      ` -> ${Object.keys(byName).length} named` +
      (missing.length ? `  MISSING ${missing.join(',')}` : '') +
      (spare ? `  ${spare} unused` : ''),
  );
}

manifest._comment =
  'Texture key -> file in this folder. A *.rig entry is a painted parts assembly. Written by scripts/import-parts.mjs and scripts/import-art.mjs.';
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await browser.close();
console.log(`\n${sheets.length} sheets imported. Previews in ${previewDir}/.`);
