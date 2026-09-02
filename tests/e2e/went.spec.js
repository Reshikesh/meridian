const { test, expect } = require('@playwright/test');
const { APP_URL } = require('./lib/app-url');
const { auditInPage, formatAudit } = require('./lib/audit');
const { installState, DATA_KEY } = require('./lib/seed-state');
const { gappedState, archivedState, singleCategoryState, stressState } = require('./lib/datasets');

/* Spec §12 "Where it went", the §3 interaction table, and the parts of
   QUALITY-BAR §2 and §4 this screen owns. The demo is fourteen days ending on
   the frozen 7 June 2026, so its first logged day is 25 May. */

const FROZEN = new Date('2026-06-07T12:00:00Z');
const RANGE_KEY = 'meridian:range';

test.use({ viewport: { width: 1280, height: 900 } });

/* `paused`: the two timing tests (the 6 s undo, the 200 ms revert hold) run
   on a clock that only moves when the test says so, so a loaded machine
   cannot let a timer fire between two assertions. Everything else keeps the
   suite's fixed time with real timers, which the screen cross-fade needs.
   install() is given the time explicitly: called bare after setFixedTime it
   would reset the date to real time. */
async function open(page, state, opts) {
  if (opts && opts.paused) {
    await page.clock.install({ time: FROZEN });
    await page.clock.pauseAt(new Date(FROZEN.getTime() + 1000));
  } else {
    await page.clock.setFixedTime(FROZEN);
  }
  await installState(page, state);
  await page.goto(APP_URL);
  await expect(page.locator('main.screen[data-s="went"]')).toBeVisible();
  await page.waitForFunction(() => document.fonts.status === 'loaded');
}

const day = (page, label) => page.locator(`.cal__cell[aria-label="${label}"]`);
const band = (page, id) => page.locator(`.ribbon__band[data-node="${id}"]`);

async function shown(page) {
  return {
    start: await page.locator('#rangeStart').inputValue(),
    end: await page.locator('#rangeEnd').inputValue(),
  };
}

async function stored(page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)), RANGE_KEY);
}

const heading = (page) => page.locator('.went__h1');
const status = (page) => page.locator('.rail__days');
const undo = (page) => page.locator('.rail__undo');

/* ---------- the two-click pick ---------- */

test('two clicks pick a range, in either order; a future day is ignored; nothing is stored until it lands', async ({ page }) => {
  await open(page);
  await expect(heading(page)).toHaveText('186.5 hours logged');
  await expect(status(page)).toHaveText('14 DAYS');
  expect(await stored(page)).toBe(null);

  // First click: that one day, PICK END DAY, still nothing stored.
  await day(page, '3 Jun 2026').click();
  await expect(status(page)).toHaveText('PICK END DAY');
  expect(await shown(page)).toEqual({ start: '3 Jun 2026', end: '3 Jun 2026' });
  await expect(heading(page)).toHaveText('14.5 hours logged');
  expect(await stored(page)).toBe(null);

  // Second click, earlier than the first: the pair lands in order.
  await day(page, '1 Jun 2026').click();
  expect(await shown(page)).toEqual({ start: '1 Jun 2026', end: '3 Jun 2026' });
  await expect(heading(page)).toHaveText('44.5 hours logged');
  await expect(undo(page)).toBeVisible();
  await expect(status(page)).toHaveCount(0);
  expect(await stored(page)).toEqual({ s: 20605, e: 20607 });

  // The donut, split and caption all re-aggregated for the three days.
  await expect(page.locator('.went__range')).toHaveText('1 JUN 2026 – 3 JUN 2026');
  await expect(page.locator('.went__note')).toHaveText('62% coverage · 27.5 h unlogged');
  await expect(page.locator('.donut__svg')).toHaveAttribute('aria-label', '62% of the 72.0 h in this range are logged');
  // Mon–Wed of the seed: 3.5 + 1 + 3 + 0.5 h More, 6 + 3.5 h Less, 27 h Work.
  await expect(page.locator('.split__caption')).toHaveText('8.0 h more · 9.5 h less · 27.0 h upkeep');

  // A future day and a day before the first entry are not selectable.
  await expect(day(page, '8 Jun 2026')).toHaveAttribute('aria-disabled', 'true');
  await day(page, '8 Jun 2026').click({ force: true });
  await expect(status(page)).toHaveCount(0);
  await expect(day(page, '24 May 2026')).toHaveAttribute('aria-disabled', 'true');
  expect(await shown(page)).toEqual({ start: '1 Jun 2026', end: '3 Jun 2026' });
});

