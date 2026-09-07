const { test, expect } = require('@playwright/test');
const { APP_URL } = require('./lib/app-url');
const { installState, demoState, DATA_KEY } = require('./lib/seed-state');
const { XLSX, validBook } = require('./lib/make-workbook');
const { installLinkStub } = require('./lib/link-stub');

/* Decisions 32-37: the linked workbook.

   The real picker cannot be driven from here — the 8a spike measured that
   `showOpenFilePicker` fires neither Playwright's `filechooser` event nor
   CDP's `Page.fileChooserOpened`, and the permission bubble is browser UI
   besides (DECISION-LOG 262). So the pickers are replaced before the app loads
   and hand back a double — see lib/link-stub.js, which the responsive and zoom
   matrices share. What the double cannot fake, it does not: every write goes
   through the app's own encoder, and what lands is read back as a workbook. */

const FROZEN = new Date('2026-06-07T12:00:00Z');
const FILE = 'meridian.xlsx';

test.use({ viewport: { width: 1280, height: 900 } });

async function open(page, opts) {
  await installState(page, (opts && opts.state) || demoState());
  await installLinkStub(page, opts || {});
  await page.clock.setFixedTime(FROZEN);
  await page.goto(APP_URL);
  await expect(page.locator('.header')).toBeVisible();
}

async function openData(page) {
  if (await page.locator('.sheet__card').count() === 0) await page.click('[data-data-open]');
  await expect(page.locator('.sheet__card')).toBeVisible();
}

async function linkWorkbook(page) {
  await openData(page);
  await page.click('[data-link-existing]');
  await expect(page.locator('.datactl__state')).toHaveText('SAVED · AUTO');
  await page.keyboard.press('Escape');
  await expect(page.locator('.sheet__card')).toHaveCount(0);
}

/* Through the store, like data.spec.js: the screens that call it are Phase 2's,
   and this spec is about what reaches the file. */
async function logAnEntry(page, activity) {
  return page.evaluate((text) => window.Meridian.store.addEntry({
    date: window.Meridian.store.getState().entries[0].date,
    duration_min: 30,
    activity: text,
    category_id: 'cat_learn',
  }), activity || 'Added by a test');
}

const stat = (page) => page.evaluate(() => window.__file.stat());
const bytes = (page) => page.evaluate(() => window.__file.bytes());

async function workbookFromDisk(page) {
  const arr = await bytes(page);
  return XLSX.read(Buffer.from(arr), { type: 'buffer' });
}

async function activitiesOnDisk(page) {
  const wb = await workbookFromDisk(page);
  return XLSX.utils.sheet_to_json(wb.Sheets.Entries).map((r) => r.activity);
}

/* ---------- linking, and what a mutation does after it ---------- */

test('a linked workbook takes every submission, with one prompt at most', async ({ page }) => {
  await open(page);
  await linkWorkbook(page);

  // Linking writes at once, so the file is a workbook from the moment it exists.
  expect((await stat(page)).size).toBeGreaterThan(0);
  expect(await activitiesOnDisk(page)).not.toContain('First after linking');

  await logAnEntry(page, 'First after linking');
  await expect(page.locator('.datactl__state')).toHaveText('SAVED · AUTO');
  await expect.poll(() => activitiesOnDisk(page)).toContain('First after linking');

  // Decision 32: a successful write counts as an export, so nothing is pending
  // and the leave warning has nothing to arm.
  const info = await page.evaluate(() => window.Meridian.store.getState().exportInfo);
  expect(info.unexported).toBe(0);

  await logAnEntry(page, 'Second, no prompt');
  await expect.poll(() => activitiesOnDisk(page)).toContain('Second, no prompt');
  expect(await page.evaluate(() => window.__link.asks)).toBe(0);
});

