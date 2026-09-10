/** Reproducible inventory; a generated candidate is not a verified replacement. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { ALL_CHARACTER_ART } from '../src/art/cast.ts';

const manifest = JSON.parse(readFileSync('public/assets/painted/manifest.json', 'utf8'));
const characters = Object.values(ALL_CHARACTER_ART).map(spec => {
  const frames = manifest[`unit.${spec.id}.frames`];
  return {
    id: spec.id,
    specification: spec,
    currentAsset: frames?.sheet ?? (frames ? 'legacy-frames' : 'procedural-parts'),
    frameCount: frames?.count ?? 0,
    replacementStatus: 'pending-review',
  };
});
const inventory = {
  direction: 'Premium stylized mobile fantasy; expressive silhouettes; true anchored motion; Ember crystal core',
  characters,
  environments: ['fields', 'barrows', 'woods', 'highland', 'coast', 'abyss', 'throne'],
  structures: ['tithe', 'barricade', 'ballista', 'bombard', 'brazier'],
  castleSkins: ['stone', 'ivory', 'obsidian', 'verdant'],
  reviewRequirements: ['transparent gutters', 'consistent body scale', 'right-facing source', 'distinct walk contacts and passing poses', 'attack impact timing', 'phone-size readability'],
};
mkdirSync('docs/art-refresh', { recursive: true });
writeFileSync('docs/art-refresh/coverage.json', JSON.stringify(inventory, null, 2) + '\n');
console.log(`${characters.length} unique character art IDs; ${characters.filter(c => c.frameCount).length} existing frame sets; 7 environments; 5 structures; 4 castle skins.`);
