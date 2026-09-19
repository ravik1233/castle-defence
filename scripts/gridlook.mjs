/**
 * Fills every tile in every region, once with defenders and once with
 * enemies, then captures a full-resolution alignment screenshot.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { launchBrowser } from './browser.mjs';

const base = process.argv[2] ?? 'http://localhost:5199';
const levels = ['c1l1', 'c2l1', 'c3l1', 'c4l1', 'c5l1', 'c6l1', 'c7l1'];
const rows = 5;
const cols = 8;
const expectedXs = Array.from({ length: cols }, (_, col) => 300 + col * 200);
const expectedGround = (row) => 311 + row * 150;

await mkdir('screenshots/grid-alignment', { recursive: true });
const browser = await launchBrowser();
try {
  for (const level of levels) {
    for (const side of ['defenders', 'enemies']) {
      const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
      await page.goto(`${base}/?scene=Battle&level=${level}&unlock=1&nomodal=1`, { waitUntil: 'load' });
      await page.waitForFunction(() => globalThis.__battle !== undefined, undefined, { timeout: 180000 });

      const count = await page.evaluate((fillSide) => globalThis.__battle.qaFill(fillSide), side);
      assert.equal(count, rows * cols, `${level} ${side}: did not fill every cell`);
      await page.waitForTimeout(700);

      const state = await page.evaluate(() => globalThis.__battle.state());
      const dump = side === 'defenders' ? state.defenderDump.filter((d) => !d.commander) : state.enemyDump;
      assert.equal(dump.length, rows * cols, `${level} ${side}: wrong rendered unit count`);

      for (let row = 0; row < rows; row += 1) {
        const lane = dump.filter((unit) => unit.row === row).sort((a, b) => a.x - b.x);
        assert.equal(lane.length, cols, `${level} ${side}: row ${row} is incomplete`);
        assert.deepEqual(lane.map((unit) => unit.x), expectedXs, `${level} ${side}: row ${row} x coordinates drifted`);
        for (const unit of lane) {
          const expectedY = expectedGround(row) - (side === 'enemies' && unit.flying ? 70 : 0);
          assert.equal(unit.y, expectedY, `${level} ${side}: row ${row} y coordinate drifted`);
          if (!unit.flying) assert.ok(unit.top >= 176 + row * 150, `${level} ${side}: art escapes above row ${row}`);
        }
      }

      await page.screenshot({ path: `screenshots/grid-alignment/${level}-${side}.png` });
      await page.close();
    }
  }
} finally {
  await browser.close();
}
