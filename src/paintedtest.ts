/** Dev fixture: renders one character on a chroma background so the painted
 *  art importer can be tested end to end without hand-made art. */
import { ALL_CHARACTER_ART } from './art/cast';
import { characterArt, composeCharacter } from './art/compose';

const id = new URLSearchParams(location.search).get('id') ?? 'militia';
const img = document.createElement('img');
img.src = composeCharacter(characterArt(ALL_CHARACTER_ART[id]!), { shadow: false }).toDataUri();
document.getElementById('stage')!.append(img);
