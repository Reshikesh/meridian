const { test, expect } = require('@playwright/test');
const { APP_URL } = require('./lib/app-url');
const { auditInPage, formatAudit } = require('./lib/audit');
const { installState } = require('./lib/seed-state');
const { transientStates } = require('./lib/states');

/* QUALITY-BAR §2 requires no horizontal scrollbar, no overlap and no clipped
   text "at every width from 360 px to 2560 px, AND at browser zoom 90 %, 100 %,
   125 %, 150 %". responsive.spec.js covers the width axis at 100 %; this file
   covers the zoom axis, which nothing did before — which is how a real overflow
   at 360px/150% shipped unnoticed.

   Browser zoom scales every CSS pixel uniformly, so zooming a W-pixel window to
   Z is equivalent to a layout viewport of W/Z CSS pixels. Emulating it that way
   keeps the check in the same units the audit already speaks. */

const ZOOMS = [0.9, 1.25, 1.5];      // 100% is responsive.spec.js's whole axis
const WIDTHS = [360, 768, 1280, 1920, 2560];
const THEMES = ['paper', 'graphite', 'blueprint'];
const SCREENS = ['log', 'went', 'progress', 'goals', 'lessons'];

const FROZEN = new Date('2026-06-07T12:00:00Z');
const MIN_LEAVES = 14;

// See responsive.spec.js: the same walk, so the same cap.
test.describe.configure({ timeout: 180000 });

for (const zoom of ZOOMS) {
  for (const width of WIDTHS) {
    const css = Math.round(width / zoom);

    test.describe(`${width}px @ ${Math.round(zoom * 100)}% (${css} css px)`, () => {
      test.use({ viewport: { width: css, height: Math.round(900 / zoom) } });

      for (const theme of THEMES) {
        test(`${theme} — every screen: no page scroll, no clipped text, no overlap`, async ({ page }) => {
          await page.addInitScript((t) => {
            try { localStorage.setItem('meridian:theme', t); } catch (e) { /* private mode */ }
          }, theme);
          await installState(page);
          await page.clock.setFixedTime(FROZEN);

          await page.goto(APP_URL);

          const failures = [];
          for (const screen of SCREENS) {
            await page.click(`[data-nav="${screen}"]`);
            await expect(page.locator(`main.screen[data-s="${screen}"]`)).toBeVisible();
            await page.waitForFunction(
              () => document.getAnimations().every((a) => a.playState === 'finished'));

            const res = await page.evaluate(auditInPage);
            expect(res.counts.leaves,
              `${css}css/${theme}/${screen}: audit saw only ${res.counts.leaves} leaves`)
              .toBeGreaterThanOrEqual(MIN_LEAVES);
            failures.push(...formatAudit(res, `${width}@${zoom}/${theme}/${screen}`));
          }

          // The same transient states as the width matrix (lib/states.js):
          // a row that fits at 100% can still overflow at 150%.
          for (const state of transientStates(page)) {
            await state.open();
            await expect(page.locator(state.ready).last()).toBeVisible();
            await page.waitForFunction(
              () => document.getAnimations().every((a) => a.playState === 'finished'));
            const res = await page.evaluate(auditInPage);
            expect(res.counts.leaves,
              `${css}css/${theme}/${state.id}: audit saw only ${res.counts.leaves} leaves`)
              .toBeGreaterThanOrEqual(MIN_LEAVES);
            failures.push(...formatAudit(res, `${width}@${zoom}/${theme}/${state.id}`));
            await state.close();
            await expect(page.locator(state.ready)).toHaveCount(0);
          }

          expect(failures, failures.join('\n')).toEqual([]);
        });
      }
    });
  }
}
