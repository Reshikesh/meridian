const { test, expect } = require('@playwright/test');
const { APP_URL } = require('./lib/app-url');
const { installState, demoState, emptyState } = require('./lib/seed-state');
const { earlyState, progressState } = require('./lib/datasets');

/* BUILD-PLAN § Phase 6, Progress (decision 27): every live goal on one chart,
   the early estimate from the second logged day, and — the acceptance line —
   the same landing date and the same label on Goals, the goal sheet, the entry
   sheet and Progress for any goal. */

const FROZEN = new Date('2026-06-07T12:00:00Z');

test.use({ viewport: { width: 1280, height: 900 } });

async function open(page, state) {
  await page.clock.setFixedTime(FROZEN);
  await installState(page, state);
  await page.goto(APP_URL);
  await page.click('[data-nav="progress"]');
  await page.locator('main.screen[data-s="progress"]').waitFor();
}

const goalGroup = (page, id) => page.locator(`.pchart__goal[data-goal="${id}"]`);
const item = (page, name) => page.locator('.pgoal', { hasText: name });

/* ---------- settled: the demo ---------- */

test('every live goal is a line, with its history, its projection and its marks', async ({ page }) => {
  await open(page);

  await expect(page.locator('.progress__head h1')).toHaveText('Two open. One slipping.');
  await expect(page.locator('.pchart__goal')).toHaveCount(2);

  // Learn Python: 12 h banked at 6 h a week lands 23 October, past 27 September.
  const py = goalGroup(page, 'goal_py');
  await expect(py.locator('.pchart__history')).toHaveCount(1);
  await expect(py.locator('.pchart__projection')).toHaveCount(1);
  await expect(py.locator('.pchart__target')).toHaveCount(1);
  await expect(py.locator('.pchart__band')).toHaveCount(1, { timeout: 1000 });

  // Half-marathon: 6 h at 3 h a week lands 11 October, before 25 October — no band.
  const run = goalGroup(page, 'goal_run');
  await expect(run.locator('.pchart__projection')).toHaveCount(1);
  await expect(run.locator('.pchart__band')).toHaveCount(0);

  // The date labels, in the goal's tone: late in --warn, on time in --ink2.
  const marks = page.locator('.pchart__mark');
  await expect(marks).toHaveCount(4);
  await expect(page.locator('.pchart__mark--warn')).toHaveText('23 OCT');
  await expect(page.locator('.pchart__mark--ink2')).toHaveText('11 OCT');
  const targets = await page.locator('.pchart__mark--ink').allTextContents();
  expect(targets.sort()).toEqual(['25 OCT', '27 SEP']);

  // Percent of target: 0, 50 and 100, and the week ticks on Mondays.
  await expect(page.locator('.pchart__ylabels text')).toHaveText(['0%', '50%', '100%']);
  const weeks = await page.locator('.pchart__xlabels text').allTextContents();
  expect(weeks[0]).toBe('W22');
  expect(weeks.every((w) => /^W\d+$/.test(w))).toBe(true);

  await expect(page.locator('.progress__explainer'))
    .toHaveText('Projected from logged hours, not from your plan.');
});

test('the list carries each goal’s colour, figures and date, in the Goals table’s words', async ({ page }) => {
  await open(page);

  const py = item(page, 'Learn Python');
  await expect(py.locator('.pgoal__banked')).toHaveText('12.0');
  await expect(py.locator('.pgoal__of')).toHaveText('/130.0 h');
  await expect(py.locator('.pgoal__pace')).toHaveText('6.0 h/wk');
  await expect(py.locator('.pgoal__lands')).toHaveText('Lands 23 Oct · +26 days');
  await expect(py.locator('.pgoal__lands')).toHaveClass(/pgoal__lands--warn/);
  // Learning's own colour on the swatch.
  await expect(py.locator('.pgoal__line')).toHaveCSS('background-color', 'rgb(43, 74, 125)');

  const run = item(page, 'Half-marathon training');
  await expect(run.locator('.pgoal__lands')).toHaveText('Lands 11 Oct · −14 days');
  await expect(run.locator('.pgoal__lands')).not.toHaveClass(/warn/);

  // The Goals table says the same thing about the same goal.
  await page.click('[data-nav="goals"]');
  const row = page.locator('.goalrow', { hasText: 'Learn Python' });
  await expect(row.locator('.goalrow__date')).toHaveText('23 Oct');
  await expect(row.locator('.goalrow__slip')).toHaveText('+26 days');
});