test('the file the app writes is the file Export would have downloaded', async ({ page }) => {
  await open(page);
  await linkWorkbook(page);
  await logAnEntry(page, 'Mirror equals export');
  await expect.poll(() => activitiesOnDisk(page)).toContain('Mirror equals export');

  const onDisk = await bytes(page);
  const exported = await page.evaluate(() => Array.from(new Uint8Array(
    window.Meridian.workbook.encode(window.XLSX, window.Meridian.store.getState(), { now: new Date() })
  )));
  /* Byte equality would compare two zip timestamps, so the comparison is what
     the bytes decode to: every sheet, every row. */
  const decode = (arr) => {
    const wb = XLSX.read(Buffer.from(arr), { type: 'buffer' });
    return wb.SheetNames.map((n) => XLSX.utils.sheet_to_json(wb.Sheets[n]));
  };
  expect(decode(onDisk)).toEqual(decode(exported));
});

/* ---------- decision 33: the grant, and dismissing it ---------- */

test('a session that has not been granted asks once, on the mutation that needs it', async ({ page }) => {
  await open(page);
  await linkWorkbook(page);

  // A new browser session: the handle survives, the permission does not.
  await page.evaluate(() => { window.__link.permission = 'prompt'; });
  await page.reload();
  await expect(page.locator('.datactl__state')).toHaveText('SAVED · AUTO');

  await page.evaluate(() => { window.__link.request = 'granted'; });
  await logAnEntry(page, 'After the grant');
  await expect(page.locator('.datactl__state')).toHaveText('SAVED · AUTO');
  await expect.poll(() => activitiesOnDisk(page)).toContain('After the grant');
  expect(await page.evaluate(() => window.__link.asks)).toBe(1);
});

test('a dismissed prompt becomes SAVE · n, and the click grants and writes', async ({ page }) => {
  await open(page);
  await linkWorkbook(page);

  await page.evaluate(() => {
    window.__link.permission = 'prompt';
    window.__link.request = 'prompt';        // dismissed
  });
  await page.reload();

  await logAnEntry(page, 'While dismissed');
  await expect(page.locator('.datactl__state')).toHaveText('SAVE · 1');
  await expect(page.locator('.datactl__state')).toHaveClass(/datactl__state--live/);
  expect(await activitiesOnDisk(page)).not.toContain('While dismissed');

  // It does not ask again on every keystroke that follows.
  await logAnEntry(page, 'Also while dismissed');
  await expect(page.locator('.datactl__state')).toHaveText('SAVE · 2');
  expect(await page.evaluate(() => window.__link.asks)).toBe(1);

  // The control is the way back: it asks, and this time it is allowed.
  await page.evaluate(() => { window.__link.request = 'granted'; });
  await page.click('[data-data-open]');
  await expect(page.locator('.datactl__state')).toHaveText('SAVED · AUTO');
  const disk = await activitiesOnDisk(page);
  expect(disk).toContain('While dismissed');
  expect(disk).toContain('Also while dismissed');
  expect(await page.evaluate(() => window.Meridian.store.getState().exportInfo.unexported)).toBe(0);
});

test('closing the tab with SAVE · n pending still warns (spec §10)', async ({ page }) => {
  await open(page);
  await linkWorkbook(page);
  await page.evaluate(() => { window.__link.permission = 'prompt'; window.__link.request = 'prompt'; });
  await page.reload();
  await logAnEntry(page, 'Unsaved');
  await expect(page.locator('.datactl__state')).toHaveText('SAVE · 1');

  const armed = await page.evaluate(() => {
    const e = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  });
  expect(armed).toBe(true);
});

/* ---------- decision 35: a write that fails ---------- */

