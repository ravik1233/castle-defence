/** Dev fixture: renders one character on a chroma background so the painted
 *  art importer can be tested end to end without hand-made art. */
import { ALL_CHARACTER_ART } from './art/cast';
import { characterArt, composeCharacter } from './art/compose';

const params = new URLSearchParams(location.search);
const id = params.get('id') ?? 'militia';
const copies = Number(params.get('n') ?? 1);
const src = composeCharacter(characterArt(ALL_CHARACTER_ART[id]!), { shadow: false }).toDataUri();
const stage = document.getElementById('stage')!;
for (let i = 0; i < copies; i += 1) {
  const img = document.createElement('img');
  img.src = src;
  stage.append(img);
}
