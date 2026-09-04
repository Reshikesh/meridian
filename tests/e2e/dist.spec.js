const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');
const { ROOT } = require('./lib/app-url');

/* QUALITY-BAR §8 and BUILD-PLAN § Phase 5: "the zip opens on a machine that has
   never seen the project". So this does not touch the repository — it unpacks
   dist/meridian-v1.zip somewhere else and drives that copy, offline, exactly as
   the friend will on their first evening.

   Skipped rather than failed when the zip has not been cut: `npm run package`
   makes it, and a red suite on a machine that simply has not built yet would
   teach everyone to ignore this file. */

/* The artefact is named from the version constant (decision 28), so this test
   and the packaging script cannot disagree about which file to look for. */
const { VERSION } = require('../../src/core/version.js');
const ZIP = path.join(ROOT, 'dist', `meridian-${VERSION}.zip`);
const OUT = path.join(ROOT, 'tests', 'e2e', 'test-results', 'unzipped');

test.use({ viewport: { width: 1280, height: 900 } });

test.describe('the packaged zip', () => {
  /* One worker: both tests share the one unpacked folder, and in parallel each
     worker's beforeAll deletes it under the other. */
  test.describe.configure({ mode: 'serial' });
  test.skip(!fs.existsSync(ZIP), `dist/meridian-${VERSION}.zip not built — run \`npm run package\``);

  test.beforeAll(() => {
    fs.rmSync(OUT, { recursive: true, force: true });
    fs.mkdirSync(OUT, { recursive: true });
    execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command',
      `Expand-Archive -Path '${ZIP}' -DestinationPath '${OUT}' -Force`]);
  });

  test('carries the app and nothing of the owner', () => {
    const seen = [];
    (function walk(dir) {
      for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        if (fs.statSync(full).isDirectory()) walk(full);
        else seen.push(path.relative(OUT, full).split(path.sep).join('/'));
      }
    }(OUT));

    expect(seen).toContain('index.html');
    expect(seen).toContain('README-for-tester.md');
    expect(seen).toContain('vendor/licences/archivo-OFL.txt');
    // Nothing of the owner's, and nothing of the build.
    expect(seen.filter((f) => /\.(xlsx|xlsm|csv)$/i.test(f))).toEqual([]);
    expect(seen.filter((f) => f.endsWith('.spec.js'))).toEqual([]);
    expect(seen.filter((f) => /^(tests|docs|design|node_modules|\.git)\//.test(f))).toEqual([]);
    // The folder the README tells them to export into exists and is otherwise bare.
    expect(seen.filter((f) => f.startsWith('data/'))).toEqual(['data/PUT-YOUR-EXPORTS-HERE.txt']);
  });

  test('opens offline, first-runs, logs and exports, in silence', async ({ page }) => {
    const errors = [];
    const remote = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('request', (r) => { if (!r.url().startsWith('file://')) remote.push(r.url()); });

    await page.context().setOffline(true);
    await page.goto(pathToFileURL(path.join(OUT, 'index.html')).href);

    await expect(page.locator('.firstrun')).toBeVisible();
    await page.getByText('Start with demo data').click();
    await expect(page.locator('.root')).toBeVisible();

    for (const theme of ['graphite', 'blueprint', 'paper']) {
      await page.click(`[data-theme-btn="${theme}"]`);
      for (const screen of ['log', 'went', 'progress', 'goals', 'lessons']) {
        await page.click(`[data-nav="${screen}"]`);
        await expect(page.locator(`main.screen[data-s="${screen}"]`)).toBeVisible();
      }
    }

    // One entry, the way the README describes it.
    await page.click('[data-nav="log"]');
    const before = await page.locator('.logrow--entry').count();
    await page.locator('.fld--duration').first().fill('1.5h');
    await page.locator('.fld--activity').first().fill('First evening');
    await page.selectOption('.select--cat select', { index: 1 });
    await page.locator('.fld--duration').first().press('Enter');
    await expect(page.locator('.logrow--entry')).toHaveCount(before + 1);

    // The export the README calls their only real backup.
    const download = page.waitForEvent('download');
    await page.click('[data-data-open]');
    await page.getByRole('button', { name: /Export/ }).first().click();
    expect((await download).suggestedFilename())
      .toMatch(/^meridian-data-\d{4}-\d{2}-\d{2}\.xlsx$/);

    // It survives being closed and reopened, which is the whole promise.
    await page.reload();
    await expect(page.locator('[data-nav="log"]')).toBeVisible();
    await page.click('[data-nav="log"]');
    await expect(page.locator('.logrow--entry')).toHaveCount(before + 1);

    expect(errors, 'console errors: ' + errors.join(' | ')).toEqual([]);
    expect(remote, 'network requests: ' + remote.join(' | ')).toEqual([]);
  });
});