test('a write that fails is WORKBOOK LOCKED, and the next one clears it', async ({ page }) => {
  await open(page);
  await linkWorkbook(page);

  await page.evaluate(() => { window.__link.failWrite = 'InvalidStateError'; });
  await logAnEntry(page, 'While locked');
  await expect(page.locator('.datactl__state')).toHaveText('WORKBOOK LOCKED');
  await expect(page.locator('.datactl__state')).toHaveClass(/datactl__state--warn/);
  expect(await activitiesOnDisk(page)).not.toContain('While locked');
  // The counter keeps counting: nothing is lost, and the browser still warns.
  expect(await page.evaluate(() => window.Meridian.store.getState().exportInfo.unexported)).toBe(1);

  await page.evaluate(() => { window.__link.failWrite = null; });
  await logAnEntry(page, 'After the lock');
  await expect(page.locator('.datactl__state')).toHaveText('SAVED · AUTO');
  const disk = await activitiesOnDisk(page);
  expect(disk).toContain('While locked');
  expect(disk).toContain('After the lock');
});

test('the locked state also retries from the control itself', async ({ page }) => {
  await open(page);
  await linkWorkbook(page);
  await page.evaluate(() => { window.__link.failWrite = 'InvalidStateError'; });
  await logAnEntry(page, 'Retry from the header');
  await expect(page.locator('.datactl__state')).toHaveText('WORKBOOK LOCKED');

  await page.evaluate(() => { window.__link.failWrite = null; });
  await page.click('[data-data-open]');
  await expect(page.locator('.datactl__state')).toHaveText('SAVED · AUTO');
  expect(await activitiesOnDisk(page)).toContain('Retry from the header');
});

/* ---------- decisions 34 and 37 C: the file changed under us ---------- */

async function editTheFileOutside(page, activity) {
  const state = demoState();
  state.entries = state.entries.concat([{
    id: 'e_9001',
    date: state.entries[0].date,
    duration_min: 45,
    activity,
    category_id: 'cat_learn',
    goal_id: '',
    value: '',
    created_at: '2026-06-07T09:00:00',
  }]);
  const book = Array.from(validBook(state));
  return page.evaluate((arr) => window.__file.put(arr), book);
}

test('an outside edit stops the write, and Keep local overwrites it', async ({ page }) => {
  await open(page);
  await linkWorkbook(page);
  await editTheFileOutside(page, 'Typed in Excel');

  await logAnEntry(page, 'Logged after the edit');
  await expect(page.locator('.datactl__state')).toHaveText('EDITED OUTSIDE');
  // Nothing was written: the friend's typing is still in the file.
  expect(await activitiesOnDisk(page)).toContain('Typed in Excel');
  expect(await activitiesOnDisk(page)).not.toContain('Logged after the edit');

  await page.click('[data-data-open]');
  await expect(page.locator('.data__replace')).toHaveText('Your workbook changed outside Meridian.');
  await page.click('[data-keep-local]');

  await expect(page.locator('.datactl__state')).toHaveText('SAVED · AUTO');
  const disk = await activitiesOnDisk(page);
  expect(disk).toContain('Logged after the edit');
  expect(disk).not.toContain('Typed in Excel');
});

test('an outside edit, and Replace local takes the file instead', async ({ page }) => {
  await open(page);
  await linkWorkbook(page);
  await editTheFileOutside(page, 'Typed in Excel');
  await logAnEntry(page, 'Logged after the edit');
  await expect(page.locator('.datactl__state')).toHaveText('EDITED OUTSIDE');

  await page.click('[data-data-open]');
  await page.click('[data-replace-local]');
  await expect(page.locator('.report__head')).toHaveText('Imported.');
  await page.click('.sheet__foot .btn--brand');

  const activities = await page.evaluate(() =>
    window.Meridian.store.getState().entries.map((e) => e.activity));
  expect(activities).toContain('Typed in Excel');
  expect(activities).not.toContain('Logged after the edit');
  await expect(page.locator('.datactl__state')).toHaveText('SAVED · AUTO');
});

