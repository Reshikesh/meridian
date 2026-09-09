const path = require('node:path');
const { test } = require('@playwright/test');
const { APP_URL } = require('./lib/app-url');
const { demoState, emptyState, DATA_KEY } = require('./lib/seed-state');
const { earlyState, progressState, manyLessonsState, twoDayState } = require('./lib/datasets');
const { installLinkStub } = require('./lib/link-stub');
const { validBook } = require('./lib/make-workbook');

/* Someone else's save: the demo, one entry longer, so the file is a workbook
   the app can read and is newer than anything it wrote. */
function outsideEdit() {
  const state = demoState();
  state.entries = state.entries.concat([{
    id: 'e_9001', date: state.entries[0].date, duration_min: 45,
    activity: 'Typed in Excel', category_id: 'cat_learn', goal_id: '', value: '',
    created_at: '2026-06-07T09:00:00',
  }]);
  return validBook(state);
}

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

/* Decision 31: what an unavailable day looks like beside an available one.
   The calendar scroller alone, at the top of its first band, so the shot is
   the cells and nothing else. `twoday` is the telling one — pre-data,
   available and future days all sit in its single June band. */
async function shootCal(page, state, theme, file, prep) {
  await page.addInitScript(([k, v, t]) => {
    try { localStorage.setItem(k, v); localStorage.setItem('meridian:theme', t); } catch (e) { /* */ }
  }, [DATA_KEY, JSON.stringify(state), theme]);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.setFixedTime(FROZEN);
  await page.goto(APP_URL);
  await page.click('[data-nav="went"]');
  await page.locator('main.screen[data-s="went"]').waitFor();
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState === 'finished'));
  // The first band, so the days before the first logged day are on screen.
  await page.evaluate(() => {
    const s = document.querySelector('.cal__scroll');
    if (s) s.scrollTop = 0;
  });
  if (prep) await prep(page);
  await page.locator('.cal__scroll').screenshot({
    path: path.join(OUT, file), animations: 'disabled',
  });
}

test('the calendar: unavailable days beside available ones, every theme', async ({ page }) => {
  for (const [name, state] of [['demo', demoState()], ['twoday', twoDayState()]]) {
    for (const theme of ['paper', 'graphite', 'blueprint']) {
      await shootCal(page, state, theme, `cal-${name}-${theme}.png`);
    }
  }
  /* The comparison decision 31 turns on: an available day OUT of range is a
     solid `--pale` tile, and `--pale` was the same hex as the `--line2` an
     unavailable day was outlined in. Neither dataset above shows it, because
     in both the default range covers every available day — so pick a narrow
     range on the demo and put the May band's pre-data days (1-24) next to its
     available-but-unpicked ones (25-31). */
  for (const theme of ['paper', 'graphite', 'blueprint']) {
    await shootCal(page, demoState(), theme, `cal-pale-${theme}.png`, async (p) => {
      await p.locator('.cal__cell[aria-label="1 Jun 2026"]').click();
      await p.locator('.cal__cell[aria-label="4 Jun 2026"]').click();
      await p.evaluate(() => { document.querySelector('.cal__scroll').scrollTop = 0; });
      await p.mouse.move(0, 0);
      await p.waitForTimeout(250);
    });
  }

  // Hovered: an unavailable day, and an available one that is not an endpoint.
  await shootCal(page, twoDayState(), 'paper', 'cal-hover-unavailable.png', async (p) => {
    await p.locator('.cal__cell[aria-label="3 Jun 2026"]').hover();
    await p.waitForTimeout(200);
  });
  // 27 May: available, in the same band as the demo's pre-data days 1-24.
  await shootCal(page, demoState(), 'paper', 'cal-hover-available.png', async (p) => {
    await p.evaluate(() => { document.querySelector('.cal__scroll').scrollTop = 0; });
    await p.locator('.cal__cell[aria-label="27 May 2026"]').hover();
    await p.waitForTimeout(200);
  });
  /* The refusal flash is not shot: it lasts 200 ms, and a screenshot racing it
     would produce a review image that is sometimes the flash and sometimes not.
     went-predata.spec.js asserts it on a paused clock instead. */
});

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

/* The two screenshots that are committed. Everything else in this file lands
   in the gitignored shots folder for the owner to look at and then forget;
   these are in the README a stranger reads before they download anything, so
   they are generated the same way as the rest rather than cropped by hand, and
   they go to docs/readme/ where git can see them.

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

/* The second committed screenshot: Where it went, which is the screen that
   shows what the app is FOR — a fortnight of durations split by category,
   every band coloured by its direction. The demo dataset is what it runs on,
   the same one the Log shot uses, so the two screenshots are one continuous
   sitting rather than two unrelated fictions.

   The demo, not the QUALITY-BAR stress dataset: 20 categories called
   `Category 01 abcdefgh…` fill more of the ribbon and tell a reader nothing.
   Eight real names and a fortnight of hours is what the app is like.

   800 tall: measured, the legend under the ribbon ends at ~775, and a taller
   shot is dead space that reads as a layout bug rather than as a short day. */