test('Escape during PICK END DAY restores the range it replaced, with no undo armed', async ({ page }) => {
  await open(page);
  await day(page, '3 Jun 2026').click();
  await expect(status(page)).toHaveText('PICK END DAY');
  await page.keyboard.press('Escape');
  await expect(status(page)).toHaveText('14 DAYS');
  expect(await shown(page)).toEqual({ start: '25 May 2026', end: '7 Jun 2026' });
  await expect(undo(page)).toHaveCount(0);
  expect(await stored(page)).toBe(null);
});

test('Escape with the Data sheet open closes the sheet and leaves the pick pending', async ({ page }) => {
  await open(page);
  await day(page, '3 Jun 2026').click();
  await page.click('[data-data-open]');
  await expect(page.locator('.sheet__card')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.sheet__card')).toHaveCount(0);
  await expect(status(page)).toHaveText('PICK END DAY');
});

/* ---------- presets and undo ---------- */

test('presets land, light the mockup way, and undo arms only on a change', async ({ page }) => {
  await open(page);
  // The default range on a 14-day dataset IS the clamped 30D, so ALL is lit.
  await expect(page.locator('[data-preset="all"]')).toHaveAttribute('data-active', '1');
  await expect(page.locator('[data-preset="30"]')).toHaveAttribute('data-active', '0');

  // Same range again: no change, so no undo.
  await page.click('[data-preset="30"]');
  await expect(undo(page)).toHaveCount(0);
  await expect(status(page)).toHaveText('14 DAYS');

  await day(page, '1 Jun 2026').click();
  await day(page, '3 Jun 2026').click();
  await expect(undo(page)).toBeVisible();
  await expect(page.locator('.preset[data-active="1"]')).toHaveCount(0, 'a hand-picked range lights nothing');

  await page.click('[data-preset="90"]');
  expect(await shown(page)).toEqual({ start: '25 May 2026', end: '7 Jun 2026' });
  await expect(page.locator('[data-preset="all"]')).toHaveAttribute('data-active', '1');
  await expect(undo(page)).toBeVisible();

  // An unchanged landing clears the undo that was showing.
  await page.click('[data-preset="all"]');
  await expect(undo(page)).toHaveCount(0);
  await expect(status(page)).toHaveText('14 DAYS');
});

test('UNDO restores the prior range and scrolls to it; it expires after six seconds', async ({ page }) => {
  await open(page, undefined, { paused: true });
  await day(page, '1 Jun 2026').click();
  await day(page, '3 Jun 2026').click();
  await expect(undo(page)).toBeVisible();

  await undo(page).click();
  expect(await shown(page)).toEqual({ start: '25 May 2026', end: '7 Jun 2026' });
  await expect(status(page)).toHaveText('14 DAYS');
  await expect(undo(page)).toHaveCount(0);
  expect(await stored(page)).toEqual({ s: 20598, e: 20611 });

  await day(page, '2 Jun 2026').click();
  await day(page, '4 Jun 2026').click();
  await expect(undo(page)).toBeVisible();
  await page.clock.runFor(5900);
  await expect(undo(page)).toBeVisible();
  await page.clock.runFor(200);
  await expect(undo(page)).toHaveCount(0);
  await expect(status(page)).toHaveText('3 DAYS');
  expect(await shown(page)).toEqual({ start: '2 Jun 2026', end: '4 Jun 2026' });
});

test('the undo survives a trip to another screen', async ({ page }) => {
  await open(page);
  await day(page, '1 Jun 2026').click();
  await day(page, '3 Jun 2026').click();
  await page.click('[data-nav="log"]');
  await page.click('[data-nav="went"]');
  await expect(undo(page)).toBeVisible();
  await undo(page).click();
  expect(await shown(page)).toEqual({ start: '25 May 2026', end: '7 Jun 2026' });
});

/* ---------- typed dates (spec §3, §12) ---------- */

test('typed dates: day-first, ISO and month names land; nonsense and out-of-bounds revert with a flash', async ({ page }) => {
  await open(page, undefined, { paused: true });
  const start = page.locator('#rangeStart');
  const end = page.locator('#rangeEnd');

  await end.fill('4/6');
  await end.press('Enter');
  expect(await shown(page)).toEqual({ start: '25 May 2026', end: '4 Jun 2026' });
  await expect(undo(page)).toBeVisible();
  await expect(end).not.toBeFocused();

  await start.fill('2026-06-02');
  await start.press('Enter');
  expect(await shown(page)).toEqual({ start: '2 Jun 2026', end: '4 Jun 2026' });

  // A start after the end swaps the pair.
  await start.fill('6 Jun');
  await start.press('Enter');
  expect(await shown(page)).toEqual({ start: '4 Jun 2026', end: '6 Jun 2026' });

  // The mockup's looser forms.
  await start.fill('1-6');
  await start.press('Enter');
  expect(await shown(page)).toEqual({ start: '1 Jun 2026', end: '6 Jun 2026' });

  // Blur commits too.
  await end.fill('Jun 5');
  await end.blur();
  expect(await shown(page)).toEqual({ start: '1 Jun 2026', end: '5 Jun 2026' });

  // The clock is paused, so the 200ms hold lasts until the test moves it.
  for (const bad of ['foo', '31 Feb', '7/6/2025', '24/5', '8/6', '13/13']) {
    await start.fill(bad);
    await start.press('Enter');
    const snap = await start.evaluate((el) => ({
      value: el.value,
      reverted: el.classList.contains('rail__input--reverted'),
      background: getComputedStyle(el).backgroundColor,
      invalid: el.getAttribute('aria-invalid'),
    }));
    expect(snap, bad).toEqual({
      value: '1 Jun 2026', reverted: true, background: 'rgb(247, 236, 234)', invalid: 'true',
    });
    await page.clock.runFor(250);
    await expect(start, bad).not.toHaveClass(/rail__input--reverted/);
  }
  expect(await shown(page)).toEqual({ start: '1 Jun 2026', end: '5 Jun 2026' });
});

test('Escape discards a typed draft; focus selects, scrolls and rings the endpoint', async ({ page }) => {
  await open(page);
  const start = page.locator('#rangeStart');

  await start.focus();
  await expect(page.locator('.cal__ring')).toHaveCount(1);
  await expect(day(page, '25 May 2026').locator('.cal__ring')).toHaveCount(1);
  await expect(page.locator('.cal__chip--end')).toHaveClass(/cal__chip--dim/);
  await expect(page.locator('.cal__chip--start')).not.toHaveClass(/cal__chip--dim/);
  expect(await page.evaluate(() => {
    const el = document.activeElement;
    return el.selectionEnd - el.selectionStart === el.value.length;
  })).toBe(true);

  await start.fill('zzz');
  await start.press('Escape');
  await expect(start).toHaveValue('25 May 2026');
  await expect(start).not.toBeFocused();
  await expect(start).not.toHaveClass(/rail__input--reverted/);
  await expect(page.locator('.cal__ring')).toHaveCount(0);
  await expect(undo(page)).toHaveCount(0);
});

/* ---------- the chart ---------- */

test('a band click shades the calendar by that node, a second click clears, a split change clears', async ({ page }) => {
  await open(page);
  await expect(page.locator('.ribbon__band')).toHaveCount(8);
  // Ascending is the default: smallest at the top, Work at the bottom.
  await expect(page.locator('.ribbon__band').first().locator('.ribbon__name')).toHaveText('Reading');
  await expect(page.locator('.ribbon__band').last().locator('.ribbon__name')).toHaveText('Work');
  await expect(page.locator('.ribbon__band').last().locator('.ribbon__pct')).toHaveText(/47%/);
  await expect(page.locator('.ribbon__labeltotal')).toHaveText('186.5');

  await band(page, 'cat:cat_learn').click();
  await expect(band(page, 'cat:cat_learn')).toHaveClass(/ribbon__band--on/);
  await expect(band(page, 'cat:cat_learn')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.ribbon__band--dim')).toHaveCount(7);
  await expect(band(page, 'cat:cat_work').locator('.ribbon__flow')).toHaveCSS('fill-opacity', '0.08');
  await expect(band(page, 'cat:cat_learn').locator('.ribbon__flow')).toHaveCSS('fill-opacity', '0.72');

  // Learning is logged every day; the shade follows the day's share of the
  // busiest day, so the 90-minute Monday is darker than the 30-minute Friday.
  const heat = page.locator('.cal__fill--heat-more');
  expect(await heat.count()).toBe(14);
  const opacity = async (label) => Number(await day(page, label).locator('.cal__fill').evaluate((el) => getComputedStyle(el).opacity));
  expect(await opacity('1 Jun 2026')).toBeCloseTo(1, 2);
  expect(await opacity('5 Jun 2026')).toBeCloseTo(0.4, 2);

  await band(page, 'cat:cat_learn').click();
  await expect(page.locator('.ribbon__band--on')).toHaveCount(0);
  await expect(page.locator('.ribbon__band--dim')).toHaveCount(0);
  await expect(page.locator('.cal__fill--heat')).toHaveCount(0);

  await band(page, 'cat:cat_scroll').click();
  await expect(page.locator('.cal__fill--heat-less')).toHaveCount(14);
  await page.locator('.seg--small').first().getByText('Goal', { exact: true }).click();
  await expect(page.locator('.ribbon__band--on')).toHaveCount(0);
  await expect(page.locator('.cal__fill--heat')).toHaveCount(0);
  await expect(page.locator('.ribbon__band')).toHaveCount(3);
  await expect(band(page, 'goal:none').locator('.ribbon__sub')).toHaveText('across every category');
  await expect(band(page, 'goal:goal_py').locator('.ribbon__sub')).toHaveText('Learning');
});

test('the keyboard reaches the bands; sort reorders', async ({ page }) => {
  await open(page);
  await band(page, 'cat:cat_family').focus();
  await page.keyboard.press('Enter');
  await expect(band(page, 'cat:cat_family')).toHaveClass(/ribbon__band--on/);
  await page.keyboard.press(' ');
  await expect(band(page, 'cat:cat_family')).not.toHaveClass(/ribbon__band--on/);

  await page.locator('.seg--small').nth(1).getByText('Descending', { exact: true }).click();
  await expect(page.locator('.ribbon__band').first().locator('.ribbon__name')).toHaveText('Work');
  await expect(page.locator('.ribbon__band').last().locator('.ribbon__name')).toHaveText('Reading');
});

test('a focused band whose category has no hours in the new range is dropped, not left dimming everything', async ({ page }) => {
  await open(page);
  await band(page, 'cat:cat_reading').click();
  await expect(page.locator('.ribbon__band--dim')).toHaveCount(7);
  // Monday 1 June has no Reading.
  await day(page, '1 Jun 2026').click();
  await day(page, '1 Jun 2026').click();
  await expect(band(page, 'cat:cat_reading')).toHaveCount(0);
  await expect(page.locator('.ribbon__band--dim')).toHaveCount(0);
  await expect(page.locator('.cal__fill--heat')).toHaveCount(0);
  await page.mouse.move(0, 0);
  await expect(day(page, '1 Jun 2026').locator('.cal__fill')).toHaveClass(/cal__fill--in/);
});

test('a theme switch re-renders the chart from tokens, with no reload', async ({ page }) => {
  await open(page);
  const fill = () => band(page, 'cat:cat_learn').locator('.ribbon__flow').evaluate((el) => getComputedStyle(el).fill);
  const paper = await fill();
  await page.click('[data-theme-btn="graphite"]');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'graphite');
  expect(await fill()).not.toBe(paper);
  await page.click('[data-theme-btn="blueprint"]');
  const blueprint = await fill();
  expect(blueprint).not.toBe(paper);
  expect(blueprint).toBe('rgb(31, 107, 82)');
});

/* ---------- persistence and the live dataset ---------- */

test('the range survives a reload; a malformed stored value falls back', async ({ page }) => {
  await open(page);
  await day(page, '1 Jun 2026').click();
  await day(page, '3 Jun 2026').click();
  await page.reload();
  await expect(page.locator('main.screen[data-s="went"]')).toBeVisible();
  expect(await shown(page)).toEqual({ start: '1 Jun 2026', end: '3 Jun 2026' });
  await expect(status(page)).toHaveText('3 DAYS');

  await page.evaluate((k) => localStorage.setItem(k, '{nope'), RANGE_KEY);
  await page.reload();
  await expect(page.locator('main.screen[data-s="went"]')).toBeVisible();
  expect(await shown(page)).toEqual({ start: '25 May 2026', end: '7 Jun 2026' });
});

test('a stored range that is now out of bounds is clamped, not discarded', async ({ page }) => {
  await open(page);
  // Stored before the first logged day and after today.
  await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ s: 20500, e: 20700 })), RANGE_KEY);
  await page.reload();
  await expect(page.locator('main.screen[data-s="went"]')).toBeVisible();
  expect(await shown(page)).toEqual({ start: '25 May 2026', end: '7 Jun 2026' });
});

