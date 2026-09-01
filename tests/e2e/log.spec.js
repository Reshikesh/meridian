const { test, expect } = require('@playwright/test');
const { APP_URL } = require('./lib/app-url');
const { installState, DATA_KEY } = require('./lib/seed-state');

/* Spec §12 "Log", plus the parts of QUALITY-BAR §4 the Log screen owns: Enter
   commits from any field, the row clears and refocuses, sheets trap and return
   focus, destructive actions confirm inline. */

const FROZEN = new Date('2026-06-07T12:00:00Z');
const TODAY = '2026-06-07';

test.use({ viewport: { width: 1280, height: 900 } });

async function openLog(page) {
  await page.clock.setFixedTime(FROZEN);
  await installState(page);
  await page.goto(APP_URL);
  await page.click('[data-nav="log"]');
  await expect(page.locator('main.screen[data-s="log"]')).toBeVisible();
}

async function entries(page, day) {
  return page.evaluate(([k, d]) => {
    const raw = JSON.parse(localStorage.getItem(k));
    return raw.entries.filter((e) => e.date === d);
  }, [DATA_KEY, day || TODAY]);
}

async function settled(page) {
  await page.waitForFunction(
    () => document.getAnimations().every((a) => a.playState === 'finished'));
}

/* ---------- the quick-add row ---------- */

test('the whole day can be logged from the keyboard alone', async ({ page }) => {
  await openLog(page);
  const before = (await entries(page)).length;

  await page.locator('.quickadd__row .fld--duration').focus();

  // Two entries, no mouse: type, Tab, type, Tab, choose, Enter. The row is
  // expected to clear and put focus back on the duration for the second one.
  for (const row of [
    { duration: '1.5h', activity: 'Reading the docs', category: 'cat_learn' },
    { duration: '45m', activity: 'Walk', category: 'cat_exercise' },
  ]) {
    await page.keyboard.type(row.duration);
    await page.keyboard.press('Tab');
    await page.keyboard.type(row.activity);
    await page.keyboard.press('Tab');
    await page.locator('.quickadd__row .select__input').selectOption(row.category);
    await page.keyboard.press('Enter');

    await expect(page.locator('.quickadd__row .fld--duration')).toBeFocused();
    await expect(page.locator('.quickadd__row .fld--duration')).toHaveValue('');
    await expect(page.locator('.quickadd__row .fld--activity')).toHaveValue('');
  }

  const after = await entries(page);
  expect(after.length).toBe(before + 2);

  // `1.5h` is ninety minutes and `45m` is forty-five: the two spellings the
  // quick-add row promises, read the two different ways.
  const added = after.slice(-2);
  expect(added.map((e) => e.duration_min)).toEqual([90, 45]);
  expect(added.map((e) => e.activity)).toEqual(['Reading the docs', 'Walk']);
  expect(added.map((e) => e.category_id)).toEqual(['cat_learn', 'cat_exercise']);
  // Decision 19: the inline row never links a goal.
  expect(added.every((e) => e.goal_id === null)).toBe(true);
});

test('Enter commits from the duration field, not only from the last one', async ({ page }) => {
  await openLog(page);
  const before = (await entries(page)).length;

  await page.locator('.quickadd__row .select__input').selectOption('cat_family');
  await page.locator('.quickadd__row .fld--duration').fill('2');
  await page.locator('.quickadd__row .fld--duration').press('Enter');

  const after = await entries(page);
  expect(after.length).toBe(before + 1);
  expect(after[after.length - 1].duration_min).toBe(120);
  // A bare number is hours.
  expect(after[after.length - 1].activity).toBe(null);
});

test('a duration nobody can read is refused, and nothing is written', async ({ page }) => {
  await openLog(page);
  const before = (await entries(page)).length;

  await page.locator('.quickadd__row .select__input').selectOption('cat_family');
  await page.locator('.quickadd__row .fld--duration').fill('half an hour');
  await page.locator('.quickadd__row .fld--duration').press('Enter');

  await expect(page.locator('.quickadd__error')).toHaveText(/Use a time like/);
  expect((await entries(page)).length).toBe(before);

  // The message clears as soon as the input is edited (QUALITY-BAR §4).
  await page.locator('.quickadd__row .fld--duration').fill('0.5');
  await expect(page.locator('.quickadd__error')).toHaveCount(0);
});

test('a missing category is refused', async ({ page }) => {
  await openLog(page);
  await page.locator('.quickadd__row .fld--duration').fill('1');
  await page.locator('.quickadd__row .fld--duration').press('Enter');
  await expect(page.locator('.quickadd__error')).toHaveText('Pick a category.');
});

