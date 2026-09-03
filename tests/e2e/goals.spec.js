const { test, expect } = require('@playwright/test');
const { APP_URL } = require('./lib/app-url');
const { installState, emptyState, DATA_KEY } = require('./lib/seed-state');

/* Spec §12 "Goals", §4h, §6, and business rules §8.2–§8.5: a goal is fed by one
   More category, its projection is straight-line from logged hours, and
   archiving keeps every one of them.

   The demo dataset is fourteen days ending Sunday 7 June 2026 (the mockup's own
   "today"), so Learn Python has twelve logged days behind it — enough history
   to project — and a brand-new goal has none. */

const FROZEN = new Date('2026-06-07T12:00:00Z');

test.use({ viewport: { width: 1280, height: 900 } });

async function openGoals(page, state) {
  await page.clock.setFixedTime(FROZEN);
  await installState(page, state);
  await page.goto(APP_URL);
  await page.click('[data-nav="goals"]');
  await expect(page.locator('.goaltable')).toBeVisible();
}

function row(page, name) {
  return page.locator('.goalrow').filter({ hasText: name });
}

async function goals(page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)).goals, DATA_KEY);
}

/* Fill the sheet. `by` is typed as the owner would type it. */
async function fillSheet(page, v) {
  if (v.name !== undefined) await page.locator('.fld--goalname').fill(v.name);
  if (v.identity !== undefined) await page.locator('.fld--identity').fill(v.identity);
  if (v.fedBy !== undefined) {
    await page.locator('.select--sheet select').selectOption({ label: v.fedBy });
  }
  if (v.hours !== undefined) await page.locator('.fld--goalnum').first().fill(v.hours);
  if (v.by !== undefined) await page.locator('.fld--goalnum').last().fill(v.by);
}

/* ---------- the table (spec §4h, §6) ---------- */

test('the table reads the demo dataset, one arithmetic with the entry sheet', async ({ page }) => {
  await openGoals(page);

  await expect(page.locator('.goals__head h1')).toHaveText('Two open. One slipping.');
  await expect(page.locator('.goals__slipping')).toHaveText('One slipping.');
  await expect(page.locator('.goaltable__head')).toContainText('LANDS');

  const python = row(page, 'Learn Python');
  await expect(python.locator('.goalrow__label')).toHaveText('Learn Python');
  await expect(python.locator('.goalrow__identity'))
    .toHaveText('someone who can build their own tools');
  await expect(python.locator('.goalrow__target')).toHaveText('130.0 h');
  await expect(python.locator('.goalrow__by')).toHaveText('27 Sep');
  await expect(python.locator('.goalrow__sub')).toHaveText('12.0 h · 2 weeks running');

  // Slipping: the landing is past the date it was given, so both figures are
  // the warn colour (deck-04).
  await expect(python.locator('.goalrow__date')).toHaveText('23 Oct');
  await expect(python.locator('.goalrow__date')).toHaveClass(/--warn/);
  await expect(python.locator('.goalrow__slip')).toHaveText('+26 days');

  // Early, so it is not warned about.
  const run = row(page, 'Half-marathon training');
  await expect(run.locator('.goalrow__date')).toHaveText('11 Oct');
  await expect(run.locator('.goalrow__date')).not.toHaveClass(/--warn/);
  await expect(run.locator('.goalrow__slip')).toHaveText('−14 days');

  // spec §4h: the bar is the progress fraction, 12/130.
  const width = await python.locator('.goalbar__fill').evaluate((el) => el.style.width);
  expect(width).toBe('9.2%');

  await expect(page.locator('.goals__foot'))
    .toHaveText('Archived goals keep their hours. Nothing is deleted.');

  /* The Goals table and the entry sheet's SAVING THIS MOVES read the same
     projection.project(), so what the table says now is what the preview says
     the entry would move FROM. */
  await page.click('[data-nav="log"]');
  await page.click('.quickadd__open');
  await page.locator('.seg').first().getByText('2 h', { exact: true }).click();
  await page.locator('.seg').nth(1).getByText('Learn Python').click();
  await expect(page.locator('.preview__row--hours .preview__from'))
    .toHaveText('Learn Python 12.0');
  await expect(page.locator('.preview__row--lands .preview__from')).toHaveText('Lands 23 Oct');
});