test('the README screenshot, Where it went', async ({ page }) => {
  await page.addInitScript(([k, v, t]) => {
    try { localStorage.setItem(k, v); localStorage.setItem('meridian:theme', t); } catch (e) { /* */ }
  }, [DATA_KEY, JSON.stringify(demoState()), 'paper']);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.clock.setFixedTime(FROZEN);
  await page.goto(APP_URL);
  await page.click('[data-nav="went"]');
  await page.locator('main.screen[data-s="went"]').waitFor();
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState === 'finished'));
  await page.screenshot({
    path: path.join(__dirname, '..', '..', 'docs', 'readme', 'went.png'),
    fullPage: false,
    animations: 'disabled',
  });
});

/* The linked workbook (Phase 8). Nothing here comes from the mockup — every
   state is new — so these are the shots the fidelity check actually turns on:
   the Data sheet's WORKBOOK block, the header's four labels, and the sheet the
   conflict opens. The stub is lib/link-stub.js, the same double the matrices
   use; it goes in before the state so both are in place before the first
   paint. */
test('the linked workbook, every state', async ({ page }) => {
  const link = async (p) => {
    await p.click('[data-data-open]');
    await p.click('[data-link-existing]');
    await p.locator('[data-link-file]').waitFor();
  };
  const log = async (p) => p.evaluate(() => window.Meridian.store.addEntry({
    date: window.Meridian.store.getState().entries[0].date,
    duration_min: 30, activity: 'Logged for the shot', category_id: 'cat_learn',
  }));
  /* Between shots, not before every navigation: some of these link a workbook
     and then reload on purpose, and a clear-on-load would wipe the very state
     the shot is of. */
  const reset = async (p) => p.evaluate(() => {
    try {
      ['meridian:link', '__mf:knobs', '__mf:bytes', '__mf:lastModified']
        .forEach((k) => localStorage.removeItem(k));
    } catch (e) { /* private mode */ }
    indexedDB.deleteDatabase('meridian');
  });

  for (const theme of ['paper', 'graphite', 'blueprint']) {
    await installLinkStub(page, {});
    await shoot(page, demoState(), theme, 1280, 'log', `link-data-unlinked-${theme}.png`,
      async (p) => { await p.click('[data-data-open]'); await p.locator('.data__wb').waitFor(); });
    await reset(page);
  }

  await installLinkStub(page, {});
  await shoot(page, demoState(), 'paper', 1280, 'log', 'link-data-linked.png', link);
  await reset(page);

  await installLinkStub(page, {});
  await shoot(page, demoState(), 'paper', 1280, 'log', 'link-header-saved.png', async (p) => {
    await link(p);
    await p.keyboard.press('Escape');
    await log(p);
    await p.waitForTimeout(200);
  });
  await reset(page);

  await installLinkStub(page, {});
  await shoot(page, demoState(), 'paper', 1280, 'log', 'link-header-save-n.png', async (p) => {
    await link(p);
    await p.keyboard.press('Escape');
    await p.evaluate(() => { window.__link.permission = 'prompt'; window.__link.request = 'prompt'; });
    await p.reload();
    await p.locator('.datactl__state:has-text("SAVED · AUTO")').waitFor();
    await log(p);
    await p.locator('.datactl__state--live').waitFor();
  });
  await reset(page);

  await installLinkStub(page, {});
  await shoot(page, demoState(), 'paper', 1280, 'log', 'link-header-locked.png', async (p) => {
    await link(p);
    await p.keyboard.press('Escape');
    await p.evaluate(() => { window.__link.failWrite = 'InvalidStateError'; });
    await log(p);
    await p.locator('.datactl__state--warn').waitFor();
  });
  await reset(page);

  /* Edited outside, and the choice it opens — in two themes, because the
     conflict sheet is the widest new surface in the app. */
  for (const theme of ['paper', 'graphite']) {
    await installLinkStub(page, {});
    await shoot(page, demoState(), theme, 1280, 'log', `link-conflict-${theme}.png`, async (p) => {
      await link(p);
      await p.keyboard.press('Escape');
      await p.evaluate((arr) => window.__file.put(arr), Array.from(outsideEdit()));
      await log(p);
      await p.locator('.datactl__state--warn').waitFor();
      await p.click('[data-data-open]');
      await p.locator('[data-keep-local]').waitFor();
    });
    await reset(page);
  }
});
