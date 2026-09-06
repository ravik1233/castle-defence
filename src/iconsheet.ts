/** Build-time page: renders store artwork so it can be captured as PNG. */
import { appIcon, appIconBackground, appIconForeground, appIconMaskable, splash } from './art/icons';

const items: Array<[string, string, number]> = [
  ['icon', appIcon(1024).toDataUri(), 1024],
  ['icon-foreground', appIconForeground(1024).toDataUri(), 1024],
  ['icon-background', appIconBackground(1024).toDataUri(), 1024],
  ['splash', splash(2732).toDataUri(), 2732],
  ['favicon', appIcon(180).toDataUri(), 180],
  ['pwa-192', appIcon(192).toDataUri(), 192],
  ['pwa-512', appIcon(512).toDataUri(), 512],
  ['maskable-512', appIconMaskable(512).toDataUri(), 512],
];

const app = document.getElementById('app')!;
for (const [id, src, size] of items) {
  const img = document.createElement('img');
  img.id = id;
  img.src = src;
  img.width = size;
  img.height = size;
  app.append(img);
}