test('with no goals the screen is the ghost row, not the empty state', async ({ page }) => {
  await openGoals(page, emptyState());

  await expect(page.locator('.goals__head h1')).toHaveText('No goals yet.');
  await expect(page.locator('.goals__slipping')).toHaveCount(0);
  await expect(page.locator('.goaltable__rows > .goalrow')).toHaveCount(1);
  await expect(page.locator('.goalrow--ghost')).toContainText('Name it');
  await expect(page.locator('.goalrow--ghost')).toContainText('Meridian fills this from your log');
  await expect(page.locator('.goals__foot')).toBeVisible();
});

/* ---------- create (spec §12: "it appears with 0 progress") ---------- */

test('a new goal uses real pace history, then lands with nothing banked', async ({ page }) => {
  await openGoals(page);
  await page.click('.goalrow--ghost');
  await expect(page.locator('.sheet__card')).toBeVisible();

  // Before anything is picked the panel says what it is waiting for.
  await expect(page.locator('.reach__wait')).toHaveText('Pick what feeds it, the hours and the date.');

  await fillSheet(page, {
    identity: 'someone who can build their own tools',
    name: 'Learn Postgres',
    fedBy: 'Learning',
    hours: '40',
    by: '30 Sep 2026'
  });

  /* IS THAT REACHABLE from the FEEDING category's real pace: Learning has
     12.0 h over two whole weeks, so 6.0 h a week (spec §6). */
  await expect(page.locator('.reach__lead'))
    .toHaveText('You’ve given Learning 6.0 h a week for 2 weeks. This needs 2.4 h.');
  await expect(page.locator('.reach__needs')).toHaveText('2.4 h');
  await expect(page.locator('.reach__tail')).toContainText('At 6.0 h it lands 24 Jul.');
  await expect(page.locator('.reach__tail')).toContainText('keep both dates in view');

  await page.getByRole('button', { name: 'Create goal' }).click();
  await expect(page.locator('.sheet__card')).toHaveCount(0);

  const saved = (await goals(page)).find((g) => g.short_name === 'Learn Postgres');
  expect(saved.category_id).toBe('cat_learn');
  expect(saved.target_amount).toBe(40);
  expect(saved.target_unit).toBe('h');            // decision 14
  expect(saved.by_date).toBe('2026-09-30');
  expect(saved.archived).toBe(false);

  const created = row(page, 'Learn Postgres');
  await expect(created.locator('.goalrow__sub')).toHaveText('0.0 h');
  expect(await created.locator('.goalbar__fill').evaluate((el) => el.style.width)).toBe('0%');

  // Nothing logged to it, so there is no honest date to put in LANDS yet.
  await expect(created.locator('.goalrow__date')).toHaveText('—');
  await expect(created.locator('.goalrow__slip')).toHaveText('after a week of logging');

  await expect(page.locator('.goals__head h1')).toHaveText('Three open. One slipping.');
});

test('logging against a new goal banks the hours the table shows', async ({ page }) => {
  await openGoals(page);
  await page.click('[data-goal-new]');
  await fillSheet(page, { name: 'Learn Postgres', fedBy: 'Learning', hours: '40', by: '30 Sep 2026' });
  await page.getByRole('button', { name: 'Create goal' }).click();

  // Two hours through the quick-add row: picking the goal fills its category
  // (rule §8.2), so the row needs nothing else.
  await page.click('[data-nav="log"]');
  await page.locator('.fld--duration').first().fill('2');
  await page.locator('.select--goal select').selectOption({ label: 'Learn Postgres' });
  await page.locator('.fld--duration').first().press('Enter');
  await expect(page.locator('.logrow--entry').filter({ hasText: 'Learn Postgres' })).toHaveCount(1);

  await page.click('[data-nav="goals"]');
  await expect(row(page, 'Learn Postgres').locator('.goalrow__sub')).toHaveText('2.0 h · 1 week running');
  expect(await row(page, 'Learn Postgres').locator('.goalbar__fill')
    .evaluate((el) => el.style.width)).toBe('5%');
});

/* ---------- edit ---------- */