/* ---------- the switch ---------- */

test('a goal can be switched off the chart and back, by mouse and by key', async ({ page }) => {
  await open(page);
  const sw = item(page, 'Learn Python').locator('.pgoal__switch');

  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await expect(item(page, 'Learn Python')).toHaveClass(/pgoal--off/);
  await expect(page.locator('.pchart__goal')).toHaveCount(1);
  await expect(goalGroup(page, 'goal_py')).toHaveCount(0);
  // Its marks go with it, so the remaining goal's labels can take one band.
  await expect(page.locator('.pchart__mark')).toHaveCount(2);

  // Back on, from the keyboard.
  await sw.focus();
  await page.keyboard.press('Enter');
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.pchart__goal')).toHaveCount(2);

  // Both off: the axes stay, the lines are gone, nothing throws.
  await sw.click();
  await item(page, 'Half-marathon training').locator('.pgoal__switch').click();
  await expect(page.locator('.pchart__goal')).toHaveCount(0);
  await expect(page.locator('.pchart__axis')).toHaveCount(1);
});

test('a row under the pointer dims the other lines', async ({ page }) => {
  await open(page);
  await item(page, 'Learn Python').hover();
  await expect(goalGroup(page, 'goal_run')).toHaveCSS('opacity', '0.18');
  await expect(goalGroup(page, 'goal_py')).toHaveCSS('opacity', '1');
  await page.mouse.move(0, 0);
  await expect(goalGroup(page, 'goal_run')).toHaveCSS('opacity', '1');
});

/* ---------- early (decision 27) ---------- */

test('from the second logged day there is a date, labelled early, and it is the same date everywhere',
  async ({ page }) => {
    await open(page, earlyState());

    const read = item(page, 'Read the shelf');
    await expect(read.locator('.pgoal__lands')).toHaveText('Lands 8 Aug · −23 days');
    await expect(read.locator('.pgoal__early')).toHaveText('early estimate — 3 days');
    await expect(read.locator('.pgoal__pace')).toHaveText('4.2 h/wk');
    await expect(goalGroup(page, 'goal_read').locator('.pchart__projection')).toHaveCount(1);
    // The settled goals carry no label.
    await expect(item(page, 'Learn Python').locator('.pgoal__early')).toHaveCount(0);

    // Goals table: the same date, the same label.
    await page.click('[data-nav="goals"]');
    const row = page.locator('.goalrow', { hasText: 'Read the shelf' });
    await expect(row.locator('.goalrow__date')).toHaveText('8 Aug');
    await expect(row.locator('.goalrow__slip')).toHaveText('−23 days');
    await expect(row.locator('.goalrow__early')).toHaveText('early estimate — 3 days');

    // The goal sheet: the category is as young as the goal here, so the same
    // pace, the same date and the same label.
    await row.locator('.goalrow__label').click();
    await expect(page.locator('.reach__lead'))
      .toContainText('You’ve given Reading 4.2 h a week so far, over 3 logged days.');
    await expect(page.locator('.reach__tail'))
      .toContainText('At 4.2 h it lands 8 Aug (early estimate — 3 days).');
    await page.keyboard.press('Escape');

    // The entry sheet: the label under the preview.
    await page.click('[data-nav="log"]');
    await page.click('.quickadd__open');
    await page.locator('.seg').first().getByText('2 h', { exact: true }).click();
    await page.locator('.seg').nth(1).getByText('Read the shelf').click();
    await expect(page.locator('.preview__from').last()).toHaveText('Lands 8 Aug');
    await expect(page.locator('.preview__early')).toHaveText('early estimate — 3 days');
  });

