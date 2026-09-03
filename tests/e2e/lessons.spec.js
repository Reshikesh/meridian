const { test, expect } = require('@playwright/test');
const { APP_URL } = require('./lib/app-url');
const { installState, demoState, emptyState, DATA_KEY } = require('./lib/seed-state');
const { manyLessonsState } = require('./lib/datasets');

/* BUILD-PLAN § Phase 6, Lessons (decision 25): create with and without a
   title, pin, search, the rotating fill and its trim, archive, view archived,
   delete for good. The checkpoint's own walk, automated. */

const FROZEN = new Date('2026-06-07T12:00:00Z');

test.use({ viewport: { width: 1280, height: 900 } });

async function open(page, state, visit) {
  await page.clock.setFixedTime(FROZEN);
  await installState(page, state);
  if (visit !== undefined) {
    await page.addInitScript((v) => {
      try { localStorage.setItem('meridian:lessons', String(v)); } catch (e) { /* */ }
    }, visit);
  }
  await page.goto(APP_URL);
  await page.click('[data-nav="lessons"]');
  await page.locator('main.screen[data-s="lessons"]').waitFor();
}

const lessons = (page) => page.evaluate(() => window.Meridian.store.getState().lessons);
const card = (page, text) => page.locator('.lcard', { hasText: text });
const wallIds = (page) => page.locator('.wall--fit .lcard').evaluateAll((els) => els.map((e) => e.dataset.lesson));

async function menu(page, text, item) {
  await card(page, text).locator('.rowmenu__btn').click();
  await page.getByRole('menuitem', { name: item, exact: true }).click();
}

/* ---------- writing ---------- */

test('a lesson is written with a title, and another without one', async ({ page }) => {
  await open(page, emptyState());
  await expect(page.locator('.lessons__none')).toContainText('Nothing written yet.');

  await page.getByRole('button', { name: 'Write the first' }).click();
  await expect(page.locator('.sheet__title')).toHaveText('NEW LESSON');
  // Decision 23: the required field leads and has the caret.
  await expect(page.locator('.fld--lesson')).toBeFocused();

  // Nothing written: refused, next to the field, nothing saved.
  await page.getByRole('button', { name: 'Save lesson' }).click();
  await expect(page.locator('#lesson-text-error')).toHaveText('Write something first.');
  expect((await lessons(page)).length).toBe(0);

  await page.locator('.fld--lesson').fill('Log it when it ends or do not log it.');
  await page.locator('.fld--goalname').fill('Guesswork');
  await page.locator('.tagpick__btn', { hasText: 'Learning' }).click();
  await page.getByRole('button', { name: 'Save lesson' }).click();
  await expect(page.locator('.sheet__card')).toHaveCount(0);

  const first = card(page, 'Guesswork');
  await expect(first.locator('.lcard__title')).toHaveText('Guesswork');
  await expect(first.locator('.lcard__text')).toHaveText('Log it when it ends or do not log it.');
  await expect(first.locator('.ltag')).toHaveText(['Learning']);
  await expect(first.locator('.lcard__when')).toHaveText('W23 · 7 Jun');

  // Without a title.
  await page.click('[data-lesson-new]');
  await page.locator('.fld--lesson').fill('Presence is not duration.');
  await page.getByRole('button', { name: 'Save lesson' }).click();
  const second = card(page, 'Presence is not duration.');
  await expect(second.locator('.lcard__title')).toHaveCount(0);

  const saved = await lessons(page);
  expect(saved.length).toBe(2);
  const titled = saved.find((l) => l.title === 'Guesswork');
  expect(titled.text).toBe('Log it when it ends or do not log it.');
  expect(titled.tags).toEqual(['cat_learn']);
  expect(titled.date).toBe('2026-06-07');
  expect(titled.iso_week).toBe('2026-W23');
  expect(titled.pinned).toBe(false);
  expect(titled.archived).toBe(false);
  expect(saved.find((l) => l.title === null).text).toBe('Presence is not duration.');
  await expect(page.locator('.datactl__state')).toHaveText(/2 unexported changes/i);
});

