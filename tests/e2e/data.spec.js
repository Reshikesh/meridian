const { test, expect } = require('@playwright/test');
const { APP_URL } = require('./lib/app-url');
const { installState, demoState, DATA_KEY } = require('./lib/seed-state');
const {
  XLSX, validBook, brokenBook, notAWorkbook, futureSchemaBook, asUpload,
} = require('./lib/make-workbook');
const workbook = require('../../src/core/workbook.js');

/* Spec §12 "Import / export / shell", and QUALITY-BAR §5's unexported-changes
   indicator. Everything the friend's data depends on. */

const FROZEN = new Date('2026-06-07T12:00:00Z');

test.use({ viewport: { width: 1280, height: 900 } });

async function readState(page) {
  return page.evaluate((k) => {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : null;
  }, DATA_KEY);
}

// The store is the unit under test here: the screens that will call it are
// Phase 2's. Going through it directly is the honest way to move the counter.
async function logAnEntry(page) {
  return page.evaluate(() => window.Meridian.store.addEntry({
    date: window.Meridian.store.getState().entries[0].date,
    duration_min: 30,
    activity: 'Added by a test',
    category_id: 'cat_learn',
    goal_id: 'goal_py',
  }));
}

// The sheet stays open across a refused import, so opening it again would mean
// clicking the header through the veil.
async function openData(page) {
  if (await page.locator('.sheet__card').count() === 0) {
    await page.click('[data-data-open]');
  }
  await expect(page.locator('.sheet__card')).toBeVisible();
}

async function importFile(page, upload) {
  await openData(page);
  const chooser = page.waitForEvent('filechooser');
  await page.click('.data__actions .btn:not(.btn--brand)');
  await (await chooser).setFiles(upload);
}