test('the row opens the same sheet, prefilled, and saves in place', async ({ page }) => {
  await openGoals(page);
  await row(page, 'Learn Python').locator('.goalrow__label').click();

  await expect(page.locator('.sheet__title')).toHaveText('EDIT GOAL');
  await expect(page.locator('.fld--identity'))
    .toHaveValue('someone who can build their own tools');
  await expect(page.locator('.fld--goalname')).toHaveValue('Learn Python');
  await expect(page.locator('.select--sheet select')).toHaveValue('cat_learn');
  await expect(page.locator('.fld--goalnum').first()).toHaveValue('130');
  await expect(page.locator('.fld--goalnum').last()).toHaveValue('27 Sep 2026');

  // The panel counts what is already banked, so it asks for the remainder.
  await expect(page.locator('.reach__needs')).toHaveText('7.4 h');

  await fillSheet(page, { hours: '60' });
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('.sheet__card')).toHaveCount(0);

  const saved = (await goals(page)).find((g) => g.id === 'goal_py');
  expect(saved.target_amount).toBe(60);
  expect(saved.short_name).toBe('Learn Python');

  await expect(row(page, 'Learn Python').locator('.goalrow__target')).toHaveText('60.0 h');
  // 12 of 60 now, and the landing comes forward with the target.
  expect(await row(page, 'Learn Python').locator('.goalbar__fill')
    .evaluate((el) => el.style.width)).toBe('20%');
  await expect(page.locator('.goals__head h1')).toHaveText('Two open.');
});

test('once hours are banked, the goal cannot leave the category it lives in', async ({ page }) => {
  await openGoals(page);

  // A goal with hours: moving it would leave every one of those entries in a
  // pairing rule §8.2 forbids, so FED BY is fixed and says why.
  await row(page, 'Learn Python').locator('.goalrow__label').click();
  await expect(page.locator('.select--sheet select')).toBeDisabled();
  await expect(page.locator('.field:has(#goal-fedby-label) .field__note')).toHaveText('FIXED BY ITS HOURS');
  await expect(page.locator('.field:has(#goal-fedby-label) .field__hint')).toHaveText(
    'A goal lives inside one category, and 12.0 h are logged to Learning under this goal already.');
  await page.keyboard.press('Escape');

  // A goal with none: free to move.
  await page.click('[data-goal-new]');
  await fillSheet(page, { name: 'Learn Rust', fedBy: 'Learning', hours: '20', by: '30 Sep 2026' });
  await page.getByRole('button', { name: 'Create goal' }).click();
  await row(page, 'Learn Rust').locator('.goalrow__label').click();
  await expect(page.locator('.select--sheet select')).toBeEnabled();
  await expect(page.locator('.field:has(#goal-fedby-label) .field__note')).toHaveCount(0);

  await fillSheet(page, { fedBy: 'Reading' });
  await page.getByRole('button', { name: 'Save changes' }).click();
  expect((await goals(page)).find((g) => g.short_name === 'Learn Rust').category_id)
    .toBe('cat_reading');
});

/* ---------- the sheet's own shape ----------
   The owner's first three goals came out as "Learn Cooking / Cook" and
   "Cycling / Cycling": the optional identity field was first, largest and
   autofocused, so the caret was inside it before the required name had been
   read. The required name leads now, and it is the one that takes focus. */

test('the required name leads the sheet and takes the caret', async ({ page }) => {
  await openGoals(page);
  await page.click('[data-goal-new]');

  await expect(page.locator('.fld--goalname')).toBeFocused();

  // Source order: name, fed by, hours, by, then the optional line last.
  const labels = await page.locator('.sheet__card .field .t-label').allInnerTexts();
  expect(labels).toEqual([
    'SHORT NAME', 'FED BY', 'HOURS NEEDED', 'BY', 'WHY IT MATTERS — OPTIONAL',
  ]);

  await expect(page.locator('.fld--identity'))
    .toHaveAttribute('placeholder', 'Building my own tools, not just using them');
  await expect(page.locator('.field:has(#goal-identity-label) .field__hint'))
    .toHaveText('Shows under the name on the Goals screen. Leave it empty if nothing fits.');

  // Typing straight into the sheet fills the name, not the identity line.
  await page.keyboard.type('Wine tasting');
  await expect(page.locator('.fld--goalname')).toHaveValue('Wine tasting');
  await expect(page.locator('.fld--identity')).toHaveValue('');
});

/* ---------- adding a category without leaving the goal ---------- */

