const path = require('node:path');
const { test } = require('@playwright/test');
const { APP_URL } = require('./lib/app-url');
const { demoState, emptyState, DATA_KEY } = require('./lib/seed-state');
const { earlyState, progressState, manyLessonsState } = require('./lib/datasets');

/* Screenshots for a human to look at, on demand: `npx playwright test shots
   --project=chromium`. Not an assertion suite — responsive.spec.js owns the
   matrix; this is the side-by-side fidelity check QUALITY-BAR §8 asks for,
   taken at the reference width in every theme, and at 360. */

const FROZEN = new Date('2026-06-07T12:00:00Z');
const OUT = path.join(__dirname, 'shots', 'review');

async function shoot(page, state, theme, width, screen, file, prep) {
  await page.addInitScript(([k, v, t]) => {
    try { localStorage.setItem(k, v); localStorage.setItem('meridian:theme', t); } catch (e) { /* */ }
  }, [DATA_KEY, JSON.stringify(state), theme]);
  await page.setViewportSize({ width, height: 900 });
  await page.clock.setFixedTime(FROZEN);
  await page.goto(APP_URL);
  await page.click(`[data-nav="${screen}"]`);
  await page.locator(`main.screen[data-s="${screen}"]`).waitFor();
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState === 'finished'));
  if (prep) await prep(page);
  await page.screenshot({ path: path.join(OUT, file), fullPage: true, animations: 'disabled' });
}

test('progress, every theme, 1280 and 360', async ({ page }) => {
  for (const theme of ['paper', 'graphite', 'blueprint']) {
    await shoot(page, demoState(), theme, 1280, 'progress', `progress-${theme}-1280.png`);
  }
  await shoot(page, demoState(), 'paper', 360, 'progress', 'progress-paper-360.png');
  await shoot(page, earlyState(), 'paper', 1280, 'progress', 'progress-early-1280.png');
  await shoot(page, emptyState(), 'paper', 1280, 'progress', 'progress-empty-1280.png');
  await shoot(page, progressState(), 'paper', 1280, 'progress', 'progress-states-1280.png');
  await shoot(page, demoState(), 'paper', 1280, 'progress', 'progress-hover-1280.png', async (p) => {
    await p.locator('.pgoal').first().hover();
    await p.waitForTimeout(250);
  });
  await shoot(page, demoState(), 'paper', 1280, 'progress', 'progress-off-1280.png', async (p) => {
    await p.locator('.pgoal__switch').first().click();
    await p.mouse.move(0, 0);
    await p.waitForTimeout(250);
  });
});

test('lessons: the wall, the trim, search, the archive, the sheet, empty', async ({ page }) => {
  await shoot(page, demoState(), 'paper', 1280, 'lessons', 'lessons-demo-1280.png');
  await shoot(page, manyLessonsState(), 'paper', 1280, 'lessons', 'lessons-many-1280.png');
  await shoot(page, manyLessonsState(), 'graphite', 1280, 'lessons', 'lessons-many-graphite-1280.png');
  await shoot(page, manyLessonsState(), 'paper', 360, 'lessons', 'lessons-many-360.png');
  await shoot(page, manyLessonsState(), 'paper', 1280, 'lessons', 'lessons-search-1280.png', async (p) => {
    await p.locator('.lessons__search').fill('python');
    await p.locator('.lessons__mode--flat').waitFor();
  });
  await shoot(page, manyLessonsState(), 'paper', 1280, 'lessons', 'lessons-archived-1280.png', async (p) => {
    await p.getByRole('button', { name: /View archived/ }).click();
    await p.locator('.lcard--archived').first().waitFor();
  });
  await shoot(page, manyLessonsState(), 'paper', 1280, 'lessons', 'lessons-menu-1280.png', async (p) => {
    await p.locator('.lcard .rowmenu__btn').first().click();
    await p.locator('.rowmenu__panel').waitFor();
  });
  await shoot(page, demoState(), 'paper', 1280, 'lessons', 'lessons-sheet-1280.png', async (p) => {
    await p.click('[data-lesson-new]');
    await p.locator('.sheet__card').waitFor();
    await p.locator('.fld--lesson').fill('Logging at night is guesswork.');
    await p.locator('.tagpick__btn').first().click();
  });
  await shoot(page, emptyState(), 'paper', 1280, 'lessons', 'lessons-empty-1280.png');
});

test('the early label on goals, the goal sheet and the entry sheet', async ({ page }) => {
  await shoot(page, earlyState(), 'paper', 1280, 'goals', 'goals-early-1280.png');
  await shoot(page, earlyState(), 'paper', 1280, 'goals', 'goalsheet-early-1280.png', async (p) => {
    await p.locator('.goalrow__label', { hasText: 'Read the shelf' }).click();
    await p.locator('.reach__tail').waitFor();
  });
  await shoot(page, earlyState(), 'paper', 1280, 'log', 'entrysheet-early-1280.png', async (p) => {
    await p.click('.quickadd__open');
    await p.locator('.seg').first().getByText('2 h', { exact: true }).click();
    await p.locator('.seg').nth(1).getByText('Read the shelf').click();
    await p.locator('.preview').waitFor();
  });
});

/* The one screenshot that is committed. Everything else in this file lands in
   the gitignored shots folder for the owner to look at and then forget; this
   one is in the README a stranger reads before they download anything, so it
   is generated the same way as the rest rather than cropped by hand, and it
   goes to docs/readme/ where git can see it.

   Log, paper, 1280 — the reference width, the default theme, and the screen
   the app is actually used on. `fullPage: false`: the README wants the window
   a reader would see, not a tall strip of the whole document. */
test('the README screenshot', async ({ page }) => {
  await page.addInitScript(([k, v, t]) => {
    try { localStorage.setItem(k, v); localStorage.setItem('meridian:theme', t); } catch (e) { /* */ }
  }, [DATA_KEY, JSON.stringify(demoState()), 'paper']);
  /* 1280 is the reference width. The height is 620 rather than the suite's 900
     because a demo Sunday is three entries long: at 900 the shot is a third
     dead space, which reads as a bug in the layout rather than as a short day. */
  await page.setViewportSize({ width: 1280, height: 620 });
  await page.clock.setFixedTime(FROZEN);
  await page.goto(APP_URL);
  await page.click('[data-nav="log"]');
  await page.locator('main.screen[data-s="log"]').waitFor();
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState === 'finished'));
  await page.screenshot({
    path: path.join(__dirname, '..', '..', 'docs', 'readme', 'log.png'),
    fullPage: false,
    animations: 'disabled',
  });
});
