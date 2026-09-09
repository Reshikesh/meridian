const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { APP_URL } = require('./lib/app-url');
const { auditInPage, formatAudit } = require('./lib/audit');
const { installState, demoState, DATA_KEY } = require('./lib/seed-state');
const { validBook, notAWorkbook, asUpload } = require('./lib/make-workbook');

/* Spec §10: "First-run flow ... must exist before anything renders."
   The three paths, the reload after each, and the two ways a workbook gets in. */

const FROZEN = new Date('2026-06-07T12:00:00Z');
const THEMES = ['paper', 'graphite', 'blueprint'];
const WIDTHS = [345, 360, 768, 1024, 1181, 1280, 1440, 1920];
const SHOT_WIDTHS = new Set([360, 1280]);
const SHOTS = path.join(__dirname, 'shots');

// The first-run header carries no nav, so it is a lighter page than the shell:
// wordmark + 3 theme buttons + stamp = 5, plus eyebrow, heading, note, the
// option cards at 2 leaves each, and the drop line. Three cards where the
// browser has no file picker (15), four where it has one and "Open a workbook"
// leads (17) — so the floor is the smaller. Its own floor, deliberately not the
// shell's 14 (see DECISION-LOG, phase 0 #27 — the point of the floor is that it
// fails loudly when the audit stops seeing the body).
const MIN_LEAVES = 15;

async function readState(page) {
  return page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  }, DATA_KEY);
}

