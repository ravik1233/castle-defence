/**
 * The workshop: what the player does with a battle after it is over.
 *
 * Gold is spent inside a fight and never leaves it. Salvage is the opposite -
 * dragged off a won field and spent here, on gear that goes to the next
 * fight. Equipment is bought once and three pieces go to war; workshop stock
 * is made a barrel at a time and burned in a single battle.
 */
import Phaser from 'phaser';
import { DESIGN } from '../core/layout';
import { CONSUMABLES, EQUIPMENT, EQUIPMENT_SLOTS } from '../data/workshop';
import { profile } from '../systems/profile';
import { audio } from '../systems/audio';
import { COLORS, Counter, TextButton, fitText, showDialog, textStyle } from '../ui/kit';

type Tab = 'equipment' | 'stock';

/** Rows of equipment cards that fit above the bottom of the screen. */
const EQUIPMENT_ROWS = 2;

export class WorkshopScene extends Phaser.Scene {
  private tab: Tab = 'equipment';
  private equipPage = 0;
  private body: Phaser.GameObjects.GameObject[] = [];
  private salvageCounter!: Counter;
  private slotText!: Phaser.GameObjects.Text;

  constructor() {
    super('Workshop');
  }

  create(): void {
    const w = DESIGN.width;
    this.add.rectangle(w / 2, DESIGN.height / 2, w, DESIGN.height, 0x1b1626);
    this.add.image(w / 2, DESIGN.height / 2, 'bg.menu').setDisplaySize(w, DESIGN.height).setAlpha(0.18);

    this.add.text(w / 2, 48, 'THE WORKSHOP', textStyle('title', COLORS.gold)).setOrigin(0.5);
    this.salvageCounter = new Counter(this, 40, 48, 'icon.hammer', profile.salvage, 'body');
    new TextButton(this, w - 70, 48, '<', {
      width: 104,
      height: 76,
      tone: 'stone',
      onClick: () => this.scene.start('Armory'),
    });

    const tabs: Array<[Tab, string]> = [
      ['equipment', 'FORT EQUIPMENT'],
      ['stock', 'STOCK'],
    ];
    tabs.forEach(([id, label], i) => {
      const bw = 400;
      const total = tabs.length * bw + 16;
      new TextButton(this, (w - total) / 2 + bw / 2 + i * (bw + 16), 132, label, {
        width: bw,
        height: 76,
        size: 'small',
        tone: 'stone',
        onClick: () => {
          this.tab = id;
          this.draw();
        },
      });
    });

    this.slotText = this.add.text(w / 2, 196, '', textStyle('small', COLORS.muted)).setOrigin(0.5);
    this.draw();
  }

  private clearBody(): void {
    for (const o of this.body) o.destroy();
    this.body = [];
  }