test('deleting the earliest entries moves the first day and the range with it, live', async ({ page }) => {
  await open(page);
  await expect(status(page)).toHaveText('14 DAYS');
  await page.evaluate(() => {
    const store = window.Meridian.store;
    store.getState().entries
      .filter((e) => e.date === '2026-05-25')
      .forEach((e) => store.deleteEntry(e.id));
  });
  await expect(status(page)).toHaveText('13 DAYS');
  expect(await shown(page)).toEqual({ start: '26 May 2026', end: '7 Jun 2026' });
  await expect(day(page, '25 May 2026')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('[data-preset="all"]')).toHaveAttribute('data-active', '1');
});

/* ---------- states ---------- */

test('a range with nothing in it shows the empty panel, not a zero chart', async ({ page }) => {
  await open(page, gappedState());
  await page.locator('#rangeStart').fill('2/6');
  await page.locator('#rangeStart').press('Enter');
  await page.locator('#rangeEnd').fill('4/6');
  await page.locator('#rangeEnd').press('Enter');

  await expect(heading(page)).toHaveText('0.0 hours logged');
  await expect(page.locator('.went__empty')).toContainText('Nothing logged in this range.');
  await expect(page.locator('.went__empty')).toContainText('Pick another range, or log a few days.');
  await expect(page.locator('.ribbon')).toHaveCount(0);
  await expect(page.locator('.split__pct')).toHaveCount(0);
  await expect(page.locator('.split__caption')).toHaveText('0.0 h more · 0.0 h less · 0.0 h upkeep');
  await expect(page.locator('.donut__arc')).toHaveAttribute('stroke-dasharray', '0.00 59.69');
  await expect(page.locator('.went__note')).toHaveText('0% coverage · 72.0 h unlogged');
  // The rail is still there to pick another range with.
  await expect(page.locator('.presets')).toBeVisible();
});

