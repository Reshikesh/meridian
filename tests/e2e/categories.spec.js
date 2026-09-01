const { test, expect } = require('@playwright/test');
const { APP_URL } = require('./lib/app-url');
const { installState, DATA_KEY } = require('./lib/seed-state');

/* Spec §12 "Manage categories", and business rules §8.3, §8.10 and §8.11:
   archive keeps every hour and every historical range, delete only clears a
   category nobody has lived, and only More categories carry goals. */

const FROZEN = new Date('2026-06-07T12:00:00Z');

test.use({ viewport: { width: 1280, height: 900 } });

async function openManage(page) {
  await page.clock.setFixedTime(FROZEN);
  await installState(page);
  await page.goto(APP_URL);
  await page.click('[data-nav="log"]');
  await page.click('.btn--quiet');
  await expect(page.locator('.sheet--wide .sheet__card')).toBeVisible();
}

async function categories(page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)).categories, DATA_KEY);
}

function row(page, name) {
  return page.locator('.manage__rowwrap').filter({ hasText: name });
}

test('the sheet lists every category against the waking week (decision 17)', async ({ page }) => {
  await openManage(page);

  await expect(page.locator('.sheet__title')).toHaveText('CATEGORIES — 91.5 H THIS WEEK');
  await expect(page.locator('.manage__head')).toContainText('SHARE OF 112 H');
  await expect(page.locator('.manage__footnote')).toContainText('adding up to 112');
  await expect(page.locator('.manage__rowwrap')).toHaveCount(8);

  // A Less category's hours are the warn colour (deck-10).
  await expect(row(page, 'Scrolling').locator('.managerow__hours')).toHaveText('13.0 h');
  await expect(row(page, 'Scrolling').locator('.managerow__hours')).toHaveClass(/--warn/);
  await expect(row(page, 'Work').locator('.dirtag')).toHaveText('UPKEEP');
  await expect(row(page, 'Learning').locator('.dirtag')).toHaveText('MORE');
});

/* ---------- archive and restore (§8.10, §8.11) ---------- */

test('archiving a category with hours confirms inline, and restore reverses it', async ({ page }) => {
  await openManage(page);

  await row(page, 'Family').getByRole('button', { name: 'archive' }).click();
  await expect(page.locator('.confirm--row')).toContainText('Archiving keeps the');
  // All time, not this week: what archiving keeps is every hour ever logged to
  // it, which is the same figure the archived row then shows as "kept".
  await expect(page.locator('.confirm--row')).toContainText('22.0 h');

  // Backing out changes nothing.
  await page.click('.confirm--row .btn:not(.btn--warn)');
  await expect(page.locator('.confirm--row')).toHaveCount(0);
  expect((await categories(page)).find((c) => c.id === 'cat_family').archived).toBe(false);

  await row(page, 'Family').getByRole('button', { name: 'archive' }).click();
  await page.click('.confirm--row .btn--warn');

  const after = (await categories(page)).find((c) => c.id === 'cat_family');
  expect(after.archived).toBe(true);
  expect(after.archived_on).toBe('2026-06-07');

  // The row becomes the mockup's archived row: hours kept, out of the plan.
  const archived = row(page, 'Family');
  await expect(archived.locator('.dirtag')).toHaveText('ARCHIVED');
  await expect(archived.locator('.managerow__kept')).toContainText('h kept');
  await expect(archived.locator('.managerow__kept')).toContainText('to 7 Jun');
  await expect(archived.locator('.managerow__note'))
    .toHaveText('Out of the plan, still in the history');
  await expect(archived.getByRole('button', { name: 'restore' })).toBeVisible();

  // Archived rows fall to the end of the list.
  await expect(page.locator('.manage__rowwrap').last()).toContainText('Family');

  await archived.getByRole('button', { name: 'restore' }).click();
  const restored = (await categories(page)).find((c) => c.id === 'cat_family');
  expect(restored.archived).toBe(false);
  expect(restored.archived_on).toBe(null);
  await expect(row(page, 'Family').locator('.dirtag')).toHaveText('MORE');
});