test('a day cannot be pushed over the waking hours (decision 17)', async ({ page }) => {
  await openLog(page);
  const before = (await entries(page)).length;

  // The seeded Sunday holds 5.0 h of the 16 h a waking day has, so 12 h is one
  // hour too many.
  await page.locator('.quickadd__row .select__input').selectOption('cat_work');
  await page.locator('.quickadd__row .fld--duration').fill('12');
  await page.locator('.quickadd__row .fld--duration').press('Enter');

  await expect(page.locator('.quickadd__error')).toContainText('over 16 h');
  await expect(page.locator('.quickadd__error')).toContainText('11.0 h left');
  expect((await entries(page)).length).toBe(before);

  // 11 h exactly fits.
  await page.locator('.quickadd__row .fld--duration').fill('11');
  await page.locator('.quickadd__row .fld--duration').press('Enter');
  expect((await entries(page)).length).toBe(before + 1);
});

/* ---------- the day header and the week strip ---------- */

test('the header, the week strip and the counter all move with an entry', async ({ page }) => {
  await openLog(page);

  await expect(page.locator('.logday .t-h1')).toHaveText('5.0 h accounted for, 11.0 to go');
  await expect(page.locator('.weekstrip__total')).toHaveText('91.5/112 h');
  await expect(page.locator('.weekstrip__day').nth(6).locator('.weekstrip__num')).toHaveText('5.0');

  await page.locator('.quickadd__row .select__input').selectOption('cat_reading');
  await page.locator('.quickadd__row .fld--duration').fill('1');
  await page.locator('.quickadd__row .fld--duration').press('Enter');

  await expect(page.locator('.logday .t-h1')).toHaveText('6.0 h accounted for, 10.0 to go');
  await expect(page.locator('.weekstrip__total')).toHaveText('92.5/112 h');
  await expect(page.locator('.weekstrip__day').nth(6).locator('.weekstrip__num')).toHaveText('6.0');
  await expect(page.locator('.datactl__state')).toHaveText('1 unexported change');
});

