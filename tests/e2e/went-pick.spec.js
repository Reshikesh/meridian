const { test, expect } = require('@playwright/test');
const { APP_URL } = require('./lib/app-url');
const { installState } = require('./lib/seed-state');

/* The range picker, driven the way the owner drives it (bug report, after
   Phase 7). Two things make this file different from `went.spec.js`, and both
   were blind spots the owner's report walked straight into:

   1. **Motion is on.** `playwright.config.js` sets `reducedMotion: 'reduce'`
      for the whole suite, so until this file nothing had ever run with the
      120 ms screen cross-fade actually playing. The owner's browser has
      motion enabled. Every test here does.

   2. **The screen is reached through the nav**, not by `goto`. "Where it went"
      is the default screen, so every existing test met it already mounted and
      never left it. Decision 117 says the view survives a trip to another
      screen; nothing tested that, which is where the defect lived.

   The demo is fourteen days ending on the frozen 7 June 2026, first logged
   day 25 May. */

const FROZEN = new Date('2026-06-07T12:00:00Z');
const RANGE_KEY = 'meridian:range';

test.use({
  viewport: { width: 1280, height: 900 },
  reducedMotion: 'no-preference',
});

/* Land on the default screen, leave it, and come back through the nav. With
   motion on, both cross-fades really play, so each step waits for the
   animations to finish rather than for the element alone. */
async function openViaNav(page, state, opts) {
  await page.clock.setFixedTime(FROZEN);
  await installState(page, state);
  await page.goto(APP_URL);
  await expect(page.locator('main.screen[data-s="went"]')).toBeVisible();
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await goTo(page, 'log');
  await goTo(page, (opts && opts.back) || 'went');
}

async function goTo(page, id) {
  await page.click(`[data-nav="${id}"]`);
  await expect(page.locator(`main.screen[data-s="${id}"]`)).toBeVisible();
  await settle(page);
}

/* The cross-fade leaves the outgoing screen in the DOM for 120 ms. Waiting for
   it means an assertion can never read the copy that is on its way out. */
async function settle(page) {
  await page.waitForFunction(
    () => document.getAnimations().every((a) => a.playState === 'finished'));
}

const day = (page, label) => page.locator(`.cal__cell[aria-label="${label}"]`);
const band = (page, id) => page.locator(`.ribbon__band[data-node="${id}"]`);
const heading = (page) => page.locator('.went__h1');
const status = (page) => page.locator('.rail__days');
const undo = (page) => page.locator('.rail__undo');

async function shown(page) {
  return {
    start: await page.locator('#rangeStart').inputValue(),
    end: await page.locator('#rangeEnd').inputValue(),
  };
}

async function stored(page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)), RANGE_KEY);
}

/* Decision 30, as a checklist: while a pick is open NOTHING on the screen may
   still be answering for the range that was there. */
async function expectPending(page, anchorCaption) {
  await expect(status(page)).toHaveText('PICK END DAY');
  await expect(heading(page)).toHaveText('Pick the second day.');
  await expect(page.locator('.went__range')).toHaveText(anchorCaption);
  await expect(page.locator('.went__empty[data-pending]')).toBeVisible();
  await expect(page.locator('.ribbon')).toHaveCount(0);
  await expect(page.locator('.went__note')).toHaveCount(0);
  await expect(page.locator('.split__caption')).toHaveCount(0);
  await expect(page.locator('.preset[data-active="1"]')).toHaveCount(0);
  await expect(page.locator('.donut__svg')).toHaveAttribute('aria-label', 'No range chosen yet');
  // Only the anchor is marked, and no heat survives from a focused band.
  await expect(page.locator('.cal__chip')).toHaveCount(1);
  await expect(page.locator('.cal__fill--in')).toHaveCount(1);
  await expect(page.locator('.cal__fill--heat')).toHaveCount(0);
}

/* ---------- the two-click pick, reached through the nav ---------- */

test('a range picked after arriving through the nav lands on the second click', async ({ page }) => {
  await openViaNav(page);
  await expect(heading(page)).toHaveText('186.5 hours logged');
  await expect(status(page)).toHaveText('14 DAYS');

  await day(page, '1 Jun 2026').click();
  await expectPending(page, 'FROM 1 JUN 2026');
  expect(await stored(page)).toBe(null);

  await day(page, '4 Jun 2026').click();
  await expect(heading(page)).toHaveText('59.5 hours logged');
  await expect(page.locator('.went__range')).toHaveText('1 JUN 2026 – 4 JUN 2026');
  await expect(page.locator('.ribbon')).toHaveCount(1);
  await expect(undo(page)).toBeVisible();
  expect(await shown(page)).toEqual({ start: '1 Jun 2026', end: '4 Jun 2026' });
  expect(await stored(page)).toEqual({ s: 20605, e: 20608 });
});