test('the label counts logged days and is gone at seven', async ({ page }) => {
  await open(page, earlyState());
  // Four more days of an hour each: seven logged days, settled.
  for (const day of ['2026-06-06', '2026-06-04', '2026-06-02', '2026-06-01']) {
    await page.evaluate((d) => window.Meridian.store.addEntry({
      date: d, duration_min: 60, category_id: 'cat_reading', goal_id: 'goal_read',
    }), day);
  }
  await expect(item(page, 'Read the shelf').locator('.pgoal__early')).toHaveCount(0);
  await expect(item(page, 'Read the shelf').locator('.pgoal__lands')).toContainText('Lands');
});

/* ---------- the other states decision 27 names ---------- */

test('reached, one logged day, and a second goal on the same category', async ({ page }) => {
  await open(page, progressState());

  // Reached: history, no projection, "Reached" in --good, no date label.
  const walk = item(page, 'Walk the coast path');
  await expect(walk.locator('.pgoal__lands')).toHaveText('Reached');
  await expect(walk.locator('.pgoal__lands')).toHaveClass(/pgoal__lands--good/);
  await expect(goalGroup(page, 'goal_walk').locator('.pchart__history')).toHaveCount(1);
  await expect(goalGroup(page, 'goal_walk').locator('.pchart__projection')).toHaveCount(0);
  // Its 6 h of 5 stretch the axis past 100.
  await expect(page.locator('.pchart__ylabels text').last()).toHaveText('120%');

  // One day: a stub of a line, the target marked, no date.
  const pg = item(page, 'Learn Postgres');
  await expect(pg.locator('.pgoal__lands')).toHaveText('One day logged — a date needs two');
  await expect(goalGroup(page, 'goal_pg').locator('.pchart__projection')).toHaveCount(0);
  await expect(goalGroup(page, 'goal_pg').locator('.pchart__target')).toHaveCount(1);
  await expect(pg.locator('.pgoal__pace')).toHaveCount(0);

  // Second goal on Learning: dashed, in Learning's colour.
  await expect(goalGroup(page, 'goal_pg').locator('.pchart__history'))
    .toHaveAttribute('stroke-dasharray', '9 6');
  await expect(goalGroup(page, 'goal_py').locator('.pchart__history'))
    .not.toHaveAttribute('stroke-dasharray', /./);
  const swatch = await pg.locator('.pgoal__line').evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(swatch).toContain('repeating-linear-gradient');

  await expect(page.locator('.progress__head h1')).toHaveText('Four open. One slipping.');
});

test('with no goals the screen says so and leads to Goals', async ({ page }) => {
  await open(page, emptyState());
  await expect(page.locator('.progress__head h1')).toHaveText('No goals yet.');
  await expect(page.locator('.progress__none')).toContainText('Nothing to project.');
  await expect(page.locator('.pchart')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Goals' }).click();
  await expect(page.locator('.root')).toHaveAttribute('data-screen', 'goals');
});

test('archiving a goal takes it off the chart; restoring it brings it back', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.Meridian.store.archiveGoal('goal_run'));
  await expect(page.locator('.pgoal')).toHaveCount(1);
  await expect(page.locator('.progress__head h1')).toHaveText('One open. One slipping.');
  await page.evaluate(() => window.Meridian.store.restoreGoal('goal_run'));
  await expect(page.locator('.pgoal')).toHaveCount(2);
});

test('the chart follows the theme with no reload', async ({ page }) => {
  await open(page);
  const axisBefore = await page.locator('.pchart__axis').evaluate((el) => getComputedStyle(el).stroke);
  await page.click('[data-theme-btn="graphite"]');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'graphite');
  const axisAfter = await page.locator('.pchart__axis').evaluate((el) => getComputedStyle(el).stroke);
  expect(axisAfter).not.toBe(axisBefore);
  // Learning's #2b4a7d is under 3:1 on graphite, so its line gets the halo.
  await expect(goalGroup(page, 'goal_py').locator('.pchart__halo')).toHaveCount(1);
  await page.click('[data-theme-btn="paper"]');
  await expect(goalGroup(page, 'goal_py').locator('.pchart__halo')).toHaveCount(0);
});