test('the week strip is Monday-first and marks the day on screen', async ({ page }) => {
  await openLog(page);
  await expect(page.locator('.weekstrip__label')).toHaveText(
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  await expect(page.locator('.weekstrip__bar--today')).toHaveCount(1);
  await expect(page.locator('.weekstrip__day').nth(6).locator('.weekstrip__bar--today'))
    .toBeVisible();
});

/* ---------- day paging ---------- */

test('past days page and stay editable; the future does not', async ({ page }) => {
  await openLog(page);

  // Today: forward is disabled, because tomorrow has not happened (§8.15).
  await expect(page.locator('.logday__paging .btn').nth(1)).toBeDisabled();

  await page.click('.logday__paging .btn >> nth=0');
  await expect(page.locator('.logday .t-eyebrow')).toHaveText('SATURDAY 6 JUNE');
  await expect(page.locator('.logday__paging .btn').nth(1)).toBeEnabled();

  // A past day is editable, and the entry lands on THAT day.
  const before = (await entries(page, '2026-06-06')).length;
  await page.locator('.quickadd__row .select__input').selectOption('cat_reading');
  await page.locator('.quickadd__row .fld--duration').fill('30m');
  await page.locator('.quickadd__row .fld--duration').press('Enter');
  expect((await entries(page, '2026-06-06')).length).toBe(before + 1);
  expect((await entries(page, TODAY)).length).toBe(3);

  await page.click('.logday__paging .btn >> nth=1');
  await expect(page.locator('.logday .t-eyebrow')).toHaveText('SUNDAY 7 JUNE');
  await expect(page.locator('.logday__paging .btn').nth(1)).toBeDisabled();
});

test('a day with nothing on it keeps its row and its header', async ({ page }) => {
  await openLog(page);
  for (let i = 0; i < 20; i++) await page.click('.logday__paging .btn >> nth=0');

  await expect(page.locator('.logtable__empty')).toHaveText('Nothing logged on this day yet.');
  await expect(page.locator('.logday .t-h1')).toHaveText('0.0 h accounted for, 16.0 to go');
  await expect(page.locator('.quickadd__row')).toBeVisible();
});

/* ---------- the entry sheet ---------- */

test('the sheet writes an entry against a goal and fills its category', async ({ page }) => {
  await openLog(page);
  const before = (await entries(page)).length;

  await page.click('.quickadd__open');
  await expect(page.locator('.sheet__card')).toBeVisible();
  await expect(page.locator('.sheet__title')).toHaveText('NEW ENTRY — SUN 7 JUNE');

  await page.locator('.seg').first().getByText('2 h', { exact: true }).click();
  await page.locator('.fld--sheet').fill('Async chapter + exercises');
  await page.locator('.seg').nth(1).getByText('Learn Python').click();

  // Business rule §8.2: the goal fills and locks its own category.
  await expect(page.locator('.lockrow__chip')).toContainText('Learning');
  await expect(page.locator('.field__note')).toHaveText('FILLED FROM THE GOAL');

  // The preview reads from the same projection the Goals table will use.
  await expect(page.locator('.preview__row--hours')).toContainText('Learn Python 12.0');
  await expect(page.locator('.preview__row--hours')).toContainText('14.0 h');
  await expect(page.locator('.preview__row--lands')).toContainText('Lands');

  await page.click('.sheet__foot .btn--brand');
  await expect(page.locator('.sheet__card')).toHaveCount(0);

  const after = await entries(page);
  expect(after.length).toBe(before + 1);
  const added = after[after.length - 1];
  expect(added.duration_min).toBe(120);
  expect(added.category_id).toBe('cat_learn');
  expect(added.goal_id).toBe('goal_py');
  expect(added.activity).toBe('Async chapter + exercises');
  await expect(page.locator('.datactl__state')).toHaveText('1 unexported change');
});

test('Change unlocks the category, and moving off it drops the goal', async ({ page }) => {
  await openLog(page);
  await page.click('.quickadd__open');

  await page.locator('.seg').first().getByText('1 h', { exact: true }).click();
  await page.locator('.seg').nth(1).getByText('Learn Python').click();
  await expect(page.locator('.lockrow__chip')).toContainText('Learning');

  await page.click('.btn--change');
  await expect(page.locator('.lockrow__chip')).toHaveCount(0);
  await page.locator('.select--sheet .select__input').selectOption('cat_family');

  // The goal cannot survive the move (§8.2), so it goes back to Nothing yet and
  // the preview it was driving goes with it.
  await expect(page.locator('.preview')).toHaveCount(0);
  await expect(page.locator('.seg').nth(1).getByText('Nothing yet'))
    .toHaveAttribute('data-active', '1');

  await page.click('.sheet__foot .btn--brand');
  const after = await entries(page);
  const added = after[after.length - 1];
  expect(added.category_id).toBe('cat_family');
  expect(added.goal_id).toBe(null);
});

test('Other takes a typed duration and refuses a nonsense one', async ({ page }) => {
  await openLog(page);
  await page.click('.quickadd__open');

  await page.locator('.seg').first().getByText('Other').click();
  await page.locator('.field__other .fld').fill('twenty');
  await page.locator('.select--sheet .select__input').selectOption('cat_else');
  await page.click('.sheet__foot .btn--brand');
  await expect(page.locator('.field__error')).toHaveText(/Use a time like/);
  await expect(page.locator('.sheet__card')).toBeVisible();

  await page.locator('.field__other .fld').fill('20m');
  await page.click('.sheet__foot .btn--brand');
  await expect(page.locator('.sheet__card')).toHaveCount(0);

  const after = await entries(page);
  expect(after[after.length - 1].duration_min).toBe(20);
});

test('what is typed into the row is still there when + opens the sheet', async ({ page }) => {
  await openLog(page);

  await page.locator('.quickadd__row .fld--duration').fill('45m');
  await page.locator('.quickadd__row .fld--activity').fill('Long run');
  await page.locator('.quickadd__row .select__input').selectOption('cat_exercise');
  await page.click('.quickadd__open');

  await expect(page.locator('.fld--sheet')).toHaveValue('Long run');
  await expect(page.locator('.select--sheet .select__input')).toHaveValue('cat_exercise');
  await expect(page.locator('.seg').first().getByText('Other')).toHaveAttribute('data-active', '1');
  await expect(page.locator('.field__other .fld')).toHaveValue('0.8 h');
});

/* ---------- the row menu ---------- */

test('a row can be edited through the same sheet', async ({ page }) => {
  await openLog(page);

  await page.click('.logrow--entry >> nth=1 >> .rowmenu__btn');
  await page.click('.rowmenu__item >> nth=0');

  await expect(page.locator('.sheet__title')).toHaveText('EDIT ENTRY — SUN 7 JUNE');
  await expect(page.locator('.fld--sheet')).toHaveValue('Python — async chapter');
  await expect(page.locator('.seg').first().getByText('1 h', { exact: true }))
    .toHaveAttribute('data-active', '1');

  await page.locator('.fld--sheet').fill('Python — decorators');
  await page.locator('.seg').first().getByText('2 h', { exact: true }).click();
  await page.click('.sheet__foot .btn--brand');

  const after = await entries(page);
  expect(after.length).toBe(3);
  const edited = after.find((e) => e.activity === 'Python — decorators');
  expect(edited).toBeTruthy();
  expect(edited.duration_min).toBe(120);
  // created_at is never rewritten by an edit.
  expect(edited.created_at.startsWith('2026-06-07')).toBe(true);
  await expect(page.locator('.logday .t-h1')).toHaveText('6.0 h accounted for, 10.0 to go');
});

test('delete confirms inline and only then removes the row', async ({ page }) => {
  await openLog(page);
  expect((await entries(page)).length).toBe(3);

  await page.click('.logrow--entry >> nth=0 >> .rowmenu__btn');
  await page.click('.rowmenu__item--warn');
  await expect(page.locator('.confirm--menu')).toBeVisible();

  // Backing out changes nothing.
  await page.click('.confirm--menu .btn:not(.btn--warn)');
  await expect(page.locator('.confirm--menu')).toHaveCount(0);
  expect((await entries(page)).length).toBe(3);

  await page.click('.rowmenu__item--warn');
  await page.click('.confirm--menu .btn--warn');
  expect((await entries(page)).length).toBe(2);
  await expect(page.locator('.logrow--entry')).toHaveCount(2);
  await expect(page.locator('.logday .t-h1')).toHaveText('3.0 h accounted for, 13.0 to go');
});

test('Escape closes the row menu and leaves the row alone', async ({ page }) => {
  await openLog(page);
  await page.click('.logrow--entry >> nth=0 >> .rowmenu__btn');
  await expect(page.locator('.rowmenu__panel')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.locator('.rowmenu__panel')).toHaveCount(0);
  await expect(page.locator('.logrow--entry').first().locator('.rowmenu__btn')).toBeFocused();
  expect((await entries(page)).length).toBe(3);
});

/* ---------- sheet behaviour (QUALITY-BAR §4) ---------- */

test('the sheet closes on Escape and on the veil, and gives focus back', async ({ page }) => {
  await openLog(page);

  await page.click('.quickadd__open');
  await settled(page);
  await expect(page.locator('.sheet__card')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.sheet__card')).toHaveCount(0);
  await expect(page.locator('.quickadd__open')).toBeFocused();

  await page.click('.quickadd__open');
  await settled(page);
  // The veil is the element the card sits in; clicking it, not the card.
  await page.locator('.sheet').click({ position: { x: 8, y: 8 } });
  await expect(page.locator('.sheet__card')).toHaveCount(0);
  await expect(page.locator('.quickadd__open')).toBeFocused();
});

test('nothing is written when a sheet is cancelled', async ({ page }) => {
  await openLog(page);
  const before = (await entries(page)).length;

  await page.click('.quickadd__open');
  await page.locator('.seg').first().getByText('3 h', { exact: true }).click();
  await page.locator('.select--sheet .select__input').selectOption('cat_family');
  await page.click('.sheet__foot .btn:not(.btn--brand)');

  await expect(page.locator('.sheet__card')).toHaveCount(0);
  expect((await entries(page)).length).toBe(before);
  await expect(page.locator('.datactl__state')).toHaveText('Nothing exported yet');
});

/* ---------- persistence (QUALITY-BAR §6) ---------- */

test('an entry logged in the row survives a reload', async ({ page }) => {
  await openLog(page);
  await page.locator('.quickadd__row .select__input').selectOption('cat_learn');
  await page.locator('.quickadd__row .fld--duration').fill('90m');
  await page.locator('.quickadd__row .fld--activity').fill('Survives a reload');
  await page.locator('.quickadd__row .fld--duration').press('Enter');

  await page.reload();
  await page.click('[data-nav="log"]');
  await expect(page.locator('.logrow__activity').filter({ hasText: 'Survives a reload' }))
    .toBeVisible();
  await expect(page.locator('.logday .t-h1')).toHaveText('6.5 h accounted for, 9.5 to go');
});

test('clicking the activity opens the same editor as the row menu', async ({ page }) => {
  await openLog(page);
  // The mockup's dashed underline promises an editor (spec Appendix A); this is
  // it, and it is the same one.
  await page.click('.logrow--entry >> nth=1 >> .logrow__edit');
  await expect(page.locator('.sheet__title')).toHaveText('EDIT ENTRY — SUN 7 JUNE');
  await expect(page.locator('.fld--sheet')).toHaveValue('Python — async chapter');
});

test('the last row menu is not trapped in the table scroller', async ({ page }) => {
  // The Log table scrolls horizontally, and `overflow-x: auto` clips the other
  // axis too. An absolutely positioned menu on the LAST row was cut off by that
  // scroller and grew it a vertical scrollbar which, when dragged, closed the
  // menu. Reported at the Phase 2 checkpoint.
  await openLog(page);

  const before = await page.locator('.logtable__scroll').evaluate(
    (el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }));
  expect(before.scrollHeight).toBeLessThanOrEqual(before.clientHeight + 1);

  await page.locator('.logrow--entry').last().locator('.rowmenu__btn').click();
  const panel = page.locator('.rowmenu__panel');
  await expect(panel).toBeVisible();

  // Nothing clips it: its own box, its box clipped by the scroller, and the
  // viewport all agree.
  const geometry = await panel.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const scroller = document.querySelector('.logtable__scroll');
    const s = scroller.getBoundingClientRect();
    return {
      panel: { top: r.top, bottom: r.bottom, left: r.left, right: r.right },
      clippedBottom: Math.min(r.bottom, s.bottom),
      viewport: { w: window.innerWidth, h: window.innerHeight },
      scroller: { scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight },
      position: getComputedStyle(el).position,
    };
  });

  expect(geometry.position).toBe('fixed');
  expect(geometry.panel.bottom).toBeLessThanOrEqual(geometry.viewport.h);
  expect(geometry.panel.top).toBeGreaterThanOrEqual(0);
  expect(geometry.panel.right).toBeLessThanOrEqual(geometry.viewport.w);
  expect(geometry.panel.left).toBeGreaterThanOrEqual(0);
  // The whole panel is below the scroller's own bottom edge, which is exactly
  // what an absolutely positioned one could not do.
  expect(geometry.panel.bottom).toBeGreaterThan(geometry.clippedBottom - 1);
  // ...and the scroller did not grow to make room for it.
  expect(geometry.scroller.scrollHeight)
    .toBeLessThanOrEqual(geometry.scroller.clientHeight + 1);
});

