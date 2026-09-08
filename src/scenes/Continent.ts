/**
 * The continent: what is left of the human west.
 *
 * The campaign used to be a list of levels that happened to be grouped. This
 * is the same levels arranged as ground - regions the player falls back
 * through, each with a commander whose spells they will fight with and a
 * muster of units raised there. Choosing where to go is choosing how to play.
 */
import Phaser from 'phaser';
import { DESIGN } from '../core/layout';
import { CHAPTERS } from '../data/levels';
import { hero } from '../data/heroes';
import { portraitForArt } from '../art/portraits';
import { defender } from '../data/defenders';
import { profile } from '../systems/profile';
import { audio } from '../systems/audio';
import { COLORS, TextButton, fitText, showDialog, starRow, tappable, textStyle } from '../ui/kit';

/** Ground colour per region, west to east: fields, woods, ash, ruin. */
const REGION_TINT = [0x6f7f43, 0x4c5c3a, 0x6b4636, 0x5a3242];

/** Where the map sits on screen, in pixels. */
const MAP = { x: 120, y: 190, w: DESIGN.width - 240, h: DESIGN.height - 330 };

export class ContinentScene extends Phaser.Scene {
  constructor() {
    super('Continent');
  }

  create(): void {
    const w = DESIGN.width;
    this.add.rectangle(w / 2, DESIGN.height / 2, w, DESIGN.height, 0x121a2a).setDepth(-20);

    this.drawSea();
    this.drawLand();
    this.drawRoads();
    // The old map texture stays, but as a grain over the drawn continent
    // rather than as the map itself.
    this.add
      .image(w / 2, DESIGN.height / 2, 'bg.map')
      .setDisplaySize(w, DESIGN.height)
      .setAlpha(0.16)
      .setDepth(-8);
    for (const region of CHAPTERS) this.drawRegion(region);

    // Header last, over the map, with a plate so the title never fights the
    // coastline behind it.
    this.add.image(w / 2, 74, 'ui.panel.small').setDisplaySize(820, 130).setAlpha(0.8);
    this.add.text(w / 2, 52, 'THE LAST WEST', textStyle('title', COLORS.gold)).setOrigin(0.5);
    this.add
      .text(w / 2, 104, 'Every region behind you is gone. Hold what is left.', textStyle('small', COLORS.muted))
      .setOrigin(0.5);

    new TextButton(this, w - 70, 48, '<', {
      width: 104,
      height: 76,
      tone: 'stone',
      onClick: () => this.scene.start('MainMenu'),
    });
  }