test('a category added from FED BY comes back selected, with the draft intact',
  async ({ page }) => {
    await openGoals(page);
    await page.click('[data-goal-new]');
    await fillSheet(page, { name: 'Wine tasting', hours: '40', by: '30 Sep 2026' });

    await page.getByRole('button', { name: '+ New category' }).click();
    await expect(page.locator('.sheet--stacked .sheet__card')).toBeVisible();

    // Opened from a goal, so the More default is explained rather than silent.
    await expect(page.locator('.field:has(#cat-dir-label) .field__note'))
      .toHaveText('MORE FEEDS THE GOAL');
    await expect(page.locator('.dir[data-active="1"]')).toContainText('More');

    await page.locator('.fld--name').fill('Wine');
    await page.getByRole('button', { name: 'Add category' }).click();

    // Back on the goal sheet, which never unmounted: everything typed survives.
    await expect(page.locator('.sheet--stacked')).toHaveCount(0);
    await expect(page.locator('.fld--goalname')).toHaveValue('Wine tasting');
    await expect(page.locator('.fld--goalnum').first()).toHaveValue('40');
    await expect(page.locator('.fld--goalnum').last()).toHaveValue('30 Sep 2026');

    // The new category is chosen and focused, and the panel reads it honestly.
    const select = page.locator('.select--sheet select');
    await expect(select).toHaveValue(/^cat_/);
    await expect(select.locator('option:checked')).toHaveText('Wine');
    await expect(select).toBeFocused();
    await expect(page.locator('.reach__lead')).toContainText('Nothing logged to Wine yet.');

    await page.getByRole('button', { name: 'Create goal' }).click();
    const saved = (await goals(page)).find((g) => g.short_name === 'Wine tasting');
    const cats = await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)).categories, DATA_KEY);
    expect(cats.find((c) => c.id === saved.category_id).name).toBe('Wine');
  });

test('a Less or Upkeep category is still created, but says why it cannot feed the goal',
  async ({ page }) => {
    await openGoals(page);
    await page.click('[data-goal-new]');
    await fillSheet(page, { name: 'Commute less', hours: '10', by: '30 Sep 2026' });

    await page.getByRole('button', { name: '+ New category' }).click();
    await page.locator('.fld--name').fill('Commuting');
    await page.locator('.dir').filter({ hasText: 'Upkeep' }).click();

    // Explained before the fact, inside the sheet making the choice.
    await expect(page.locator('.field:has(#cat-dir-label) [role="status"]'))
      .toContainText('Only More categories can carry goals.');
    await page.getByRole('button', { name: 'Add category' }).click();

    // The category is real work and is kept; it just is not selected.
    const cats = await page.evaluate(
      (k) => JSON.parse(localStorage.getItem(k)).categories, DATA_KEY);
    expect(cats.find((c) => c.name === 'Commuting').direction).toBe('upkeep');
    await expect(page.locator('.select--sheet select')).toHaveValue('');
    await expect(page.locator('.field:has(#goal-fedby-label) .field__hint'))
      .toHaveText('Commuting is an Upkeep category, so it cannot feed a goal. '
        + 'It is saved, and you can log to it.');
  });

test('with no More categories the picker says so and points at the way out',
  async ({ page }) => {
    // Every More category archived: the picker would otherwise be an empty box
    // whose only exit is a submit-time error naming it.
    const state = emptyState();
    state.categories.forEach((c) => {
      if (c.direction === 'more') { c.archived = true; c.archived_on = '2026-06-01'; }
    });
    await openGoals(page, state);
    await page.click('[data-goal-new]');

    await expect(page.locator('.select--sheet select')).toHaveValue('');
    await expect(page.locator('.select--sheet option')).toHaveCount(1);
    await expect(page.locator('.select--sheet option')).toHaveText('No More categories yet');
    await expect(page.locator('.field:has(#goal-fedby-label) .field__hint'))
      .toHaveText('A goal is fed by one More category. Add one with + New category.');
    await expect(page.getByRole('button', { name: '+ New category' })).toBeVisible();
  });

test('the create button is absent when the picker is locked by banked hours',
  async ({ page }) => {
    await openGoals(page);
    await row(page, 'Learn Python').locator('.goalrow__label').click();
    await expect(page.locator('.select--sheet select')).toBeDisabled();
    await expect(page.getByRole('button', { name: '+ New category' })).toHaveCount(0);
  });

/* ---------- archive and restore (rule §8.10) ---------- */

