import { defineConfig } from 'vite';

/**
 * `QA=1` keeps the battle test hooks in the bundle so the smoke test can drive
 * a real production build. Shipping builds strip them, so the debug surface
 * (grant gold, unlock the Crown Pack) never reaches players.
 */
const QA = process.env.QA === '1';

export default defineConfig({
  base: './',
  define: {
    __QA_BUILD__: JSON.stringify(QA),
  },
  build: {
    target: 'es2020',
    assetsInlineLimit: 8192,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Phaser is ~1.2MB and never changes between releases, so it gets its
        // own long-cached chunk.
        manualChunks: (id: string) => (id.includes('node_modules/phaser') ? 'phaser' : undefined),
      },
    },
  },
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
});
