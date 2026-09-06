/**
 * Renames the raw Drive art to the texture keys it stands in for.
 *
 *   node scripts/name-art.mjs
 *
 * Which picture is which can only be settled by looking, so the mapping lives
 * in scripts/art-names.json, keyed by the numbers burnt into the contact
 * sheets. A null means a redundant generation of something already covered.
 */
import { copyFileSync, existsSync, readFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const names = JSON.parse(readFileSync('scripts/art-names.json', 'utf8'));
const index = JSON.parse(readFileSync(join('art-in', 'sheets', 'index.json'), 'utf8'));
const rawDir = join('art-in', 'raw');

let named = 0;
let skipped = 0;
for (const { n, file } of index) {
  const key = names[String(n)];
  if (!key) {
    console.log(`${String(n).padStart(2)}  skipped - a second generation of something already covered`);
    skipped += 1;
    continue;
  }
  const from = join(rawDir, file);
  if (!existsSync(from)) {
    console.error(`${String(n).padStart(2)}  missing: ${from}`);
    continue;
  }
  copyFileSync(from, join('art-in', `${key}.png`));
  console.log(`${String(n).padStart(2)}  ${key}.png`);
  named += 1;
}

// Anything left unnamed would silently never reach the game.
const unmapped = index.filter(({ n }) => !(String(n) in names));
if (unmapped.length) {
  console.error(`\nNot in scripts/art-names.json: ${unmapped.map((u) => u.n).join(', ')}`);
  process.exitCode = 1;
}
console.log(`\n${named} named, ${skipped} redundant.`);