  /** Water, with a few swells drawn in so it is not a flat field of blue. */
  private drawSea(): void {
    const g = this.add.graphics().setDepth(-18);
    g.fillStyle(0x1b2b45, 1);
    g.fillRect(0, 0, DESIGN.width, DESIGN.height);
    g.lineStyle(3, 0x2b4066, 0.5);
    for (let y = 150; y < DESIGN.height; y += 74) {
      g.beginPath();
      for (let x = -40; x < DESIGN.width + 40; x += 40) {
        const yy = y + Math.sin((x + y) * 0.012) * 9;
        if (x === -40) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.strokePath();
    }
  }

  /*
   * The continent itself. It is drawn rather than painted so the coast can
   * follow wherever the regions sit: move a region on the map and the land
   * still wraps around it.
   */
  private drawLand(): void {
    const pts = CHAPTERS.map((c) => this.pos(c));
    const cx = pts.reduce((n, p) => n + p.x, 0) / pts.length + 40;
    const cy = pts.reduce((n, p) => n + p.y, 0) / pts.length + 10;

    // A ring of control points around the regions, wobbled so the coast is
    // never a circle, then run through a spline so it is never a polygon.
    const ring: Phaser.Math.Vector2[] = [];
    const STEPS = 22;
    for (let i = 0; i < STEPS; i += 1) {
      const a = (i / STEPS) * Math.PI * 2;
      const dir = new Phaser.Math.Vector2(Math.cos(a), Math.sin(a) * 0.62);
      // Reach out to whichever region lies that way, plus a little coast.
      let reach = 0;
      for (const p of pts) {
        const v = new Phaser.Math.Vector2(p.x + 40 - cx, p.y + 10 - cy);
        const along = v.x * dir.x + v.y * dir.y * 2.6;
        if (along > reach) reach = along;
      }
      const wobble = 1 + Math.sin(i * 1.7) * 0.06 + Math.cos(i * 0.9) * 0.05;
      ring.push(new Phaser.Math.Vector2(cx + dir.x * (reach + 300) * wobble, cy + dir.y * (reach + 300) * wobble));
    }
    const coast = new Phaser.Curves.Spline([...ring, ring[0]!, ring[1]!]).getPoints(220);

    const shelf = coast.map((p) => {
      const v = new Phaser.Math.Vector2(p.x - cx, p.y - cy).normalize().scale(34);
      return new Phaser.Math.Vector2(p.x + v.x, p.y + v.y);
    });

    const g = this.add.graphics().setDepth(-16);
    g.fillStyle(0x2c4166, 0.7);
    g.fillPoints(shelf, true, true);
    g.fillStyle(0x55683f, 1);
    g.fillPoints(coast, true, true);
    g.lineStyle(6, 0x7d9459, 0.9);
    g.strokePoints(coast, true, true);

    // Region ground: each holding tints its own patch of the land, so the map
    // reads as territory rather than as four buttons on a texture.
    CHAPTERS.forEach((region, i) => {
      const p = pts[i]!;
      const open = this.isOpen(region);
      const g2 = this.add.graphics().setDepth(-14);
      g2.fillStyle(open ? REGION_TINT[i % REGION_TINT.length]! : 0x3b3f36, open ? 0.55 : 0.4);
      g2.fillEllipse(p.x + 40, p.y + 10, 460, 320);

      // A scatter of trees or crags, kept out from under the card so the
      // country shows either side of it.
      const g3 = this.add.graphics().setDepth(-12).setAlpha(open ? 0.8 : 0.35);
      for (let k = 0; k < 10; k += 1) {
        const a = (k / 10) * Math.PI * 2 + i;
        const tx = p.x + 40 + Math.cos(a) * (215 + (k % 3) * 20);
        const ty = p.y + 10 + Math.sin(a) * (140 + (k % 2) * 18);
        if (region.id >= 3) {
          g3.fillStyle(0x6a5a52, 1);
          g3.fillTriangle(tx - 18, ty + 14, tx, ty - 22, tx + 18, ty + 14);
          g3.fillStyle(0x8b7a70, 1);
          g3.fillTriangle(tx - 7, ty + 14, tx, ty - 22, tx + 7, ty + 14);
        } else {
          g3.fillStyle(0x4a3524, 1);
          g3.fillRect(tx - 3, ty, 6, 15);
          g3.fillStyle(region.id === 1 ? 0x5f7a3c : 0x46603a, 1);
          g3.fillCircle(tx, ty - 6, 14);
        }
      }
    });
  }

  private isOpen(region: (typeof CHAPTERS)[number]): boolean {
    return profile.isRegionReached(region.id);
  }

  private pos(region: (typeof CHAPTERS)[number]): { x: number; y: number } {
    return { x: MAP.x + region.map.x * MAP.w, y: MAP.y + region.map.y * MAP.h };
  }

  /**
   * The road between regions, so the continent reads as a route. Roads the
   * player has already walked are gold; the road ahead is a dotted track.
   */
  private drawRoads(): void {
    const g = this.add.graphics().setDepth(-10);
    CHAPTERS.forEach((region, i) => {
      if (i === 0) return;
      const a = this.pos(CHAPTERS[i - 1]!);
      const b = this.pos(region);
      const walked = this.isOpen(region);
      const steps = 26;
      for (let k = 0; k <= steps; k += 1) {
        if (!walked && k % 2 === 1) continue;
        const t = k / steps;
        const x = a.x + (b.x - a.x) * t + 40;
        const y = a.y + (b.y - a.y) * t + 10 + Math.sin(t * Math.PI) * 40;
        g.fillStyle(walked ? 0xf0c85e : 0x3f3323, walked ? 0.95 : 0.8);
        g.fillCircle(x, y, walked ? 7 : 5);
      }
    });
  }

  private drawRegion(region: (typeof CHAPTERS)[number]): void {
    const { x, y } = this.pos(region);
    const open = this.isOpen(region);
    const cleared = region.levels.filter((l) => (profile.levelRecord(l.id)?.stars ?? 0) > 0).length;
    const stars = region.levels.reduce((n, l) => n + (profile.levelRecord(l.id)?.stars ?? 0), 0);
    const here = profile.currentRegion().id === region.id;

    const node = this.add.container(x, y);
    const CARD_W = 340;
    const CARD_H = 210;
    node.add(
      this.add
        .image(0, 0, 'ui.panel')
        .setDisplaySize(CARD_W, CARD_H)
        .setAlpha(open ? 1 : 0.55),
    );
    if (here) {
      node.add(
        this.add
          .rectangle(0, 0, CARD_W - 8, CARD_H - 8)
          .setStrokeStyle(5, 0xf5c542, 0.95)
          .setFillStyle(0, 0),
      );
    }

    // Portrait down the left, everything written down the right: at this size
    // the two cannot share a column without colliding.
    const commander = hero(region.commander);
    const portrait = portraitForArt(this, commander.art);
    if (portrait) {
      const img = this.add.image(-CARD_W / 2 + 68, 4, portrait.key, portrait.frame);
      img.setScale(Math.min(112 / img.width, 150 / img.height));
      img.setAlpha(open ? 1 : 0.3);
      node.add(img);
    }

    const textX = -CARD_W / 2 + 140;
    const name = this.add
      .text(textX, -76, region.name, textStyle('small', open ? COLORS.parchment : COLORS.muted))
      .setOrigin(0, 0);
    fitText(name, 190);
    node.add(name);
    node.add(
      this.add.text(textX, -34, commander.name, textStyle('tiny', open ? COLORS.gold : COLORS.muted)).setOrigin(0, 0),
    );
    node.add(
      this.add
        .text(textX, 2, `${cleared} / ${region.levels.length} forts held`, textStyle('tiny', COLORS.muted))
        .setOrigin(0, 0),
    );
    node.add(starRow(this, textX + 46, 52, Math.min(3, Math.round(stars / region.levels.length)), 28));

    node.add(
      this.add
        .text(
          0,
          CARD_H / 2 - 22,
          open ? (here ? 'YOU ARE HERE' : 'HELD') : region.premium ? 'CROWN PACK' : 'LOCKED',
          textStyle('tiny', open ? (here ? COLORS.gold : COLORS.muted) : COLORS.danger),
        )
        .setOrigin(0.5),
    );

    tappable(node, CARD_W, CARD_H);
    node.on('pointerdown', () => this.enter(region, open));
  }

  /**
   * Entering a region is a briefing, not a menu click: the player is told who
   * commands here and what they will be given, because both change how the
   * next ten fights go.
   */
  private enter(region: (typeof CHAPTERS)[number], open: boolean): void {
    audio.play('tap');
    if (!open) {
      showDialog(this, {
        title: region.name,
        body: region.premium
          ? 'This region is part of the Crown Pack.'
          : 'Hold the region before this one first.',
        buttons: region.premium
          ? [
              { text: 'SEE THE PACK', tone: 'gold', onClick: () => this.scene.start('Store') },
              { text: 'BACK', tone: 'stone' },
            ]
          : [{ text: 'BACK', tone: 'stone' }],
      });
      return;
    }

    const commander = hero(region.commander);
    const muster = region.unlocks.map((id) => defender(id).name).join(', ');
    showDialog(this, {
      title: region.name,
      body: `${region.blurb}\n\n${commander.name}, ${commander.title}, commands here.\n\nSpells: ${commander.spells
        .map((s) => s.name)
        .join(' and ')}\nMuster: ${muster}`,
      width: 960,
      height: 620,
      buttons: [
        { text: 'RIDE OUT', tone: 'green', onClick: () => this.scene.start('Map', { chapter: region.id }) },
        { text: 'BACK', tone: 'stone' },
      ],
    });
  }
}
