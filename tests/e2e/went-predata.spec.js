const { test, expect } = require('@playwright/test');
const { APP_URL } = require('./lib/app-url');
const { installState } = require('./lib/seed-state');
const { twoDayState } = require('./lib/datasets');

/* Decision 31: a day outside [first logged day, today] cannot be picked, and
   now says so.

   The owner clicked a day before their first logged day and nothing happened.
   The rule is right (§8.15, decision 118) and is not widened here — what was
   wrong is that the cell did not look unpickable and the refusal was silent.

   `twoDayState` is the dataset that shows it: two logged days, 6 and 7 June, so
   one June band carries pre-data days (1-5), available days (6-7) and future
   days (8-30) at once. */

const FROZEN = new Date('2026-06-07T12:00:00Z');
const RANGE_KEY = 'meridian:range';

// The pre-data day, the available day, the future day.
const BEFORE = '3 Jun 2026';
const AVAILABLE = '6 Jun 2026';
const AFTER = '10 Jun 2026';

test.use({ viewport: { width: 1280, height: 900 } });

/* `paused`: the flash is a 200 ms hold, so the two tests that watch it run on a
   clock that only moves when the test says so — a loaded machine cannot let the
   timer fire between the click and the assertion. Same idiom as went.spec.js. */
async function open(page, opts) {
  if (opts && opts.paused) {
    await page.clock.install({ time: FROZEN });
    await page.clock.pauseAt(new Date(FROZEN.getTime() + 1000));
  } else {
    await page.clock.setFixedTime(FROZEN);
  }
  await installState(page, twoDayState());
  await page.goto(APP_URL);
  await expect(page.locator('main.screen[data-s="went"]')).toBeVisible();
  await page.waitForFunction(() => document.fonts.status === 'loaded');
}

const day = (page, label) => page.locator(`.cal__cell[aria-label="${label}"]`);
const status = (page) => page.locator('.rail__days');

/* `aria-disabled` makes Playwright's actionability check call the cell "not
   enabled" and refuse to click it — but a real pointer reaches it, which is the
   entire reason these are `aria-disabled` buttons rather than `disabled` ones
   (decision-log #130), and is how the owner hit this in the first place.
   `force` is what went.spec.js already uses to click a future day. */
const clickRefused = (page, label) => day(page, label).click({ force: true });

async function shown(page) {
  return {
    start: await page.locator('#rangeStart').inputValue(),
    end: await page.locator('#rangeEnd').inputValue(),
  };
}

const stored = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k)), RANGE_KEY);

/* ---------- what the cells look like ---------- */

test('pre-data and future days are marked unavailable in the same way', async ({ page }) => {
  await open(page);

  for (const label of [BEFORE, AFTER]) {
    await expect(day(page, label)).toHaveAttribute('aria-disabled', 'true');
    await expect(day(page, label).locator('.cal__fill--off')).toHaveCount(1);
  }
  await expect(day(page, AVAILABLE)).not.toHaveAttribute('aria-disabled', 'true');
  await expect(day(page, AVAILABLE).locator('.cal__fill--off')).toHaveCount(0);

  /* The two are the same rule and the same class, so they cannot drift apart —
     every unavailable cell in the band is drawn the one way. 1-5 June and
     8-30 June: 28 cells, none of them available. */
  await expect(page.locator('.cal__fill--off')).toHaveCount(28);
});

/* Decision 31, the owner's amendment: the brand hover is how an available day
   answers a pointer, so an unavailable one does not borrow it. The numerals
   still come up on both — that is the mockup's behaviour (decision-log #130)
   and only the fill is held back. */
test('hovering an unavailable day shows the numeral but no brand fill', async ({ page }) => {
  await open(page);

  await day(page, BEFORE).hover();
  await expect(day(page, BEFORE).locator('.cal__num')).toBeVisible();
  await expect(day(page, BEFORE).locator('.cal__num')).toHaveText('3');
  await expect(day(page, BEFORE).locator('.cal__fill--hover')).toHaveCount(0);
  await expect(day(page, BEFORE).locator('.cal__num--hover')).toHaveCount(0);
  await expect(day(page, BEFORE).locator('.cal__fill--off')).toHaveCount(1,
    'it still reads as unavailable while hovered');

  await day(page, AFTER).hover();
  await expect(day(page, AFTER).locator('.cal__num')).toBeVisible();
  await expect(day(page, AFTER).locator('.cal__fill--hover')).toHaveCount(0);

  // An available day keeps the brand hover verbatim.
  await day(page, AVAILABLE).hover();
  await expect(day(page, AVAILABLE).locator('.cal__fill--hover')).toHaveCount(1);
  await expect(day(page, AVAILABLE).locator('.cal__num--hover')).toHaveCount(1);
});