test('an archived category leaves the pickers and stays in the history (§8.11)', async ({ page }) => {
  await openManage(page);
  await row(page, 'Family').getByRole('button', { name: 'archive' }).click();
  await page.click('.confirm--row .btn--warn');
  await page.click('.sheet__foot .btn--brand');
  await expect(page.locator('.sheet__card')).toHaveCount(0);

  // Gone from the quick-add picker...
  const options = await page.locator('.quickadd__row .select__input option')
    .evaluateAll((els) => els.map((el) => el.value));
  expect(options).not.toContain('cat_family');
  expect(options).toContain('cat_learn');

  // ...and still on the entry it was logged against.
  await expect(page.locator('.logrow--entry').filter({ hasText: 'Lunch with family' })
    .locator('.catchip')).toHaveText('Family');
  await expect(page.locator('.logday .t-h1')).toHaveText('5.0 h accounted for, 11.0 to go');
});

/* ---------- delete, only at zero hours (§8.10) ---------- */

test('delete is absent while a category has hours, and present when it has none', async ({ page }) => {
  await openManage(page);

  await expect(row(page, 'Work').getByRole('button', { name: 'archive' })).toBeVisible();
  await expect(row(page, 'Work').getByRole('button', { name: 'delete' })).toHaveCount(0);

  // A category nobody has lived: created here, so it starts at zero.
  await page.click('.sheet__tools .btn--brand');
  await page.locator('.fld--name').fill('Volunteering');
  await page.click('.sheet--stacked .btn--brand');
  await expect(page.locator('.sheet--stacked')).toHaveCount(0);

  const fresh = row(page, 'Volunteering');
  await expect(fresh.locator('.managerow__note')).toHaveText('Never used — safe to delete');
  await expect(fresh.locator('.managerow__hours')).toHaveText('0.0 h');
  await expect(fresh.getByRole('button', { name: 'archive' })).toHaveCount(0);

  await fresh.getByRole('button', { name: 'delete' }).click();
  await expect(page.locator('.confirm--row')).toContainText('Delete Volunteering?');
  await page.click('.confirm--row .btn--warn');

  await expect(page.locator('.manage__rowwrap')).toHaveCount(8);
  expect((await categories(page)).some((c) => c.name === 'Volunteering')).toBe(false);
});

/* ---------- the stacked New category sheet ---------- */

test('the new sheet stacks over Manage and closes back to it', async ({ page }) => {
  await openManage(page);

  await page.click('.sheet__tools .btn--brand');
  await expect(page.locator('.sheet--stacked')).toBeVisible();
  await expect(page.locator('.sheet--stacked .sheet__title')).toHaveText('NEW CATEGORY');
  // Decision 21: no COUNTS TOWARD block.
  await expect(page.locator('.sheet--stacked')).not.toContainText('COUNTS TOWARD');

  // Escape belongs to the topmost sheet only: Manage is still standing.
  await page.keyboard.press('Escape');
  await expect(page.locator('.sheet--stacked')).toHaveCount(0);
  await expect(page.locator('.sheet--wide .sheet__card')).toBeVisible();

  // Cancel does the same, and gives focus back to the button that opened it.
  await page.click('.sheet__tools .btn--brand');
  await page.click('.sheet--stacked .sheet__foot .btn:not(.btn--brand)');
  await expect(page.locator('.sheet--stacked')).toHaveCount(0);
  await expect(page.locator('.sheet__tools .btn--brand')).toBeFocused();
});

test('a new category is written with its colour and direction', async ({ page }) => {
  await openManage(page);
  await page.click('.sheet__tools .btn--brand');

  await page.locator('.fld--name').fill('Volunteering');
  await page.locator('.swatches__btn').nth(2).click();
  await page.locator('.dir').filter({ hasText: 'Upkeep' }).click();
  await page.click('.sheet--stacked .btn--brand');

  const added = (await categories(page)).find((c) => c.name === 'Volunteering');
  expect(added.colour).toBe('#a8641d');
  expect(added.direction).toBe('upkeep');
  expect(added.weekly_plan_hours).toBe(0);
  expect(added.archived).toBe(false);
  await expect(page.locator('.datactl__state')).toHaveText('1 unexported change');
});