test('edit changes the words and keeps the date', async ({ page }) => {
  await open(page);
  await menu(page, 'Presence is not duration', 'Edit');
  await expect(page.locator('.sheet__title')).toHaveText('EDIT LESSON');
  await page.locator('.fld--goalname').fill('Presence');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(card(page, 'Presence is not duration').locator('.lcard__title')).toHaveText('Presence');
  expect((await lessons(page)).find((l) => l.id === 'l_02').date).toBe('2026-05-24');
});

/* ---------- pin, archive, delete ---------- */

test('pinned cards lead the wall; archive takes a card off it; delete is for good', async ({ page }) => {
  await open(page);
  // The seed pins l_01 (newer) and leaves l_02; pin l_02 and it stays second,
  // because the pinned are ordered newest first among themselves.
  await expect(card(page, 'Before eight').locator('.lcard__pinned')).toHaveText('PINNED');
  await menu(page, 'Presence is not duration', 'Pin');
  await expect(card(page, 'Presence is not duration').locator('.lcard__pinned')).toHaveText('PINNED');
  expect(await wallIds(page)).toEqual(['l_01', 'l_02']);
  await menu(page, 'Before eight', 'Unpin');
  expect(await wallIds(page)).toEqual(['l_02', 'l_01']);

  // Archive: confirm inline, then off the wall entirely and into the archive.
  await menu(page, 'Before eight', 'Archive');
  await expect(page.locator('.confirm--menu')).toContainText('Archiving takes it off the wall and keeps it.');
  await page.locator('.confirm--menu').getByRole('button', { name: 'Archive' }).click();
  await expect(card(page, 'Before eight')).toHaveCount(0);
  await expect(page.locator('.lcard')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'View archived (1)' })).toBeVisible();

  // View archived: restore and delete for good.
  await page.getByRole('button', { name: 'View archived (1)' }).click();
  await expect(page.locator('.lessons__mode--flat')).toHaveText('ARCHIVED — 1');
  const archived = page.locator('.lcard--archived', { hasText: 'Before eight' });
  await expect(archived).toBeVisible();
  await archived.locator('.rowmenu__btn').click();
  await page.getByRole('menuitem', { name: 'Delete for good' }).click();
  await expect(page.locator('.confirm--menu')).toContainText('Deleting is for good.');
  await page.locator('.confirm--menu').getByRole('button', { name: 'Keep it' }).click();
  await expect(archived).toBeVisible();
  await archived.getByRole('button', { name: 'restore' }).click();
  await expect(page.locator('.lessons__line')).toHaveText('Nothing archived.');
  await page.getByRole('button', { name: 'Back to the wall' }).click();
  await expect(page.locator('.lcard')).toHaveCount(2);
  expect((await lessons(page)).find((l) => l.id === 'l_01').pinned).toBe(false);

  // Delete from a live card, for good.
  await menu(page, 'Before eight', 'Delete');
  await page.locator('.confirm--menu').getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('.lcard')).toHaveCount(1);
  expect((await lessons(page)).some((l) => l.id === 'l_01')).toBe(false);
  await page.reload();
  await page.click('[data-nav="lessons"]');
  await expect(page.locator('.lcard')).toHaveCount(1);
});

/* ---------- the wall: fill, rotation, trim ---------- */