test('the second day may be earlier than the first: the pair lands in order', async ({ page }) => {
  await openViaNav(page);

  await day(page, '4 Jun 2026').click();
  await expectPending(page, 'FROM 4 JUN 2026');
  await day(page, '1 Jun 2026').click();

  await expect(heading(page)).toHaveText('59.5 hours logged');
  await expect(page.locator('.went__range')).toHaveText('1 JUN 2026 – 4 JUN 2026');
  expect(await stored(page)).toEqual({ s: 20605, e: 20608 });
});

test('clicking the anchor day again lands a one-day range', async ({ page }) => {
  await openViaNav(page);

  await day(page, '3 Jun 2026').click();
  await expectPending(page, 'FROM 3 JUN 2026');
  await day(page, '3 Jun 2026').click();

  await expect(status(page)).toHaveCount(0, 'the pick is finished, so PICK END DAY is gone');
  await expect(page.locator('.went__range')).toHaveText('3 JUN 2026 – 3 JUN 2026');
  await expect(page.locator('.ribbon')).toHaveCount(1);
  expect(await shown(page)).toEqual({ start: '3 Jun 2026', end: '3 Jun 2026' });
  expect(await stored(page)).toEqual({ s: 20607, e: 20607 });
});

/* ---------- the true third click ---------- */

test('a third click starts a new pick and a fourth lands it, while the undo is still armed', async ({ page }) => {
  await openViaNav(page);

  await day(page, '1 Jun 2026').click();
  await day(page, '4 Jun 2026').click();
  await expect(undo(page)).toBeVisible();

  // Third click, with ↩ UNDO still showing: it anchors, it does not land.
  await day(page, '2 Jun 2026').click();
  await expectPending(page, 'FROM 2 JUN 2026');
  expect(await stored(page)).toEqual({ s: 20605, e: 20608 }, 'nothing is stored until it lands');

  await day(page, '6 Jun 2026').click();
  await expect(heading(page)).toHaveText('71.5 hours logged');
  await expect(page.locator('.went__range')).toHaveText('2 JUN 2026 – 6 JUN 2026');
  expect(await stored(page)).toEqual({ s: 20606, e: 20610 });
});

test('a third click after the undo has expired behaves the same', async ({ page }) => {
  await openViaNav(page);

  await day(page, '1 Jun 2026').click();
  await day(page, '4 Jun 2026').click();
  await expect(undo(page)).toBeVisible();
  // Six seconds on a real timer: the undo disarms and {n} DAYS comes back.
  await expect(undo(page)).toHaveCount(0, { timeout: 9000 });
  await expect(status(page)).toHaveText('4 DAYS');

  await day(page, '2 Jun 2026').click();
  await expectPending(page, 'FROM 2 JUN 2026');
  await day(page, '6 Jun 2026').click();
  await expect(heading(page)).toHaveText('71.5 hours logged');
  expect(await stored(page)).toEqual({ s: 20606, e: 20610 });
});

/* ---------- picking again after every other way of setting a range ---------- */

test('a pick works after a preset', async ({ page }) => {
  await openViaNav(page);
  await page.click('.preset[data-preset="30"]');
  await expect(page.locator('.preset[data-active="1"]')).toHaveCount(1);

  await day(page, '1 Jun 2026').click();
  await expectPending(page, 'FROM 1 JUN 2026');
  await day(page, '4 Jun 2026').click();
  await expect(heading(page)).toHaveText('59.5 hours logged');
  expect(await stored(page)).toEqual({ s: 20605, e: 20608 });
});

test('a pick works after a typed date', async ({ page }) => {
  await openViaNav(page);
  await page.locator('#rangeStart').fill('2/6');
  await page.locator('#rangeStart').press('Enter');
  expect(await shown(page)).toEqual({ start: '2 Jun 2026', end: '7 Jun 2026' });

  await day(page, '1 Jun 2026').click();
  await expectPending(page, 'FROM 1 JUN 2026');
  await day(page, '4 Jun 2026').click();
  await expect(heading(page)).toHaveText('59.5 hours logged');
  expect(await stored(page)).toEqual({ s: 20605, e: 20608 });
});