test('the menu flips above the button when there is no room below', async ({ page }) => {
  // Short enough that the last row's button is fully visible — so Playwright
  // does not scroll it away — but with no room under it for the panel.
  await page.setViewportSize({ width: 1280, height: 460 });
  await openLog(page);

  const button = page.locator('.logrow--entry').last().locator('.rowmenu__btn');
  await button.click();
  await expect(page.locator('.rowmenu__panel')).toBeVisible();

  const rects = await page.evaluate(() => {
    const buttons = document.querySelectorAll('.rowmenu__btn');
    return {
      panel: document.querySelector('.rowmenu__panel').getBoundingClientRect().toJSON(),
      button: buttons[buttons.length - 1].getBoundingClientRect().toJSON(),
      viewportHeight: window.innerHeight,
    };
  });

  // It had to flip: there was not room for it below.
  expect(rects.button.bottom + rects.panel.height).toBeGreaterThan(rects.viewportHeight - 8);
  expect(rects.panel.bottom).toBeLessThanOrEqual(rects.button.top + 1);
  expect(rects.panel.top).toBeGreaterThanOrEqual(0);
});

test('scrolling the table keeps the menu on its button', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await openLog(page);

  await page.locator('.logrow--entry').first().locator('.rowmenu__btn').click();
  await expect(page.locator('.rowmenu__panel')).toBeVisible();

  const offsetBefore = await page.evaluate(() => {
    const p = document.querySelector('.rowmenu__panel').getBoundingClientRect();
    const b = document.querySelector('.rowmenu__btn').getBoundingClientRect();
    return Math.round(p.right - b.right);
  });

  await page.locator('.logtable__scroll').evaluate((el) => { el.scrollLeft = 120; });
  // Still open, and still glued to the button it belongs to.
  await expect(page.locator('.rowmenu__panel')).toBeVisible();
  const offsetAfter = await page.evaluate(() => {
    const p = document.querySelector('.rowmenu__panel').getBoundingClientRect();
    const b = document.querySelector('.rowmenu__btn').getBoundingClientRect();
    return Math.round(p.right - b.right);
  });
  expect(offsetAfter).toBe(offsetBefore);
});