test.describe('first run', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('an empty browser opens on the first-run screen, not on a screen with no data', async ({ page }) => {
    // QUALITY-BAR §8.3 and §8.4 apply here too: smoke.spec.js walks the shell,
    // which this screen stands in front of, so nothing else would see it.
    const noise = [];
    page.on('console', (m) => {
      if (m.type() === 'error' || m.type() === 'warning') noise.push(`${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => noise.push(`pageerror: ${e}`));
    page.on('request', (r) => {
      if (!/^(file|data|blob):/i.test(r.url())) noise.push(`network: ${r.url()}`);
    });

    await page.goto(APP_URL);
    await expect(page.locator('[data-s="firstrun"]')).toBeVisible();
    await expect(page.locator('.root')).toHaveAttribute('data-screen', 'firstrun');

    // Nothing to navigate to yet, and no data control before there is data.
    await expect(page.locator('[data-nav]')).toHaveCount(0);
    await expect(page.locator('[data-data-open]')).toHaveCount(0);

    // The three paths, and the header parts that still mean something.
    await expect(page.locator('[data-option="import"]')).toBeVisible();
    await expect(page.locator('[data-option="demo"]')).toBeVisible();
    await expect(page.locator('[data-option="empty"]')).toBeVisible();
    await expect(page.locator('.wordmark')).toHaveText('MERIDIAN');
    await expect(page.locator('.stamp')).not.toBeEmpty();
    await expect(page.locator('.themes__btn')).toHaveCount(3);

    for (const theme of THEMES) {
      await page.click(`[data-theme-btn="${theme}"]`);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    }

    expect(noise, noise.join('\n')).toEqual([]);
  });

  test('start with demo data: every screen has something, and a reload keeps it', async ({ page }) => {
    await page.clock.setFixedTime(FROZEN);
    await page.goto(APP_URL);
    await page.click('[data-option="demo"]');

    await expect(page.locator('.root')).toHaveAttribute('data-screen', 'went');
    await expect(page.locator('[data-nav]')).toHaveCount(5);

    // The demo badge is the control's own label: a separate chip does not fit in
    // the 1180px header at any width (see styles/components.css).
    await expect(page.locator('.datactl__label')).toHaveText('DEMO');
    await expect(page.locator('[data-data-open]')).toHaveAttribute('data-demo', '1');

    // Loading a regenerable dataset is not an unsaved change.
    await expect(page.locator('.datactl__state')).toHaveText('Nothing exported yet');

    const saved = await readState(page);
    expect(saved.source).toBe('demo');
    expect(saved.categories).toHaveLength(8);
    expect(saved.goals).toHaveLength(2);
    expect(saved.entries.length).toBeGreaterThan(70);
    expect(saved.exportInfo.unexported).toBe(0);

    await page.reload();
    await expect(page.locator('.datactl__label')).toHaveText('DEMO');
    expect((await readState(page)).entries.length).toBe(saved.entries.length);
  });

  test('start empty: the eight categories and their plan, nothing else', async ({ page }) => {
    await page.clock.setFixedTime(FROZEN);
    await page.goto(APP_URL);
    await page.click('[data-option="empty"]');

    await expect(page.locator('.root')).toHaveAttribute('data-screen', 'went');
    await expect(page.locator('.datactl__label')).toHaveText('DATA');

    const saved = await readState(page);
    expect(saved.source).toBe('empty');
    expect(saved.categories).toHaveLength(8);      // decision 9
    expect(saved.plan).toHaveLength(8);
    expect(saved.entries).toEqual([]);
    expect(saved.goals).toEqual([]);

    await page.reload();
    await expect(page.locator('.datactl__label')).toHaveText('DATA');
    expect((await readState(page)).categories).toHaveLength(8);
  });

  test('import a workbook from first run, through the file picker', async ({ page }) => {
    await page.goto(APP_URL);

    const chooser = page.waitForEvent('filechooser');
    await page.click('[data-option="import"]');
    await (await chooser).setFiles(asUpload(validBook(), 'meridian-data-2026-06-07.xlsx'));

    // The report comes first: nothing is written until it is accepted.
    await expect(page.locator('.report__head')).toContainText('rows read');
    expect(await readState(page)).toBeNull();

    await page.click('.sheet__foot .btn--brand');
    await expect(page.locator('.report__head')).toHaveText('Imported.');
    await page.click('.sheet__foot .btn--brand');

    await expect(page.locator('.sheet')).toHaveCount(0);
    await expect(page.locator('[data-nav]')).toHaveCount(5);
    const saved = await readState(page);
    expect(saved.source).toBe('import');
    expect(saved.categories).toHaveLength(8);
  });

  test('a dropped workbook imports; a dropped file that is not one is refused', async ({ page }) => {
    await page.goto(APP_URL);

    // A real DataTransfer, so this exercises the drop handler rather than a
    // synthetic shortcut through the click path.
    const dropFile = async (name, bytes, type) => {
      const handle = await page.evaluateHandle(([n, b, t]) => {
        const dt = new DataTransfer();
        dt.items.add(new File([new Uint8Array(b)], n, { type: t }));
        return dt;
      }, [name, Array.from(bytes), type]);
      await page.dispatchEvent('[data-s="firstrun"]', 'drop', { dataTransfer: handle });
    };

    await dropFile('notes.txt', notAWorkbook(), 'text/plain');
    await expect(page.locator('.field__error')).toHaveText('That is not an .xlsx workbook.');
    expect(await readState(page)).toBeNull();

    await dropFile('meridian-data-2026-06-07.xlsx', validBook(),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    await expect(page.locator('.report__head')).toContainText('rows read');
  });

  test('start fresh returns to first run and clears the browser', async ({ page }) => {
    // Start fresh only exists while the demo dataset is loaded: it is the demo
    // badge's other half (QUALITY-BAR §5).
    await installState(page, demoState());
    await page.goto(APP_URL);

    await page.click('[data-data-open]');
    await page.click('.linkbtn');                 // Start fresh
    await expect(page.locator('.confirm__text')).toBeVisible();
    await page.click('.btn--warn');               // Clear it

    await expect(page.locator('[data-s="firstrun"]')).toBeVisible();
    expect(await readState(page)).toBeNull();
  });
});

/* QUALITY-BAR §2 on the one screen the width matrix cannot reach, because it
   only exists when there is no data to seed. */
for (const width of WIDTHS) {
  test.describe(`first run at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } });

    for (const theme of THEMES) {
      test(`${theme} — no page scroll, no clipped text, no overlap`, async ({ page }, testInfo) => {
        await page.addInitScript((t) => {
          try { localStorage.setItem('meridian:theme', t); } catch (e) { /* private mode */ }
        }, theme);
        await page.clock.setFixedTime(FROZEN);
        await page.goto(APP_URL);
        await expect(page.locator('[data-s="firstrun"]')).toBeVisible();
        await page.waitForFunction(
          () => document.getAnimations().every((a) => a.playState === 'finished'));

        const res = await page.evaluate(auditInPage);
        expect(res.counts.leaves,
          `${width}/${theme}/firstrun: audit saw only ${res.counts.leaves} leaves`)
          .toBeGreaterThanOrEqual(MIN_LEAVES);

        const failures = formatAudit(res, `${width}/${theme}/firstrun`);
        expect(failures, failures.join('\n')).toEqual([]);

        if (SHOT_WIDTHS.has(width)) {
          await page.screenshot({
            path: path.join(SHOTS, testInfo.project.name, theme,
              `firstrun-${String(width).padStart(4, '0')}.png`),
            fullPage: true,
            animations: 'disabled',
          });
        }
      });
    }
  });
}
