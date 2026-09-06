/**
 * Pulls the raw Gemini art out of the shared Drive folder into art-in/raw/.
 *
 *   node scripts/fetch-drive-art.mjs
 *
 * The folder must be shared as "Anyone with the link - Viewer"; Drive answers
 * an anonymous request for a private file with its sign-in page, which this
 * detects and reports rather than writing HTML into a .png.
 *
 * Files land under their Drive id. Identifying and renaming them is a separate
 * step (scripts/name-art.mjs), because it needs eyes on the pictures.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const ids = JSON.parse(readFileSync('scripts/drive-art.json', 'utf8'));
const outDir = join('art-in', 'raw');
mkdirSync(outDir, { recursive: true });

let failed = 0;
for (const [i, { id, title }] of ids.entries()) {
  const out = join(outDir, `${id}.png`);
  const res = await fetch(`https://drive.google.com/uc?export=download&id=${id}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // A PNG starts \x89PNG; a JPEG starts \xff\xd8. Anything else is Drive's
  // sign-in or virus-scan page, which means the folder is not shared publicly.
  const png = buf[0] === 0x89 && buf[1] === 0x50;
  const jpg = buf[0] === 0xff && buf[1] === 0xd8;
  if (!png && !jpg) {
    console.error(`  ${title}: not an image (${buf.length} bytes) - is the folder link-shared?`);
    failed += 1;
    continue;
  }
  writeFileSync(out, buf);
  console.log(`${String(i + 1).padStart(2)}/${ids.length}  ${title} -> ${out} (${(buf.length / 1e6).toFixed(1)} MB)`);
}

if (failed) {
  console.error(`\n${failed} of ${ids.length} could not be downloaded.`);
  console.error('In Drive: Share > General access > Anyone with the link > Viewer.');
  process.exit(1);
}

// The same picture uploaded twice is the same bytes twice.
const seen = new Map();
let removed = 0;
for (const f of readdirSync(outDir).sort()) {
  const hash = createHash('sha256').update(readFileSync(join(outDir, f))).digest('hex');
  if (seen.has(hash)) {
    unlinkSync(join(outDir, f));
    console.log(`duplicate of ${seen.get(hash)}, removed: ${f}`);
    removed += 1;
  } else {
    seen.set(hash, f);
  }
}
console.log(`\n${seen.size} unique images in ${outDir}${removed ? ` (${removed} duplicates removed)` : ''}.`);