test('archiving a goal keeps its hours, and restore reverses it', async ({ page }) => {
  await openGoals(page);

  await row(page, 'Learn Python').locator('.rowmenu__btn').click();
  await page.getByRole('menuitem', { name: 'Archive' }).click();
  await expect(page.locator('.confirm--menu'))
    .toContainText('Archiving keeps the 12.0 h. It leaves the pickers, not the history.');

  // Backing out changes nothing.
  await page.click('.confirm--menu .btn:not(.btn--warn)');
  await page.getByRole('menuitem', { name: 'Edit' }).waitFor();
  await page.keyboard.press('Escape');
  expect((await goals(page)).find((g) => g.id === 'goal_py').archived).toBe(false);

  await row(page, 'Learn Python').locator('.rowmenu__btn').click();
  await page.getByRole('menuitem', { name: 'Archive' }).click();
  await page.click('.confirm--menu .btn--warn');

  expect((await goals(page)).find((g) => g.id === 'goal_py').archived).toBe(true);
  // Every entry keeps pointing at it, so the hours are still there.
  const kept = await page.evaluate((k) => JSON.parse(localStorage.getItem(k))
    .entries.filter((e) => e.goal_id === 'goal_py').length, DATA_KEY);
  expect(kept).toBe(12);

  const archived = page.locator('.goals__archived .goalrow');
  await expect(archived).toHaveCount(1);
  await expect(archived.locator('.goalrow__sub')).toHaveText('12.0 h kept');
  await expect(page.locator('.goals__head h1')).toHaveText('One open.');

  // It leaves the entry sheet's picker but not the history (§8.11).
  await page.click('[data-nav="log"]');
  await expect(page.locator('.select--goal select option')).toHaveCount(2);  // placeholder + one
  await expect(page.locator('.logrow--entry').filter({ hasText: 'Learn Python' }).first())
    .toBeVisible();

  await page.click('[data-nav="goals"]');
  await archived.getByRole('button', { name: 'restore' }).click();
  expect((await goals(page)).find((g) => g.id === 'goal_py').archived).toBe(false);
  await expect(page.locator('.goals__archived')).toHaveCount(0);
  await expect(page.locator('.goals__head h1')).toHaveText('Two open. One slipping.');
});

/* ---------- bad input (spec §12: "target ≤0 or by-date in the past") ---------- */

test('a zero target and a past date are rejected inline, and nothing is written', async ({ page }) => {
  await openGoals(page);
  await page.click('[data-goal-new]');

  await fillSheet(page, { name: 'Learn Rust', fedBy: 'Learning', hours: '0', by: '1 Jan 2026' });
  await page.getByRole('button', { name: 'Create goal' }).click();

  await expect(page.locator('#goal-hours-error'))
    .toHaveText('Hours needed has to be more than zero.');
  await expect(page.locator('#goal-by-error')).toHaveText('Pick a date in the future.');
  await expect(page.locator('.sheet__card')).toBeVisible();
  expect((await goals(page)).length).toBe(2);

  // A name and a category are asked for too, and nothing is written meanwhile.
  await fillSheet(page, { name: '', hours: '20', by: 'nonsense' });
  await page.getByRole('button', { name: 'Create goal' }).click();
  await expect(page.locator('#goal-name-error')).toHaveText('Give it a short name.');
  await expect(page.locator('#goal-by-error')).toHaveText('That is not a date.');
  expect((await goals(page)).length).toBe(2);

  // Corrected, it saves: a bare day and month resolves to the year ahead.
  await fillSheet(page, { name: 'Learn Rust', by: '30/9' });
  await page.getByRole('button', { name: 'Create goal' }).click();
  await expect(page.locator('.sheet__card')).toHaveCount(0);
  expect((await goals(page)).find((g) => g.short_name === 'Learn Rust').by_date)
    .toBe('2026-09-30');
});

test('only More categories feed a goal (rule §8.3)', async ({ page }) => {
  await openGoals(page);
  await page.click('[data-goal-new]');

  const labels = await page.locator('.select--sheet select option').allInnerTexts();
  expect(labels).toEqual(['Category', 'Family', 'Learning', 'Exercise', 'Reading']);
});

/* ---------- the panel with no history behind it ---------- */

test('with nothing logged to the category the panel says so, and why', async ({ page }) => {
  await openGoals(page, emptyState());
  await page.click('.goalrow--ghost');

  await fillSheet(page, { name: 'Learn Python', fedBy: 'Learning', hours: '130', by: '30 Sep 2026' });

  await expect(page.locator('.reach__lead'))
    .toHaveText('Nothing logged to Learning yet. This needs 7.9 h.');
  await expect(page.locator('.reach__tail'))
    .toHaveText('Meridian starts projecting once Learning has seven logged days.');
});