test('an archived category stays in the chart and leaves the pickers (rule §8.11)', async ({ page }) => {
  await open(page, archivedState());
  await expect(band(page, 'cat:cat_family')).toHaveCount(1);
  await expect(band(page, 'cat:cat_family').locator('.ribbon__name')).toHaveText('Family');
  await page.click('[data-nav="log"]');
  const options = await page.locator('.quickadd__row .select--cat option').allTextContents();
  expect(options).not.toContain('Family');
});

test('one category is one full-height band', async ({ page }) => {
  await open(page, singleCategoryState());
  await expect(page.locator('.ribbon__band')).toHaveCount(1);
  await expect(page.locator('.ribbon__band .ribbon__pct')).toHaveText(/100%/);
  const h = await page.locator('.ribbon__svg').evaluate((el) => el.getAttribute('height'));
  expect(Number(h)).toBe(420);
});

test('with no entries at all the screen is its designed empty state', async ({ page }) => {
  const s = gappedState();
  s.entries = [];
  await page.clock.setFixedTime(FROZEN);
  await installState(page, s);
  await page.goto(APP_URL);
  await expect(page.locator('main.screen[data-s="went"] .t-h1')).toHaveText('Nothing to show yet.');
  await expect(page.locator('.rail')).toHaveCount(0);
});