test('a workbook that cannot be read is written fresh, and says so', async ({ page }) => {
  await open(page);
  await linkWorkbook(page);
  await page.evaluate(() => window.__file.put(Array.from(
    new TextEncoder().encode('this is not a workbook at all'))));

  await logAnEntry(page, 'After the corruption');
  await expect(page.locator('.datactl__state')).toHaveText('EDITED OUTSIDE');
  await page.click('[data-data-open]');
  await expect(page.locator('.field__error')).toHaveText(
    'Your workbook could not be read, so Meridian has written it fresh.');
  await expect(page.locator('.datactl__state')).toHaveText('SAVED · AUTO');
  expect(await activitiesOnDisk(page)).toContain('After the corruption');
});

/* ---------- decision 37 B: reconnect ---------- */

test('reconnect with nothing pending simply opens what the workbook holds', async ({ page }) => {
  await open(page);
  await linkWorkbook(page);
  await editTheFileOutside(page, 'Edited between sessions');

  await page.reload();
  await expect(page.locator('.header')).toBeVisible();

  await expect.poll(() => page.evaluate(() =>
    window.Meridian.store.getState().entries.map((e) => e.activity)))
    .toContain('Edited between sessions');
  // No prompt: with nothing local at stake there is only one sensible answer.
  await expect(page.locator('.sheet__card')).toHaveCount(0);
});

test('reconnect with changes pending asks instead', async ({ page }) => {
  await open(page);
  await linkWorkbook(page);

  // Something logged that never reached the file, then an outside edit.
  await page.evaluate(() => { window.__link.failWrite = 'InvalidStateError'; });
  await logAnEntry(page, 'Never written');
  await expect(page.locator('.datactl__state')).toHaveText('WORKBOOK LOCKED');
  await editTheFileOutside(page, 'Edited between sessions');

  await page.reload();
  await expect(page.locator('.sheet__card')).toBeVisible();
  await expect(page.locator('.data__replace')).toHaveText('Your workbook changed outside Meridian.');

  // Whatever was holding the file has let go by now.
  await page.evaluate(() => { window.__link.failWrite = null; });
  await page.click('[data-keep-local]');
  await expect(page.locator('.datactl__state')).toHaveText('SAVED · AUTO');
  expect(await activitiesOnDisk(page)).toContain('Never written');
});

/* ---------- decision 37 A: linking a workbook that already holds data ---------- */

test('linking a workbook with data in it asks before writing over it', async ({ page }) => {
  await open(page);
  // The file already holds a dataset — someone else's, or last week's.
  await page.evaluate((arr) => window.__file.put(arr), Array.from(validBook(demoState())));
  await page.evaluate(async () => {
    const state = window.Meridian.store.getState();
    window.Meridian.store.addEntry({
      date: state.entries[0].date, duration_min: 15, activity: 'Only in the browser',
      category_id: 'cat_learn',
    });
  });

  await openData(page);
  await page.click('[data-link-existing]');
  await expect(page.locator('.data__replace')).toHaveText('Your workbook changed outside Meridian.');
  // Nothing has been written yet.
  const before = await stat(page);
  await page.click('[data-keep-local]');
  await expect(page.locator('.datactl__state')).toHaveText('SAVED · AUTO');
  expect((await stat(page)).lastModified).toBeGreaterThanOrEqual(before.lastModified);
  expect(await activitiesOnDisk(page)).toContain('Only in the browser');
});

/* ---------- decision 32: browsers without a picker ---------- */

test('Firefox and Safari see none of this, and export as before', async ({ page }) => {
  await open(page, { supported: false });
  await openData(page);

  await expect(page.locator('.data__wb')).toHaveCount(0);
  await expect(page.locator('[data-link-existing]')).toHaveCount(0);
  await expect(page.locator('[data-link-new]')).toHaveCount(0);

  // The export flow is untouched: the label is the one this app has always shown.
  await page.keyboard.press('Escape');
  await logAnEntry(page, 'No workbook here');
  await expect(page.locator('.datactl__state')).toHaveText('1 unexported change');
});
