/**
 * The War Ledger entry: everything known about one force in the field.
 *
 * A matchup table is only fair if the player can read it. Sixteen multipliers
 * that only exist in the code are a system players learn by losing; put them
 * on the card and they become something to plan around.
 */
import Phaser from 'phaser';
import type { DamageType, DefenderDef, EnemyDef, EnemyKind } from '../data/types';
import { damageMultiplier } from '../battle/combat';
import { emberBounty, emberCost } from '../battle/economy';
import { portraitFor, portraitForArt } from '../art/portraits';
import { COLORS, showDialog, textStyle } from './kit';

const TYPE_LABEL: Record<DamageType, string> = {
  physical: 'Steel',
  fire: 'Fire',
  frost: 'Frost',
  holy: 'Holy',
};

const KIND_LABEL: Record<EnemyKind, string> = {
  living: 'Living',
  armoured: 'Armoured',
  undead: 'Undead',
  demon: 'Demon',
};

const TYPES: DamageType[] = ['physical', 'fire', 'frost', 'holy'];
const KINDS: EnemyKind[] = ['living', 'armoured', 'undead', 'demon'];

/** What each trait actually does, in words rather than a keyword. */
const TRAIT_TEXT: Record<string, string> = {
  thorns: 'Hurts whatever strikes it.',
  deathblast: 'Explodes when it dies.',
  chain: 'Its shot arcs to a second target.',
  knockback: 'Shoves what it hits back down the lane.',
  smite: 'Every third swing lands doubled, and holy.',
  executioner: 'Doubled against anything armoured.',
};

/** Colour for a multiplier, so the table reads at a glance. */
function tone(mult: number): string {
  if (mult > 1.05) return COLORS.good;
  if (mult < 0.95) return COLORS.danger;
  return COLORS.muted;
}

function statLine(label: string, value: string): string {
  return `${label.padEnd(11, ' ')}${value}`;
}

/**
 * Opens the ledger entry for one defender.
 *
 * `onClose` matters in a battle: reading a card pauses the fight, and the
 * fight has to start again whichever way the panel was dismissed.
 */
export function showDefenderEntry(scene: Phaser.Scene, def: DefenderDef, onClose?: () => void): void {
  const attack = def.attack;
  const type = attack?.damageType ?? 'physical';
  const income = def.economy?.requiresSeam
    ? `${def.economy.amount} x ${def.economy.deposits ?? 0} from a vein`
    : def.economy
      ? `${def.economy.amount} Ember every ${def.economy.interval}s`
      : '';
  const lines = [
    statLine('Cost', `${emberCost(def.cost)} Ember`),
    statLine('Health', String(def.hp)),
    attack ? statLine('Damage', `${attack.damage}  ${TYPE_LABEL[type]}`) : statLine('Damage', '-'),
    attack ? statLine('Rate', `${attack.rate}/s`) : '',
    attack ? statLine('Reach', attack.range >= 700 ? 'Down the lane' : `${Math.round(attack.range)}`) : '',
    attack?.splash ? statLine('Splash', `${attack.splash}`) : '',
    attack?.pierce ? statLine('Pierce', `${attack.pierce} targets`) : '',
    income ? statLine('Income', income) : '',
    def.metaGold ? statLine('Victory', `+${def.metaGold} permanent Gold`) : '',
    statLine('Recharge', `${def.recharge}s`),
  ].filter(Boolean);

  showDialog(scene, {
    title: def.name,
    width: 940,
    height: 660,
    dismissable: false,
    buttons: [{ text: 'CLOSE', tone: 'stone', onClick: onClose }],
    build: (group, w, h) => {
      const art = portraitFor(scene, def);
      if (art) {
        const img = scene.add.image(-w / 2 + 130, -h / 2 + 210, art.key, art.frame);
        const size = art.whole ? 190 : 150;
        const ratio = img.width / img.height;
        img.setDisplaySize(ratio > 1 ? size : size * ratio, ratio > 1 ? size / ratio : size);
        group.add(img);
      }

      group.add(
        scene.add
          .text(-w / 2 + 240, -h / 2 + 120, def.blurb, textStyle('small', COLORS.parchment, {
            wordWrap: { width: w - 300 },
          }))
          .setOrigin(0, 0),
      );
      group.add(
        scene.add
          .text(-w / 2 + 240, -h / 2 + 200, lines.join('\n'), textStyle('tiny', COLORS.muted))
          .setOrigin(0, 0),
      );

      if (def.trait && TRAIT_TEXT[def.trait]) {
        group.add(
          scene.add
            .text(-w / 2 + 60, h / 2 - 250, `${def.trait.toUpperCase()}  ${TRAIT_TEXT[def.trait]}`,
              textStyle('small', COLORS.gold, { wordWrap: { width: w - 120 } }))
            .setOrigin(0, 0),
        );
      }

      // What this unit's damage does to each kind of thing it will meet.
      if (attack) {
        group.add(
          scene.add
            .text(-w / 2 + 60, h / 2 - 180, `${TYPE_LABEL[type]} against:`, textStyle('tiny', COLORS.parchment))
            .setOrigin(0, 0),
        );
        KINDS.forEach((kind, i) => {
          const m = damageMultiplier(type, kind);
          group.add(
            scene.add
              .text(
                -w / 2 + 60 + i * 200,
                h / 2 - 140,
                `${KIND_LABEL[kind]}\n${m.toFixed(2)}x`,
                textStyle('small', tone(m)),
              )
              .setOrigin(0, 0),
          );
        });
      }
    },
  });
}

