/**
 * The store. One product, one price, no second currency.
 */
import Phaser from 'phaser';
import { DESIGN } from '../core/layout';
import { CROWN_PACK_BENEFITS, isWebTestBuild, store, type StoreProduct } from '../systems/iap';
import { profile } from '../systems/profile';
import { audio } from '../systems/audio';
import { COLORS, TextButton, showDialog, textStyle } from '../ui/kit';

export class StoreScene extends Phaser.Scene {
  private product?: StoreProduct;
  private buyButton?: TextButton;

  constructor() {
    super('Store');
  }

  create(): void {
    const w = DESIGN.width;
    const h = DESIGN.height;
    this.add.image(w / 2, h / 2, 'bg.menu').setDisplaySize(w, h);
    this.add.rectangle(w / 2, h / 2, w, h, 0x140f1e, 0.55);

    new TextButton(this, w - 70, 48, '<', {
      width: 104,
      height: 76,
      tone: 'stone',
      onClick: () => this.scene.start('MainMenu'),
    });

    // Crown and pitch on the left, what you get on the right.
    const left = w * 0.28;
    this.add.image(left, 280, 'icon.crown').setScale(2.2);
    this.add.text(left, 420, 'THE CROWN PACK', textStyle('title', COLORS.gold)).setOrigin(0.5);
    this.add
      .text(left, 482, 'One purchase. Everything in it. Forever.', textStyle('small', COLORS.parchment))
      .setOrigin(0.5);

    const listX = w * 0.55;
    CROWN_PACK_BENEFITS.forEach((line, i) => {
      const y = 250 + i * 96;
      this.add.image(listX, y, 'icon.gem').setDisplaySize(44, 44);
      this.add
        .text(listX + 46, y, line, { ...textStyle('small'), wordWrap: { width: w - listX - 120 } })
        .setOrigin(0, 0.5);
    });

    const owned = profile.hasCrownPack;
    this.buyButton = new TextButton(this, left, h - 260, owned ? 'OWNED — THANK YOU' : 'LOADING...', {
      width: 620,
      height: 112,
      tone: owned ? 'stone' : 'gold',
      size: owned ? 'body' : 'title',
      enabled: false,
      onClick: () => void this.buy(),
    });

    new TextButton(this, left, h - 140, 'RESTORE PURCHASE', {
      width: 460,
      height: 84,
      size: 'small',
      tone: 'stone',
      onClick: () => void this.restore(),
    });

    this.add
      .text(
        w * 0.62,
        h - 60,
        isWebTestBuild()
          ? 'Web test build: unlocking here is free and local to this browser.'
          : 'No ads, no loot boxes, no subscriptions. The base game stays free.',
        { ...textStyle('tiny', COLORS.muted), align: 'center', wordWrap: { width: 620 } },
      )
      .setOrigin(0.5);

    if (!owned) void this.loadProduct();
  }

  private async loadProduct(): Promise<void> {
    const ready = await store.ready();
    this.product = await store.product();
    this.buyButton?.setText(ready ? `UNLOCK - ${this.product.priceLabel}` : 'STORE UNAVAILABLE');
    this.buyButton?.setEnabled(ready);
  }

  private async buy(): Promise<void> {
    this.buyButton?.setEnabled(false);
    this.buyButton?.setText('OPENING STORE...');
    const result = await store.purchase();
    if (result.status === 'purchased' || result.status === 'restored') {
      audio.play('victory');
      showDialog(this, {
        title: 'The Crown Pack is yours',
        body: 'Chapter 4, three defenders, Seraphina and every castle skin are unlocked. Ads are gone for good.',
        height: 520,
        buttons: [{ text: 'TO THE WALL', tone: 'green', onClick: () => this.scene.start('MainMenu') }],
      });
      return;
    }
    this.buyButton?.setEnabled(true);
    this.buyButton?.setText(`UNLOCK - ${this.product?.priceLabel ?? '$4.99'}`);
    if (result.status === 'cancelled') return;
    showDialog(this, {
      title: 'Purchase failed',
      body: 'reason' in result ? result.reason : 'Something went wrong. Nothing was charged.',
      height: 420,
      buttons: [{ text: 'OK', tone: 'stone' }],
    });
  }

  private async restore(): Promise<void> {
    const result = await store.restore();
    const ok = result.status === 'restored' || result.status === 'purchased';
    showDialog(this, {
      title: ok ? 'Restored' : 'Nothing to restore',
      body: ok
        ? 'Your Crown Pack is back on this device.'
        : 'No previous purchase was found for this store account.',
      height: 400,
      buttons: [{ text: 'OK', tone: ok ? 'green' : 'stone', onClick: () => ok && this.scene.start('MainMenu') }],
    });
  }
}
