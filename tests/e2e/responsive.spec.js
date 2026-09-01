const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { APP_URL } = require('./lib/app-url');
const { auditInPage, formatAudit } = require('./lib/audit');
const { installState } = require('./lib/seed-state');

// QUALITY-BAR §2 mandates 360 / 768 / 1024 / 1280 / 1440 / 1920. Each also
// appears minus a 15 px classic scrollbar, because headed Edge on Windows
// reserves 15 px for it while headless reserves 0 — an overflow the owner would
// actually see at 1280 is invisible to a headless run at the round width.
// 1181 is the container-plus-borders edge case: the layout's widest fixed
// container plus its two 1 px rules, where an off-by-one first shows up.
const WIDTHS = [345, 360, 753, 768, 1009, 1024, 1181, 1265, 1280, 1425, 1440, 1905, 1920];

const THEMES = ['paper', 'graphite', 'blueprint'];
const SCREENS = ['log', 'went', 'progress', 'goals', 'plan', 'lessons'];

// Screenshots only at the narrow and the reference width: 2 widths x 3 themes
// x 6 screens = 36 PNGs per project. The other 11 widths still run all three
// audit checks — they just do not add churn to the shots folder.
const SHOT_WIDTHS = new Set([360, 1280]);
const SHOTS = path.join(__dirname, 'shots');

// The header alone is 11 leaves. A full screen adds the eyebrow, heading and
// note, so any healthy audit sees at least 14. Falling back to 11 means the
// screen body went unchecked — the failure mode this floor exists to catch.
const MIN_LEAVES = 14;

// Frozen so full-page screenshots do not churn every day. Config pins the
// browser to UTC, and page.clock takes an ABSOLUTE instant — a bare
// 'YYYY-MM-DDTHH:mm:ss' would be parsed in Node's timezone, so always pass ...Z.
const FROZEN = new Date('2026-06-07T12:00:00Z');

for (const width of WIDTHS) {
  test.describe(`${width}px`, () => {
    // Only `viewport` may be set in a describe-level test.use(). `channel` and
    // `headless` cannot — they force a new worker and Playwright rejects them
    // outside the top level of the config.
    test.use({ viewport: { width, height: 900 } });

    for (const theme of THEMES) {
      test(`${theme} — every screen: no page scroll, no clipped text, no overlap`, async ({ page }, testInfo) => {
        // Seed the theme BEFORE load so the pre-paint script reads it. This
        // assertion does NOT prove the pre-paint path — toHaveAttribute retries,
        // and app.js sets data-theme after mount, so it passes even with the
        // pre-paint script deleted. smoke.spec.js proves that, by reading the
        // attribute at waitUntil:'commit'.
        await page.addInitScript((t) => {
          try { localStorage.setItem('meridian:theme', t); } catch (e) { /* private mode */ }
        }, theme);
        // The shell only exists once there is data; first run is its own spec.
        await installState(page);
        await page.clock.setFixedTime(FROZEN);

        await page.goto(APP_URL);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

        // Collect across ALL screens and assert once, so a single run reports
        // every problem instead of stopping at the first bad screen.
        const failures = [];
        for (const screen of SCREENS) {
          await page.click(`[data-nav="${screen}"]`);
          await expect(page.locator('.root')).toHaveAttribute('data-screen', screen);
          await expect(page.locator(`main.screen[data-s="${screen}"]`)).toBeVisible();

          // The screen cross-fade starts the incoming screen at opacity 0, and
          // the auditor treats an opacity-0 ancestor as invisible. Auditing
          // before the fade settles silently reduced this to a header-only check
          // on most screens. Wait for it, then require that the audit actually
          // saw the screen body.
          await page.waitForFunction(
            () => document.getAnimations().every((a) => a.playState === 'finished'));

          const res = await page.evaluate(auditInPage);
          expect(res.counts.leaves,
            `${width}/${theme}/${screen}: audit saw only ${res.counts.leaves} leaves — `
            + 'the screen body was invisible to it').toBeGreaterThanOrEqual(MIN_LEAVES);
          failures.push(...formatAudit(res, `${width}/${theme}/${screen}`));

          if (SHOT_WIDTHS.has(width)) {
            const file = path.join(
              SHOTS,
              testInfo.project.name,
              theme,
              `${screen}-${String(width).padStart(4, '0')}.png`
            );
            await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
          }
        }

        // QUALITY-BAR §2 says "every screen AND sheet open". Every sheet the
        // app has is opened here, one after another, at every width and theme.
        // `open` leaves the app on the sheet; `close` puts it back.
        const SHEETS = [
          {
            id: 'data',
            open: async () => page.click('[data-data-open]'),
            close: async () => page.keyboard.press('Escape'),
          },
          {
            id: 'entry',
            open: async () => {
              await page.click('[data-nav="log"]');
              await page.click('.quickadd__open');
              // The tallest state of the sheet: a goal picked, so the category
              // is locked and the projection panel is on screen.
              await page.locator('.seg').first().getByText('2 h', { exact: true }).click();
              await page.locator('.seg').nth(1).getByText('Learn Python').click();
            },
            close: async () => page.keyboard.press('Escape'),
          },
          {
            id: 'manage',
            open: async () => {
              await page.click('[data-nav="log"]');
              await page.click('.btn--quiet');
            },
            close: async () => page.keyboard.press('Escape'),
          },
          {
            id: 'manage-editing',
            open: async () => {
              await page.click('[data-nav="log"]');
              await page.click('.btn--quiet');
              await page.locator('.manage__rowwrap').first()
                .getByRole('button', { name: 'edit' }).click();
            },
            close: async () => page.keyboard.press('Escape'),
          },
          {
            id: 'category',
            open: async () => {
              await page.click('[data-nav="log"]');
              await page.click('.btn--quiet');
              await page.click('.sheet__tools .btn--brand');
            },
            // Two sheets deep, so two Escapes.
            close: async () => {
              await page.keyboard.press('Escape');
              await page.keyboard.press('Escape');
            },
          },
        ];

        for (const sheet of SHEETS) {
          await sheet.open();
          await expect(page.locator('.sheet__card').last()).toBeVisible();
          await page.waitForFunction(
            () => document.getAnimations().every((a) => a.playState === 'finished'));

          const sheetAudit = await page.evaluate(auditInPage);
          expect(sheetAudit.counts.leaves,
            `${width}/${theme}/${sheet.id}: audit saw only ${sheetAudit.counts.leaves} leaves`)
            .toBeGreaterThanOrEqual(MIN_LEAVES);
          failures.push(...formatAudit(sheetAudit, `${width}/${theme}/sheet-${sheet.id}`));

          if (SHOT_WIDTHS.has(width)) {
            await page.screenshot({
              path: path.join(SHOTS, testInfo.project.name, theme,
                `sheet-${sheet.id}-${String(width).padStart(4, '0')}.png`),
              fullPage: true,
              animations: 'disabled',
            });
          }

          await sheet.close();
          await expect(page.locator('.sheet__card')).toHaveCount(0);
        }

        expect(failures, failures.join('\n')).toEqual([]);
      });
    }
  });
}