test('a pick works after an undo', async ({ page }) => {
  await openViaNav(page);
  await day(page, '1 Jun 2026').click();
  await day(page, '4 Jun 2026').click();
  await undo(page).click();
  await expect(page.locator('.went__range')).toHaveText('25 MAY 2026 – 7 JUN 2026');

  await day(page, '1 Jun 2026').click();
  await expectPending(page, 'FROM 1 JUN 2026');
  await day(page, '4 Jun 2026').click();
  await expect(heading(page)).toHaveText('59.5 hours logged');
});

/* Decision 121 takes a `nodeIds` function through the landing; decision 30
   says a band focus is cleared when a pick opens, so the new range is never
   drawn behind a dim inherited from the old one. */
test('a pick works with a band focused, and the focus does not survive it', async ({ page }) => {
  await openViaNav(page);
  await band(page, 'cat:cat_learn').click();
  await expect(page.locator('.ribbon__band--on')).toHaveCount(1);
  await expect(page.locator('.cal__fill--heat')).not.toHaveCount(0);

  await day(page, '1 Jun 2026').click();
  await expectPending(page, 'FROM 1 JUN 2026');

  await day(page, '4 Jun 2026').click();
  await expect(heading(page)).toHaveText('59.5 hours logged');
  await expect(page.locator('.ribbon__band--on')).toHaveCount(0, 'the pick cleared the focus');
  await expect(page.locator('.ribbon__band--dim')).toHaveCount(0);
  await expect(page.locator('.cal__fill--heat')).toHaveCount(0);
});

/* ---------- a pick does not outlive the screen ---------- */

/* The defect the owner reported. A pick left open used to survive a trip to
   another screen (decision 117 kept the whole view), so the next click on the
   calendar LANDED the stale anchor instead of starting a new range — and every
   click after it was off by one: land, anchor, land, anchor. Decision 30
   amends 117: the range, the undo, the split, the sort and the focus still
   survive a screen change; a half-made pick does not. */
for (const other of ['log', 'goals', 'progress', 'lessons']) {
  test(`a pick is dropped by leaving for ${other}, so the next click anchors`, async ({ page }) => {
    await openViaNav(page);
    await day(page, '2 Jun 2026').click();
    await expectPending(page, 'FROM 2 JUN 2026');

    await goTo(page, other);
    await goTo(page, 'went');

    // Back on a landed range, exactly as it was left.
    await expect(status(page)).toHaveText('14 DAYS');
    await expect(heading(page)).toHaveText('186.5 hours logged');
    await expect(page.locator('.went__empty[data-pending]')).toHaveCount(0);
    await expect(page.locator('.ribbon')).toHaveCount(1);
    expect(await shown(page)).toEqual({ start: '25 May 2026', end: '7 Jun 2026' });
    // Escape's rule (122): an abandoned pick never moved the range, so there
    // is nothing to undo.
    await expect(undo(page)).toHaveCount(0);
    expect(await stored(page)).toBe(null, 'an abandoned pick stores nothing');

    // And the next click starts a new range rather than finishing the old one.
    await day(page, '30 May 2026').click();
    await expectPending(page, 'FROM 30 MAY 2026');
    await day(page, '2 Jun 2026').click();
    await expect(page.locator('.went__range')).toHaveText('30 MAY 2026 – 2 JUN 2026');
    await expect(heading(page)).toHaveText('50.5 hours logged');
    expect(await stored(page)).toEqual({ s: 20603, e: 20606 });
  });
}

/* The rest of the view is what decision 117 was for, and it still holds. */
test('the range, the undo and the split survive a screen change; only the pick does not', async ({ page }) => {
  await openViaNav(page);
  await page.locator('.seg--small').first().getByText('Goal', { exact: true }).click();
  await expect(band(page, 'goal:none')).toBeVisible();

  await day(page, '1 Jun 2026').click();
  await day(page, '4 Jun 2026').click();
  await expect(undo(page)).toBeVisible();

  await goTo(page, 'log');
  await goTo(page, 'went');

  await expect(page.locator('.went__range')).toHaveText('1 JUN 2026 – 4 JUN 2026');
  await expect(band(page, 'goal:none')).toBeVisible('the goal split survived');
  await expect(undo(page)).toBeVisible('the six-second undo survived');
  await undo(page).click();
  await expect(page.locator('.went__range')).toHaveText('25 MAY 2026 – 7 JUN 2026');
});