/* ---------- long content (QUALITY-BAR §2) ---------- */

// The auditor skips everything inside an <svg>, so the ribbon's own text is
// checked here, by bounding box: every name ends before its figure, every
// figure ends inside the chart, the LOGGED HOURS label starts inside it.
async function ribbonFits(page) {
  return page.evaluate(() => {
    const svg = document.querySelector('.ribbon__svg');
    const W = Number(svg.getAttribute('width'));
    const problems = [];
    for (const g of document.querySelectorAll('.ribbon__band')) {
      const box = (sel) => { const el = g.querySelector(sel); return el ? el.getBBox() : null; };
      const name = box('.ribbon__name'), pct = box('.ribbon__pct');
      const sub = box('.ribbon__sub'), hours = box('.ribbon__hours');
      if (name.x + name.width > pct.x - 4) problems.push(`name crosses figure: ${g.getAttribute('data-node')}`);
      if (sub && sub.x + sub.width > hours.x - 4) problems.push(`sub crosses figure: ${g.getAttribute('data-node')}`);
      if (pct.x + pct.width > W + 1) problems.push(`figure past the edge: ${g.getAttribute('data-node')}`);
      if (name.x < 0) problems.push(`name off the left: ${g.getAttribute('data-node')}`);
    }
    const label = document.querySelector('.ribbon__label').getBBox();
    if (label.x < 0) problems.push('LOGGED HOURS label off the left');
    const host = document.querySelector('.ribbon').getBoundingClientRect();
    return { problems, W, host: Math.round(host.width) };
  });
}