/* ---------- the refusal ---------- */

test('a first click on a day before the first logged day flashes and does nothing else',
  async ({ page }) => {
    await open(page, { paused: true });
    const before = await shown(page);
    await expect(status(page)).toHaveText('2 DAYS');

    await clickRefused(page, BEFORE);

    await expect(day(page, BEFORE).locator('.cal__fill--refused')).toHaveCount(1);
    await expect(page.locator('.cal__fill--refused')).toHaveCount(1, 'only that cell');
    // Nothing was picked: no pick opened, no range moved, nothing stored.
    await expect(status(page)).toHaveText('2 DAYS');
    await expect(page.locator('.went__empty[data-pending]')).toHaveCount(0);
    expect(await shown(page)).toEqual(before);
    expect(await stored(page)).toBe(null);

    // And the hold ends on its own.
    await page.clock.runFor(150);
    await expect(page.locator('.cal__fill--refused')).toHaveCount(1, 'still inside 200ms');
    await page.clock.runFor(100);
    await expect(page.locator('.cal__fill--refused')).toHaveCount(0);
    await expect(day(page, BEFORE).locator('.cal__fill--off')).toHaveCount(1,
      'and it goes back to reading unavailable');
  });

test('a second click on an unavailable day leaves the pick open', async ({ page }) => {
  await open(page, { paused: true });

  await day(page, AVAILABLE).click();
  await expect(status(page)).toHaveText('PICK END DAY');
  const mid = await shown(page);

  await clickRefused(page, BEFORE);
  await expect(day(page, BEFORE).locator('.cal__fill--refused')).toHaveCount(1);
  await expect(status(page)).toHaveText('PICK END DAY', 'the pick is still waiting');
  await expect(page.locator('.went__empty[data-pending]')).toBeVisible();
  expect(await shown(page)).toEqual(mid, 'the anchor did not move');
  expect(await stored(page)).toBe(null);

  await page.clock.runFor(250);
  await expect(page.locator('.cal__fill--refused')).toHaveCount(0);

  // The pick is still there to finish, and it finishes normally.
  await expect(status(page)).toHaveText('PICK END DAY');
  await day(page, '7 Jun 2026').click();
  await expect(page.locator('.went__range')).toHaveText('6 JUN 2026 – 7 JUN 2026');
});

test('a future day refuses the same way, as a first click and as a second', async ({ page }) => {
  await open(page, { paused: true });
  const before = await shown(page);

  await clickRefused(page, AFTER);
  await expect(day(page, AFTER).locator('.cal__fill--refused')).toHaveCount(1);
  await expect(status(page)).toHaveText('2 DAYS');
  expect(await shown(page)).toEqual(before);
  expect(await stored(page)).toBe(null);
  await page.clock.runFor(250);
  await expect(page.locator('.cal__fill--refused')).toHaveCount(0);

  await day(page, AVAILABLE).click();
  await expect(status(page)).toHaveText('PICK END DAY');
  await clickRefused(page, AFTER);
  await expect(day(page, AFTER).locator('.cal__fill--refused')).toHaveCount(1);
  await expect(status(page)).toHaveText('PICK END DAY');
  expect(await stored(page)).toBe(null);
});

/* One refusal at a time: clicking a second unavailable day moves the flash
   rather than leaving two cells lit. */
test('a second refused click moves the flash and restarts the hold', async ({ page }) => {
  await open(page, { paused: true });

  await clickRefused(page, BEFORE);
  await page.clock.runFor(150);
  await clickRefused(page, AFTER);

  await expect(page.locator('.cal__fill--refused')).toHaveCount(1);
  await expect(day(page, AFTER).locator('.cal__fill--refused')).toHaveCount(1);
  await expect(day(page, BEFORE).locator('.cal__fill--refused')).toHaveCount(0);

  // The first cell's original 200 ms would have expired by now; the second's
  // has not, because its own hold started fresh.
  await page.clock.runFor(100);
  await expect(page.locator('.cal__fill--refused')).toHaveCount(1);
  await page.clock.runFor(150);
  await expect(page.locator('.cal__fill--refused')).toHaveCount(0);
});

/* The refusal is a held class, not a keyframe, so prefers-reduced-motion does
   not erase it (decision-log #135) — the suite runs reduced by default, and
   this asserts it under motion too. */
test.describe('with motion enabled', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('the refusal still shows', async ({ page }) => {
    await open(page, { paused: true });
    await clickRefused(page, BEFORE);
    await expect(day(page, BEFORE).locator('.cal__fill--refused')).toHaveCount(1);
    await page.clock.runFor(250);
    await expect(page.locator('.cal__fill--refused')).toHaveCount(0);
  });
});