test('a blank or duplicate name is refused inline', async ({ page }) => {
  await openManage(page);
  await page.click('.sheet__tools .btn--brand');

  await page.click('.sheet--stacked .btn--brand');
  await expect(page.locator('.sheet--stacked .field__error')).toHaveText('Give it a name.');
  await expect(page.locator('.sheet--stacked')).toBeVisible();

  await page.locator('.fld--name').fill('learning');
  await page.click('.sheet--stacked .btn--brand');
  await expect(page.locator('.sheet--stacked .field__error'))
    .toHaveText('You already have a category with that name.');
  expect((await categories(page)).length).toBe(8);
});

/* ---------- the row editor ---------- */

test('a row renames in place and saves colour, direction and planned hours', async ({ page }) => {
  await openManage(page);

  // Clicking the name is the same action as `edit` — the mockup's dashed
  // underline, with the editor it never had behind it.
  await row(page, 'Reading').locator('.managerow__label--edit').click();
  await expect(page.locator('.manage__editor')).toBeVisible();
  await expect(page.locator('.fld--rowname')).toBeFocused();

  await page.locator('.fld--rowname').fill('Books');
  await page.locator('.swatches__btn').nth(1).click();
  await page.locator('.fld--plan').fill('4.5');
  await page.click('.manage__editoractions .btn--brand');

  await expect(page.locator('.manage__editor')).toHaveCount(0);
  const saved = (await categories(page)).find((c) => c.id === 'cat_reading');
  expect(saved.name).toBe('Books');
  expect(saved.colour).toBe('#2b4a7d');
  expect(saved.weekly_plan_hours).toBe(4.5);
  await expect(row(page, 'Books')).toBeVisible();
});

test('Cancel in the row editor writes nothing', async ({ page }) => {
  await openManage(page);
  await row(page, 'Reading').getByRole('button', { name: 'edit' }).click();
  await page.locator('.fld--rowname').fill('Books');
  await page.click('.manage__editoractions .btn:not(.btn--brand)');

  await expect(page.locator('.manage__editor')).toHaveCount(0);
  expect((await categories(page)).find((c) => c.id === 'cat_reading').name).toBe('Reading');
  await expect(page.locator('.datactl__state')).toHaveText('Nothing exported yet');
});

test('a category that feeds a goal cannot stop being More (§8.3)', async ({ page }) => {
  await openManage(page);
  await row(page, 'Learning').getByRole('button', { name: 'edit' }).click();
  await page.locator('.manage__editor .dir').filter({ hasText: 'Less' }).click();
  await page.click('.manage__editoractions .btn--brand');

  await expect(page.locator('.manage__editor .field__error'))
    .toContainText('Only More categories carry goals');
  expect((await categories(page)).find((c) => c.id === 'cat_learn').direction).toBe('more');
});

test('a rename that collides with another category is refused', async ({ page }) => {
  await openManage(page);
  await row(page, 'Reading').getByRole('button', { name: 'edit' }).click();
  await page.locator('.fld--rowname').fill('Exercise');
  await page.click('.manage__editoractions .btn--brand');

  await expect(page.locator('.manage__rowerror'))
    .toHaveText('You already have a category with that name.');
  expect((await categories(page)).find((c) => c.id === 'cat_reading').name).toBe('Reading');
});

/* ---------- what the Log screen does with no categories at all ---------- */

test('with every category gone, the row says so instead of failing quietly', async ({ page }) => {
  await page.clock.setFixedTime(FROZEN);
  await installState(page);
  await page.goto(APP_URL);
  // Nothing lived, so every category is deletable: the "zero categories" state
  // spec §12 asks for is reachable rather than hypothetical.
  await page.evaluate(() => {
    const store = window.Meridian.store;
    const s = store.getState();
    s.entries.slice().forEach((e) => store.deleteEntry(e.id));
    store.getState().categories.slice().forEach((c) => store.deleteCategory(c.id));
  });

  await page.click('[data-nav="log"]');
  await expect(page.locator('.quickadd__note')).toContainText('No categories yet');
  await expect(page.locator('.quickadd__row .fld--duration')).toBeDisabled();

  await page.click('.btn--quiet');
  await expect(page.locator('.manage__empty')).toContainText('No categories yet');
});