test('export writes meridian-data-YYYY-MM-DD.xlsx and clears the counter', async ({ page }) => {
  await page.clock.setFixedTime(FROZEN);
  await installState(page);
  await page.goto(APP_URL);

  await logAnEntry(page);
  await expect(page.locator('.datactl__state')).toHaveText('1 unexported change');
  // ...uppercased by the stylesheet, not by the string, so there is one sentence
  // to change and the Data sheet can show the same one in its own case.
  expect(await page.locator('.datactl').evaluate((el) => getComputedStyle(el).textTransform))
    .toBe('uppercase');

  await openData(page);
  const downloading = page.waitForEvent('download');
  await page.click('.data__actions .btn--brand');
  const download = await downloading;

  expect(download.suggestedFilename()).toBe('meridian-data-2026-06-07.xlsx');
  await expect(page.locator('.datactl__state')).toHaveText('Exported just now');
  expect((await readState(page)).exportInfo.unexported).toBe(0);

  // The bytes that reached the disk are a workbook the app can read back.
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  const back = workbook.decode(XLSX, Buffer.concat(chunks), { now: FROZEN });
  expect(back.report.fatal).toBeNull();
  expect(back.state.entries).toHaveLength((await readState(page)).entries.length);

  // Clean tables: a header row on every sheet, and no formula anywhere.
  const wb = XLSX.read(Buffer.concat(chunks), { type: 'buffer', raw: true });
  expect(wb.SheetNames).toEqual(workbook.SHEETS.map((s) => s.name));
  for (const def of workbook.SHEETS) {
    const ws = wb.Sheets[def.name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    expect(rows[0], `${def.name} header row`).toEqual(def.columns);
    for (const addr of Object.keys(ws)) {
      if (addr[0] === '!') continue;
      expect(ws[addr].f, `${def.name}!${addr} must not be a formula`).toBeUndefined();
    }
  }
});

test('a workbook with three broken rows imports the rest and names all three', async ({ page }) => {
  await page.clock.setFixedTime(FROZEN);
  await installState(page);
  await page.goto(APP_URL);

  const before = (await readState(page)).entries.length;
  await importFile(page, asUpload(brokenBook(), 'edited.xlsx'));

  await expect(page.locator('.report__head')).toContainText('3 rejected');
  const rejects = page.locator('.report__reject');
  await expect(rejects).toHaveCount(3);

  // Sheet, row number and reason — nothing fails silently (decision 5).
  await expect(rejects.nth(0)).toContainText('Entries · row 2');
  await expect(rejects.nth(0)).toContainText('duration_min "ninety" is not a whole number');
  await expect(rejects.nth(1)).toContainText('Entries · row 3');
  await expect(rejects.nth(1)).toContainText('is not an ISO date');
  await expect(rejects.nth(2)).toContainText('Entries · row 4');
  await expect(rejects.nth(2)).toContainText('is not in the Categories sheet');

  // Decision 15: never merge, and never replace without being told to.
  await expect(page.locator('.data__replace')).toBeVisible();
  await page.click('.sheet__foot .btn:not(.btn--brand)');       // Keep local, discard import
  expect((await readState(page)).entries.length).toBe(before);

  await importFile(page, asUpload(brokenBook(), 'edited.xlsx'));
  await page.click('.sheet__foot .btn--brand');                 // Replace local data
  await expect(page.locator('.report__head')).toHaveText('Imported.');
  expect((await readState(page)).entries.length).toBe(before - 3);
});

test('an edit made in Excel survives import and comes back out again', async ({ page }) => {
  await page.clock.setFixedTime(FROZEN);
  await installState(page);
  await page.goto(APP_URL);

  // What the owner does at the checkpoint: change one activity and one duration.
  const edited = demoState();
  edited.entries[0].activity = 'Edited in Excel';
  edited.entries[0].duration_min = 45;

  await importFile(page, asUpload(validBook(edited), 'edited.xlsx'));
  await page.click('.sheet__foot .btn--brand');
  await expect(page.locator('.report__head')).toHaveText('Imported.');

  const saved = await readState(page);
  const row = saved.entries.find((e) => e.id === edited.entries[0].id);
  expect(row.activity).toBe('Edited in Excel');
  expect(row.duration_min).toBe(45);

  // ...and out again: the second export carries the edit.
  await page.click('.sheet__foot .btn--brand');                 // Done
  await openData(page);
  const downloading = page.waitForEvent('download');
  await page.click('.data__actions .btn--brand');
  const stream = await (await downloading).createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  const back = workbook.decode(XLSX, Buffer.concat(chunks), { now: FROZEN });
  const again = back.state.entries.find((e) => e.id === edited.entries[0].id);
  expect(again.activity).toBe('Edited in Excel');
  expect(again.duration_min).toBe(45);
});

test('a file that is not a workbook, and one from a newer Meridian, both fail cleanly', async ({ page }) => {
  await installState(page);
  await page.goto(APP_URL);
  const before = (await readState(page)).entries.length;

  await importFile(page, { name: 'notes.txt', mimeType: 'text/plain', buffer: notAWorkbook() });
  await expect(page.locator('.field__error')).toHaveText('That is not an .xlsx workbook.');

  await importFile(page, { name: 'notes.xlsx', mimeType: 'text/plain', buffer: notAWorkbook() });
  await expect(page.locator('.report__head--warn')).toHaveText('Import failed.');
  await expect(page.locator('.report__line')).toContainText('could not be opened');
  await page.click('.sheet__foot .btn');
  expect((await readState(page)).entries.length).toBe(before);

  await importFile(page, asUpload(futureSchemaBook(), 'from-the-future.xlsx'));
  await expect(page.locator('.report__head--warn')).toHaveText('Import failed.');
  await expect(page.locator('.report__line')).toContainText('newer version of Meridian');
  await page.click('.sheet__foot .btn');
  expect((await readState(page)).entries.length).toBe(before);
});

test('unexported changes survive a reload and warn on the way out', async ({ page }) => {
  await installState(page);
  await page.goto(APP_URL);

  await logAnEntry(page);
  await logAnEntry(page);
  await expect(page.locator('.datactl__state')).toHaveText('2 unexported changes');

  await page.reload();
  await expect(page.locator('.datactl__state')).toHaveText('2 unexported changes');

  /* Only the positive case is asserted. Under Playwright the page already
     counts as interacted with before any click, so a "no dialog when there is
     nothing to lose" test would pass for the wrong reason and prove nothing. */
  const dialogs = [];
  page.on('dialog', (d) => { dialogs.push(d.type()); d.dismiss(); });
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => dialogs).toEqual(['beforeunload']);
});

test('the sheet closes on Escape, on the veil, and returns focus to its opener', async ({ page }) => {
  await installState(page);
  await page.goto(APP_URL);

  await openData(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.sheet')).toHaveCount(0);
  await expect(page.locator('[data-data-open]')).toBeFocused();

  await openData(page);
  await page.locator('.sheet').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('.sheet')).toHaveCount(0);
  await expect(page.locator('[data-data-open]')).toBeFocused();

  // First field focused on open, and Tab stays inside.
  await openData(page);
  await expect(page.locator('.data__actions .btn--brand')).toBeFocused();
  for (let i = 0; i < 12; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('.sheet__card'))).toBe(true);
});