/** Opens the ledger entry for one enemy. */
export function showEnemyEntry(scene: Phaser.Scene, def: EnemyDef, onClose?: () => void): void {
  const kind = def.kind ?? 'living';
  const lines = [
    statLine('Health', String(def.hp)),
    statLine('Damage', String(def.damage)),
    statLine('Rate', `${def.rate}/s`),
    statLine('Speed', def.speed >= 80 ? 'Fast' : def.speed >= 55 ? 'Steady' : 'Slow'),
    statLine('Armour', def.armor > 0 ? `${def.armor} off every hit` : 'None'),
    statLine('Bounty', `${emberBounty(def.bounty)} Ember`),
    def.flying ? statLine('Flying', 'Walks over the line') : '',
  ].filter(Boolean);

  showDialog(scene, {
    title: def.name,
    width: 940,
    height: 620,
    dismissable: false,
    buttons: [{ text: 'CLOSE', tone: 'stone', onClick: onClose }],
    build: (group, w, h) => {
      const portrait = portraitForArt(scene, def.art);
      if (portrait) {
        const img = scene.add.image(-w / 2 + 130, -h / 2 + 200, portrait.key, portrait.frame);
        const ratio = img.width / img.height;
        img.setDisplaySize(ratio > 1 ? 180 : 180 * ratio, ratio > 1 ? 180 / ratio : 180);
        group.add(img);
      }

      group.add(
        scene.add
          .text(-w / 2 + 240, -h / 2 + 110, `${KIND_LABEL[kind]}`, textStyle('body', COLORS.gold))
          .setOrigin(0, 0),
      );
      group.add(
        scene.add
          .text(-w / 2 + 240, -h / 2 + 180, lines.join('\n'), textStyle('tiny', COLORS.muted))
          .setOrigin(0, 0),
      );

      /*
       * The row of the table that matters when you are looking at this thing.
       * It sits clear of the CLOSE button, which the dialog puts at h/2-88:
       * at h/2-160 the two numbers in the middle were printed underneath it.
       */
      group.add(
        scene.add
          .text(-w / 2 + 60, h / 2 - 250, 'Hurt most by:', textStyle('tiny', COLORS.parchment))
          .setOrigin(0, 0),
      );
      TYPES.forEach((type, i) => {
        const m = damageMultiplier(type, kind);
        group.add(
          scene.add
            .text(
              -w / 2 + 60 + i * 200,
              h / 2 - 210,
              `${TYPE_LABEL[type]}\n${m.toFixed(2)}x`,
              textStyle('small', tone(m)),
            )
            .setOrigin(0, 0),
        );
      });
    },
  });
}