test('the wall fills the space, pinned first, and the fill rotates from one visit to the next', async ({ page }) => {
  await open(page, manyLessonsState(), 0);
  const total = 38;

  // Newest first on the first visit: three pinned lead, then the newest.
  await expect(page.locator('.lessons__mode')).toHaveText(new RegExp(`^SHOWING NEWEST — \\d+ OF ${total}$`));
  let ids = await wallIds(page);
  expect(ids.slice(0, 3)).toEqual(['l_0002', 'l_0008', 'l_0021']);
  expect(ids[3]).toBe('l_0001');
  const shown = ids.length;
  expect(shown).toBeGreaterThan(5);
  expect(shown).toBeLessThan(total);

  // Nothing overflows the wall, and the label counts what is up.
  const over = await page.locator('.wall--fit').evaluate((w) =>
    w.scrollWidth > w.clientWidth + 1 || w.scrollHeight > w.clientHeight + 1);
  expect(over).toBe(false);
  await expect(page.locator('.lessons__mode')).toHaveText(`SHOWING NEWEST — ${shown} OF ${total}`);
  // And one more would not have fitted: the trim found the edge.
  const fits = await page.locator('.wall--fit').evaluate((w) => {
    const last = w.querySelector('.lcard:last-child').getBoundingClientRect();
    const box = w.getBoundingClientRect();
    return last.bottom <= box.bottom + 1 && last.right <= box.right + 1;
  });
  expect(fits).toBe(true);

  // A click on the label steps the fill: oldest, the pinned still first.
  await page.locator('.lessons__mode').click();
  await expect(page.locator('.lessons__mode')).toHaveText(/^SHOWING OLDEST/);
  ids = await wallIds(page);
  expect(ids.slice(0, 3)).toEqual(['l_0002', 'l_0008', 'l_0021']);
  expect(ids[3]).toBe('l_0040');

  await page.locator('.lessons__mode').click();
  await expect(page.locator('.lessons__mode')).toHaveText(/^SHOWING AT RANDOM/);
  ids = await wallIds(page);
  expect(ids.slice(0, 3)).toEqual(['l_0002', 'l_0008', 'l_0021']);

  // The next visit carries on from where the click left it.
  await page.reload();
  await page.click('[data-nav="lessons"]');
  await expect(page.locator('.lessons__mode')).toHaveText(/^SHOWING NEWEST/);
  // A visit is a mount: leave, let the cross-fade finish, come back.
  await page.click('[data-nav="log"]');
  await expect(page.locator('main.screen[data-s="lessons"]')).toHaveCount(0);
  await page.click('[data-nav="lessons"]');
  await expect(page.locator('.lessons__mode')).toHaveText(/^SHOWING OLDEST/);
});

test('pinned cards are never trimmed: when they alone overflow, the wall scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 700 });
  await open(page, manyLessonsState(), 0);
  await expect(page.locator('.wall--scroll')).toBeVisible();
  expect(await page.locator('.wall--scroll .lcard').count()).toBe(3);
  await expect(page.locator('.lessons__mode')).toHaveText('SHOWING NEWEST — 3 OF 38');
  // Stacked, in one column, and reachable by scrolling the wall — not lost sideways.
  const m = await page.locator('.wall--scroll').evaluate((w) => ({
    x: w.scrollWidth <= w.clientWidth + 1,
    y: w.scrollHeight > w.clientHeight,
  }));
  expect(m).toEqual({ x: true, y: true });
});

/* ---------- search ---------- */

test('search shows every match, by title, text and tag, with no limit', async ({ page }) => {
  await open(page, manyLessonsState(), 0);
  const search = page.locator('.lessons__search');
  await search.fill('python');
  await expect(page.locator('.lessons__mode--flat')).toHaveText('MATCHING “PYTHON” — 14');
  await expect(page.locator('.wall--free .lcard')).toHaveCount(14);
  // Every card matches by word or by tag, and none is archived.
  const cards = await page.locator('.wall--free .lcard').evaluateAll((els) => els.map((e) => ({
    text: e.textContent.toLowerCase(), archived: e.classList.contains('lcard--archived'),
  })));
  expect(cards.every((c) => c.text.includes('python') && !c.archived)).toBe(true);

  await search.fill('Lesson 40');
  await expect(page.locator('.wall--free .lcard')).toHaveCount(1);
  await search.fill('nothing like this');
  await expect(page.locator('.lessons__line')).toHaveText('Nothing matches “nothing like this”.');

  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(search).toHaveValue('');
  await expect(page.locator('.wall--fit')).toBeVisible();
});

/* ---------- import ---------- */

test('a workbook from before decision 25 lands its lessons untitled, unpinned and live', async ({ page }) => {
  // The seed's lessons with the three new fields stripped, as an older
  // export would have written them.
  const s = demoState();
  s.lessons = s.lessons.map((l) => ({ id: l.id, iso_week: l.iso_week, date: l.date, text: l.text, tags: l.tags }));
  await page.addInitScript(([k, v]) => {
    try { localStorage.setItem(k, v); } catch (e) { /* */ }
  }, [DATA_KEY, JSON.stringify(s)]);
  await page.clock.setFixedTime(FROZEN);
  await page.goto(APP_URL);
  await page.click('[data-nav="lessons"]');
  await expect(page.locator('.lcard')).toHaveCount(2);
  await expect(page.locator('.lcard__pinned')).toHaveCount(0);
  await expect(page.locator('.lcard__title')).toHaveCount(0);
});