  private track<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.body.push(o);
    return o;
  }

  private draw(): void {
    this.clearBody();
    this.salvageCounter.set(profile.salvage, false);
    if (this.tab === 'equipment') this.drawEquipment();
    else this.drawStock();
  }

  /* ------------------------------------------------------------ equipment */

  private drawEquipment(): void {
    const w = DESIGN.width;
    this.slotText.setText(
      `${profile.equipped.length} / ${EQUIPMENT_SLOTS} fitted   -   what you fit is what the fort has when the horde arrives`,
    );

    /*
     * Two rows of three-hundred-tall cards is what fits above the bottom of
     * the screen. A third row sat at y=1070 with its buy button below the
     * edge, so three of the nine pieces could be read but not bought.
     */
    const cols = 3;
    const cw = w / cols;
    const perPage = cols * EQUIPMENT_ROWS;
    const pages = Math.max(1, Math.ceil(EQUIPMENT.length / perPage));
    this.equipPage = Math.min(this.equipPage, pages - 1);
    const shown = EQUIPMENT.slice(this.equipPage * perPage, (this.equipPage + 1) * perPage);
    if (pages > 1) {
      this.track(this.add.text(w / 2, 248, `${this.equipPage + 1} / ${pages}`, textStyle('tiny', COLORS.gold)).setOrigin(0.5));
      this.track(
        new TextButton(this, w / 2 - 150, 248, '<', {
          width: 84,
          height: 60,
          tone: 'stone',
          onClick: () => {
            this.equipPage = (this.equipPage + pages - 1) % pages;
            this.draw();
          },
        }),
      );
      this.track(
        new TextButton(this, w / 2 + 150, 248, '>', {
          width: 84,
          height: 60,
          tone: 'stone',
          onClick: () => {
            this.equipPage = (this.equipPage + 1) % pages;
            this.draw();
          },
        }),
      );
    }
    shown.forEach((def, i) => {
      const cx = cw / 2 + (i % cols) * cw;
      const y = 420 + Math.floor(i / cols) * 340;
      const owned = profile.ownsEquipment(def.id);
      const fitted = profile.equipped.includes(def.id);
      const locked = Boolean(def.premium) && !profile.hasCrownPack;

      this.track(
        this.add
          .rectangle(cx, y, cw - 70, 300, fitted ? 0x33405e : 0x2a2338, 0.92)
          .setStrokeStyle(4, fitted ? 0xf5c542 : 0x4a4060),
      );
      if (this.textures.exists(def.icon)) {
        this.track(this.add.image(cx - cw / 2 + 90, y - 70, def.icon).setDisplaySize(76, 76).setAlpha(owned ? 1 : 0.4));
      }
      const name = this.add
        .text(cx - cw / 2 + 150, y - 70, def.name, textStyle('body', owned ? COLORS.gold : COLORS.muted))
        .setOrigin(0, 0.5);
      this.track(fitText(name, cw - 240));
      // The blurb sits in its own band between the name and the button, so a
      // three-line description cannot end up printed over the price.
      this.track(
        this.add
          .text(cx, y - 20, def.blurb, {
            ...textStyle('tiny', COLORS.parchment),
            wordWrap: { width: cw - 150 },
            align: 'center',
          })
          .setOrigin(0.5, 0),
      );

      const label = locked ? 'CROWN PACK' : owned ? (fitted ? 'TAKE OFF' : 'FIT') : `${def.cost} SALVAGE`;
      const tone = locked ? 'gold' : owned ? (fitted ? 'stone' : 'green') : profile.salvage >= def.cost ? 'blue' : 'stone';
      this.track(
        new TextButton(this, cx, y + 106, label, {
          width: cw - 180,
          height: 82,
          size: 'small',
          tone,
          enabled: locked || owned || profile.salvage >= def.cost,
          onClick: () => {
            if (locked) {
              this.scene.start('Store');
              return;
            }
            if (!owned) {
              if (profile.buyEquipment(def.id)) audio.play('upgrade');
              else audio.play('deny');
              this.draw();
              return;
            }
            if (!profile.toggleEquipped(def.id)) {
              audio.play('deny');
              showDialog(this, {
                title: 'No room on the wall',
                body: `A fort carries ${EQUIPMENT_SLOTS} pieces. Take one off before fitting another.`,
                height: 360,
                buttons: [{ text: 'OK', tone: 'stone' }],
              });
              return;
            }
            audio.play('tap');
            this.draw();
          },
        }),
      );
    });
  }

  /* ---------------------------------------------------------------- stock */

  private drawStock(): void {
    const w = DESIGN.width;
    this.slotText.setText('One use each. Carried into the next battle and spent there.');

    const cols = 3;
    const cw = w / cols;
    CONSUMABLES.forEach((def, i) => {
      const cx = cw / 2 + i * cw;
      const y = 480;
      const held = profile.stockOf(def.id);
      this.track(this.add.rectangle(cx, y, cw - 70, 420, 0x2a2338, 0.92).setStrokeStyle(4, 0x4a4060));
      if (this.textures.exists(def.icon)) {
        this.track(this.add.image(cx, y - 140, def.icon).setDisplaySize(96, 96));
      }
      this.track(this.add.text(cx, y - 60, def.name, textStyle('body', COLORS.gold)).setOrigin(0.5));
      this.track(
        this.add
          .text(cx, y - 10, def.blurb, {
            ...textStyle('small', COLORS.parchment),
            wordWrap: { width: cw - 140 },
            align: 'center',
          })
          .setOrigin(0.5, 0),
      );
      this.track(
        this.add
          .text(cx, y + 90, `carrying ${held} / ${def.max}`, textStyle('small', held ? COLORS.gold : COLORS.muted))
          .setOrigin(0.5),
      );
      const full = held >= def.max;
      this.track(
        new TextButton(this, cx, y + 160, full ? 'FULL' : `MAKE  ${def.cost}`, {
          width: cw - 200,
          height: 82,
          size: 'small',
          tone: full ? 'stone' : profile.salvage >= def.cost ? 'green' : 'stone',
          enabled: !full && profile.salvage >= def.cost,
          onClick: () => {
            if (profile.craft(def.id)) audio.play('upgrade');
            else audio.play('deny');
            this.draw();
          },
        }),
      );
    });
  }
}