test('the stress dataset: 20 categories, 30-character names, 12 goals, 365 days', async ({ page }) => {
  await open(page, stressState());
  await expect(page.locator('.ribbon__band')).toHaveCount(20);

  // Every preset is a different range on a year of data, and only one lights.
  const starts = {};
  for (const id of ['30', '90', 'ytd', 'all']) {
    await page.click(`[data-preset="${id}"]`);
    starts[id] = (await shown(page)).start;
    await expect(page.locator('.preset[data-active="1"]')).toHaveCount(1);
    await expect(page.locator(`[data-preset="${id}"]`)).toHaveAttribute('data-active', '1');
  }
  expect(starts).toEqual({ '30': '9 May 2026', '90': '10 Mar 2026', ytd: '1 Jan 2026', all: '8 Jun 2025' });

  // Long names are shortened, never overprinted, at every width the matrix
  // stacks at — and the full name is kept for assistive tech.
  for (const split of ['Category', 'Goal']) {
    await page.locator('.seg--small').first().getByText(split, { exact: true }).click();
    for (const width of [1920, 1280, 1024, 768, 600, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(50);
      const fit = await ribbonFits(page);
      expect(fit.problems, `${split} at ${width}px (svg ${fit.W}, host ${fit.host})`).toEqual([]);
      const failures = formatAudit(await page.evaluate(auditInPage), `${split}/${width}`);
      expect(failures, failures.join('\n')).toEqual([]);
    }
    const first = page.locator('.ribbon__band').first();
    await expect(first.locator('.ribbon__name')).toHaveText(/…$/);
    expect((await first.getAttribute('aria-label')).length).toBeGreaterThan(30);
  }
  await page.setViewportSize({ width: 1280, height: 900 });

  // The calendar has thirteen bands and scrolls the picked month into view,
  // with the chips inside the calendar every time.
  await expect(page.locator('.cal__band')).toHaveCount(13);
  for (const id of ['all', 'ytd', '90', '30']) {
    await page.click(`[data-preset="${id}"]`);
    const chips = await page.evaluate(() => {
      const box = document.querySelector('.cal__scroll').getBoundingClientRect();
      return Array.from(document.querySelectorAll('.cal__chip')).map((c) => {
        const r = c.getBoundingClientRect();
        return { text: c.textContent, inside: r.left >= box.left - 1 && r.right <= box.right + 1 && r.top >= box.top - 1 && r.bottom <= box.bottom + 1 };
      });
    });
    expect(chips.filter((c) => c.text.includes(starts[id].split(' ')[0])).every((c) => c.inside), `${id}: ${JSON.stringify(chips)}`).toBe(true);
  }
});

test('the whole interaction table leaves the console silent', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  await open(page);
  await day(page, '1 Jun 2026').click();
  await day(page, '3 Jun 2026').click();
  await undo(page).click();
  await page.click('[data-preset="ytd"]');
  await band(page, 'cat:cat_work').click();
  await page.locator('.seg--small').first().getByText('Goal', { exact: true }).click();
  await page.locator('.seg--small').nth(1).getByText('Descending', { exact: true }).click();
  await page.locator('#rangeStart').fill('foo');
  await page.locator('#rangeStart').press('Enter');
  await page.locator('#rangeEnd').fill('5/6');
  await page.locator('#rangeEnd').press('Enter');
  await page.click('[data-theme-btn="graphite"]');
  await page.click('[data-nav="log"]');
  await page.click('[data-nav="went"]');
  expect(errors).toEqual([]);
});
