/**
 * Development-only art sheet. Open /preview.html with `npm run dev` to see
 * every character, structure and prop the vector art system produces.
 */
import { DEFENDER_ART, ENEMY_ART, HERO_ART } from './art/cast';
import { characterArt, composeCharacter } from './art/compose';
import type { CharacterSpec } from './art/humanoid';

function section(title: string, specs: Record<string, CharacterSpec>): HTMLElement {
  const wrap = document.createElement('div');
  const h = document.createElement('h2');
  h.textContent = title;
  const row = document.createElement('div');
  row.className = 'row';
  for (const spec of Object.values(specs)) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const img = document.createElement('img');
    img.src = composeCharacter(characterArt(spec)).toDataUri();
    const label = document.createElement('span');
    label.textContent = spec.id;
    cell.append(img, label);
    row.append(cell);
  }
  wrap.append(h, row);
  return wrap;
}

/** Blow one character up so part placement can be checked. */
function detail(spec: CharacterSpec): HTMLElement {
  const wrap = document.createElement('div');
  const h = document.createElement('h2');
  h.textContent = `detail: ${spec.id}`;
  const row = document.createElement('div');
  row.className = 'row';
  const art = characterArt(spec);
  const whole = document.createElement('img');
  whole.src = composeCharacter(art).toDataUri();
  whole.style.height = '460px';
  row.append(whole);
  for (const part of art.parts) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const img = document.createElement('img');
    img.src = part.svg.toDataUri();
    img.style.height = '140px';
    const label = document.createElement('span');
    label.textContent = part.name;
    cell.append(img, label);
    row.append(cell);
  }
  wrap.append(h, row);
  return wrap;
}

const app = document.getElementById('app')!;
app.append(
  detail(DEFENDER_ART.militia!),
  section('Defenders', DEFENDER_ART),
  section('Demon host', ENEMY_ART),
  section('Heroes', HERO_ART),
);
