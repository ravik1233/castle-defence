"""Prevent moving painted units from falling back to a still pose.

Anatomy and gait quality require the visual review in WALK_CYCLE_QA.md.
This check verifies declared coverage, references, and animation indices.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public/assets/painted'
manifest = json.loads((ASSETS / 'manifest.json').read_text())
stationary = {'gatebreaker'}  # src/data/defenders.ts declares a build, not a moving rig.
errors, moving, legacy = [], 0, 0
for key, spec in manifest.items():
    if not key.startswith('unit.') or not key.endswith('.frames'):
        continue
    art_id = key[5:-7]
    if art_id in stationary:
        continue
    moving += 1
    count, names = spec.get('count', 0), spec.get('names', [])
    animations = spec.get('animations')
    if animations is None:
        if count != 5 or names != ['idle', 'walkA', 'walkB', 'attack', 'die']:
            errors.append(f'{art_id}: unsupported legacy movement layout')
        for index in (1, 2):
            filename = manifest.get(f'unit.{art_id}.frame{index}')
            if not filename or not (ASSETS / filename).is_file():
                errors.append(f'{art_id}: missing legacy movement cell {index}')
        legacy += 1
        continue
    walk = animations.get('walk', {})
    frames = walk.get('frames', [])
    if len(set(frames)) < 2:
        errors.append(f'{art_id}: movement still uses a single pose')
    if not isinstance(walk.get('fps'), (int, float)) or walk['fps'] <= 0:
        errors.append(f'{art_id}: invalid movement frame rate')
    if any(not isinstance(i, int) or i < 0 or i >= count for i in frames):
        errors.append(f'{art_id}: movement references an invalid cell')
    if count != 5 or names != ['idle', 'walk_a', 'walk_b', 'attack', 'death']:
        errors.append(f'{art_id}: incomplete authored action layout')
    if animations.get('die', {}).get('frames') != [4]:
        errors.append(f'{art_id}: fallen pose is not mapped to cell 4')
    filename = spec.get('sheet')
    if not filename or not (ASSETS / filename).is_file():
        errors.append(f'{art_id}: missing movement sheet')
if moving != 109:
    errors.append(f'Expected the full 109-unit moving roster, found {moving}')
if errors:
    raise SystemExit('\n'.join(errors))
print(f'Movement coverage verified: {moving} moving units ({legacy} legacy strips), 1 stationary build')
