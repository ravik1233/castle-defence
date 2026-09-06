/**
 * A bench for painted parts rigs: pick a unit, play each animation, and see
 * whether the pieces actually hang together.
 *
 *   npm run dev  ->  /rigtest.html
 *
 * The assembly is synthesised from the pieces' proportions, so this is where
 * you find out that a cape got hung where a leg should be.
 */
import Phaser from 'phaser';
import { buildTextures, paintedFrameSet, paintedRig } from './art/registry';
import { characterArt } from './art/compose';
import { ALL_CHARACTER_ART } from './art/cast';
import { DEFENDERS } from './data/defenders';
import { ENEMIES } from './data/enemies';
import { HEROES } from './data/heroes';
import { Rig, type RigAnim } from './objects/Rig';

const ANIMS: RigAnim[] = ['idle', 'walk', 'attack', 'cast', 'hurt', 'die', 'spawn'];

/** Every unit in the game that is drawn as a character rather than a building. */
function unitIds(): string[] {
  const ids = new Set<string>();
  for (const d of DEFENDERS) if (d.art.kind === 'unit') ids.add(d.art.id);
  for (const e of ENEMIES) ids.add(e.art);
  for (const h of HEROES) if (typeof h.art === 'string') ids.add(h.art);
  // Anything with a painted pack but no game data yet - new races, test strips.
  for (const id of Object.keys(ALL_CHARACTER_ART)) if (paintedFrameSet(id)) ids.add(id);
  return [...ids].sort();
}

class Bench extends Phaser.Scene {
  private rig?: Rig;
  private joints: Phaser.GameObjects.Arc[] = [];
  private current = '';

  async create(): Promise<void> {
    await buildTextures(this);
    const select = document.getElementById('unit') as HTMLSelectElement;
    for (const id of unitIds()) {
      const painted = paintedFrameSet(id) ? ' (frames)' : paintedRig(id) ? ' (painted)' : '';
      select.append(new Option(id + painted, id));
    }
    select.onchange = () => this.show(select.value);

    const anims = document.getElementById('anims') as HTMLElement;
    for (const a of ANIMS) {
      const b = document.createElement('button');
      b.textContent = a;
      b.onclick = () => this.rig?.play(a);
      anims.append(b);
    }
    (document.getElementById('bones') as HTMLInputElement).onchange = () => this.show(this.current);

    this.add.rectangle(640, 560, 1280, 4, 0x4a3f63);
    this.show(select.value);
  }

  private show(id: string): void {
    this.current = id;
    this.rig?.destroy();
    for (const j of this.joints) j.destroy();
    this.joints = [];

    this.rig = new Rig(this, 640, 560, characterArt(ALL_CHARACTER_ART[id]!), { scale: 3.2 });
    this.rig.play('idle');

    if ((document.getElementById('bones') as HTMLInputElement).checked) {
      const rig = paintedRig(id);
      if (rig) {
        const k = (this.rig.worldHeight ?? 0) / rig.height;
        for (const slot of Object.values(rig.parts)) {
          this.joints.push(
            this.add.circle(640 + slot.x * k, 560 + slot.y * k, 4, 0xff3366).setDepth(9999),
          );
        }
      }
    }
  }

  override update(time: number, delta: number): void {
    this.rig?.update(time, delta);
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1280,
  height: 620,
  backgroundColor: '#241c33',
  scene: Bench,
});
