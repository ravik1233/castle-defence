/**
 * Lays the raw art out on numbered contact sheets so it can be identified.
 *
 *   node scripts/contact-sheet.mjs [inputDir] [outDir]
 *
 * Gemini names its output after nothing at all, so the only way to work out
 * which picture is the arbalest is to look. Sheets beat opening 38 files.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { launchBrowser } from './browser.mjs';

const inputDir = process.argv[2] ?? join('art-in', 'raw');
const outDir = process.argv[3] ?? join('art-in', 'sheets');
const PER_SHEET = 6;
const CELL = 560;

mkdirSync(outDir, { recursive: true });
const files = readdirSync(inputDir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();

const browser = await launchBrowser();
const index = [];

for (let s = 0; s * PER_SHEET < files.length; s += 1) {
  const slice = files.slice(s * PER_SHEET, (s + 1) * PER_SHEET);
  const cells = slice
    .map((f, i) => {
      const n = s * PER_SHEET + i + 1;
      index.push({ n, file: f });
      const data = readFileSync(join(inputDir, f)).toString('base64');
      const mime = /\.jpe?g$/i.test(f) ? 'image/jpeg' : 'image/png';
      return `<figure><img src="data:${mime};base64,${data}"><figcaption>${n}</figcaption></figure>`;
    })
    .join('');

  const page = await browser.newPage({
    viewport: { width: CELL * 3 + 32, height: CELL * 2 + 32 },
  });
  await page.setContent(`<style>
    body { margin: 0; background: #202030; display: grid; gap: 8px; padding: 8px;
           grid-template-columns: repeat(3, ${CELL}px); }
    figure { margin: 0; position: relative; background: #111; }
    img { width: ${CELL}px; height: ${CELL}px; object-fit: contain; display: block; }
    figcaption { position: absolute; left: 0; top: 0; background: #ff0; color: #000;
                 font: 700 30px system-ui; padding: 2px 12px; }
  </style>${cells}`);
  const out = join(outDir, `sheet-${s + 1}.png`);
  await page.screenshot({ path: out });
  await page.close();
  console.log(`${out}: ${slice.length} images`);
}

writeFileSync(join(outDir, 'index.json'), `${JSON.stringify(index, null, 1)}\n`);
await browser.close();
console.log(`\nIndex written to ${join(outDir, 'index.json')}`);
