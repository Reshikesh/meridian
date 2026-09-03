const { test, expect } = require('@playwright/test');
const { APP_URL } = require('./lib/app-url');
const { installState } = require('./lib/seed-state');

/* BUILD-PLAN § Phase 5: "the whole app usable without a mouse; focus order
   sensible; focus-visible rings consistent", and QUALITY-BAR §4's sheet
   contract — Escape closes, the veil closes, focus is trapped while open and
   returns to the opener, the first field is focused on open.

   Nothing here uses page.click. Every step is a key, so a control that can only
   be reached with a pointer fails by never being reached. */

const FROZEN = new Date('2026-06-07T12:00:00Z');

test.use({ viewport: { width: 1280, height: 900 } });

async function open(page) {
  await page.clock.setFixedTime(FROZEN);
  await installState(page);
  await page.goto(APP_URL);
  await page.locator('main.screen').first().waitFor();
}

/* What has focus, in a form a failure message can be read from. */
function active(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { tag: 'body' };
    return {
      tag: el.tagName.toLowerCase(),
      // getAttribute, not .className: on an SVG element className is an
      // SVGAnimatedString, and the chart's bands are SVG groups.
      cls: el.getAttribute('class') || '',
      id: el.id || '',
      text: (el.textContent || '').trim().slice(0, 40),
      label: el.getAttribute('aria-label') || '',
      ring: getComputedStyle(el).outlineStyle !== 'none'
        && parseFloat(getComputedStyle(el).outlineWidth) > 0,
    };
  });
}

/* Tab until `match` says yes, so the test asserts reachability rather than an
   exact count of stops — a count would break every time a control is added and
   would tell us nothing about whether the app is usable. */
async function tabTo(page, match, limit = 60) {
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press('Tab');
    const a = await active(page);
    if (match(a)) return { stops: i + 1, focused: a };
  }
  throw new Error(`never reached the target in ${limit} tabs; stopped on `
    + JSON.stringify(await active(page)));
}

/* ---------- the shell ---------- */

test('the header is reachable in source order, and every stop shows a ring', async ({ page }) => {
  await open(page);
  await page.evaluate(() => document.body.focus());

  const seen = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    seen.push(await active(page));
  }

  // Nav first, then the themes, then the data control: the order the header is
  // written in, and the order it reads in.
  const labels = seen.map((s) => s.text);
  expect(labels.slice(0, 6)).toEqual([
    'Log', 'Where it went', 'Progress', 'Goals', 'Plan', 'Lessons',
  ]);
  expect(labels.slice(6, 9)).toEqual(['PAPER', 'GRAPHITE', 'BLUEPRINT']);
  expect(seen[9].cls).toContain('datactl');

  // QUALITY-BAR §4: focus rings are visible for keyboard users.
  for (const s of seen.slice(0, 10)) {
    expect(s.ring, `no focus ring on ${s.text || s.cls}`).toBe(true);
  }
});

test('every screen can be opened from the keyboard', async ({ page }) => {
  await open(page);
  for (const [name, id] of [
    ['Log', 'log'], ['Goals', 'goals'], ['Plan', 'plan'],
    ['Progress', 'progress'], ['Lessons', 'lessons'], ['Where it went', 'went'],
  ]) {
    await page.evaluate(() => document.body.focus());
    await tabTo(page, (a) => a.text === name);
    await page.keyboard.press('Enter');
    await expect(page.locator('.root')).toHaveAttribute('data-screen', id);
  }
});

/* ---------- logging a whole entry with no mouse ---------- */

test('a complete entry can be logged through the row without a pointer', async ({ page }) => {
  await open(page);
  await tabTo(page, (a) => a.text === 'Log');
  await page.keyboard.press('Enter');
  await page.locator('.quickadd').waitFor();

  const before = await page.locator('.logrow--entry').count();

  // The documented tab order: duration, activity, category, goal, then +.
  await tabTo(page, (a) => a.cls.includes('fld--duration'));
  await page.keyboard.type('1.5h');
  await page.keyboard.press('Tab');
  expect((await active(page)).cls).toContain('fld--activity');
  await page.keyboard.type('Typed with no mouse at all');
  await page.keyboard.press('Tab');
  expect((await active(page)).cls).toContain('select__input');
  await page.keyboard.press('Tab');
  expect((await active(page)).cls).toContain('select__input');
  await page.keyboard.press('Tab');
  expect((await active(page)).cls).toContain('quickadd__open');

  // A category is required, so pick one on the way back and commit with Enter
  // from a field that is not the last — the bar says Enter commits from any.
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await page.selectOption('.select--cat select', { label: 'Learning' });
  await page.locator('.fld--activity').focus();
  await page.keyboard.press('Enter');

  await expect(page.locator('.logrow--entry')).toHaveCount(before + 1);
  // A new entry appends to the day, so it is the last row, not the first.
  await expect(page.locator('.logrow--entry').last())
    .toContainText('Typed with no mouse at all');
  // The row clears and the duration takes focus again, so the next entry needs
  // no mouse either (QUALITY-BAR §4).
  expect((await active(page)).cls).toContain('fld--duration');
  await expect(page.locator('.fld--duration').first()).toHaveValue('');
});

test('the row menu opens, acts and closes from the keyboard', async ({ page }) => {
  await open(page);
  await tabTo(page, (a) => a.text === 'Log');
  await page.keyboard.press('Enter');
  await page.locator('.logrow--entry').first().waitFor();

  await tabTo(page, (a) => a.cls.includes('rowmenu__btn'));
  expect((await active(page)).ring).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.locator('.rowmenu__panel')).toBeVisible();

  // Escape closes the menu and hands focus back to the button that opened it.
  await page.keyboard.press('Escape');
  await expect(page.locator('.rowmenu__panel')).toHaveCount(0);
  expect((await active(page)).cls).toContain('rowmenu__btn');

  // And the delete confirm is reachable and cancellable by key alone.
  await page.keyboard.press('Enter');
  await tabTo(page, (a) => a.text === 'Delete', 6);
  await page.keyboard.press('Enter');
  await expect(page.locator('.confirm--menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.confirm--menu')).toHaveCount(0);
});

/* ---------- the sheet contract (QUALITY-BAR §4) ---------- */

async function openEntrySheet(page) {
  await tabTo(page, (a) => a.text === 'Log');
  await page.keyboard.press('Enter');
  await page.locator('.quickadd').waitFor();
  await tabTo(page, (a) => a.cls.includes('quickadd__open'));
  await page.keyboard.press('Enter');
  await page.locator('.sheet__card').waitFor();
}

test('a sheet focuses its first field, traps focus, and gives it back on Escape',
  async ({ page }) => {
    await open(page);
    await openEntrySheet(page);

    // The first field takes focus on open.
    const first = await active(page);
    expect(first.tag === 'button' || first.tag === 'input').toBe(true);

    /* Trapped: tabbing far past the end of the card must never land outside
       it. Forty stops is more than the sheet has, so a leak would show. */
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() =>
        !!document.querySelector('.sheet__card').contains(document.activeElement));
      expect(inside, `focus escaped the sheet after ${i + 1} tabs`).toBe(true);
    }
    // And backwards.
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Shift+Tab');
      const inside = await page.evaluate(() =>
        !!document.querySelector('.sheet__card').contains(document.activeElement));
      expect(inside, `focus escaped backwards after ${i + 1} shift-tabs`).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(page.locator('.sheet__card')).toHaveCount(0);
    expect((await active(page)).cls).toContain('quickadd__open');
  });

test('a stacked sheet takes only the top Escape, and returns to its origin',
  async ({ page }) => {
    await open(page);
    await tabTo(page, (a) => a.text === 'Log');
    await page.keyboard.press('Enter');
    await tabTo(page, (a) => a.text === 'Manage categories');
    await page.keyboard.press('Enter');
    await page.locator('.sheet--wide .sheet__card').waitFor();

    await tabTo(page, (a) => a.text === '+ New');
    await page.keyboard.press('Enter');
    await expect(page.locator('.sheet--stacked .sheet__card')).toBeVisible();
    // The name field of the new sheet, not something left over from Manage.
    expect((await active(page)).cls).toContain('fld--name');

    // One Escape closes only the stacked sheet; Manage is still standing.
    await page.keyboard.press('Escape');
    await expect(page.locator('.sheet--stacked')).toHaveCount(0);
    await expect(page.locator('.sheet--wide .sheet__card')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.locator('.sheet__card')).toHaveCount(0);
  });

test('the goal sheet and its inline category create are keyboard-complete',
  async ({ page }) => {
    await open(page);
    await tabTo(page, (a) => a.text === 'Goals');
    await page.keyboard.press('Enter');
    await page.locator('.goaltable').waitFor();

    await tabTo(page, (a) => a.text === '+ New goal');
    await page.keyboard.press('Enter');
    await page.locator('.sheet__card').waitFor();
    // Decision 23: the required name leads and takes the caret.
    expect((await active(page)).cls).toContain('fld--goalname');

    await page.keyboard.type('Wine tasting');
    await tabTo(page, (a) => a.text === '+ New category', 8);
    await page.keyboard.press('Enter');
    await expect(page.locator('.sheet--stacked .sheet__card')).toBeVisible();

    await page.keyboard.type('Wine');
    await tabTo(page, (a) => a.text === 'Add category', 20);
    await page.keyboard.press('Enter');

    // Back on the goal sheet with the draft intact and the picker filled.
    await expect(page.locator('.sheet--stacked')).toHaveCount(0);
    await expect(page.locator('.fld--goalname')).toHaveValue('Wine tasting');
    await expect(page.locator('.select--sheet select').locator('option:checked'))
      .toHaveText('Wine');
    // Decision-log 169: focus lands on the picker whose value just changed.
    expect((await active(page)).cls).toContain('select__input');

    await page.keyboard.press('Escape');
    await expect(page.locator('.sheet__card')).toHaveCount(0);
  });

/* ---------- Where it went ---------- */

test('the range and the chart are both reachable by key', async ({ page }) => {
  await open(page);
  await page.locator('main.screen[data-s="went"]').waitFor();

  // A typed date lands the range.
  await tabTo(page, (a) => a.id === 'rangeStart');
  expect((await active(page)).ring).toBe(true);
  await page.keyboard.press('Control+a');
  await page.keyboard.type('1/6');
  await page.keyboard.press('Enter');
  await expect(page.locator('#rangeStart')).toHaveValue('1 Jun 2026');

  /* The presets are stops of their own. Enter blurred the date field, so this
     tabs from the top of the document again — past the header, the armed undo
     and the start field — hence the wider limit. */
  await tabTo(page, (a) => a.text === '90D', 40);
  await page.keyboard.press('Enter');
  /* Decision-log 119: the lit preset is whatever the range now IS, compared
     exactly. On the fourteen-day demo a 90D click clamps to the whole history,
     so ALL is what lights — pressing 90D and seeing 90D lit would mean the
     clamp had stopped working. */
  await expect(page.locator('.preset[data-preset="all"]')).toHaveAttribute('data-active', '1');
  await expect(page.locator('.preset[data-active="1"]')).toHaveCount(1);

  /* The chart bands: one tab stop each, toggled with Enter, and the focused
     one shades the calendar (decision-log 144 puts the ring on the bar and the
     name rather than round the group, so `ring` is not the check here). */
  await tabTo(page, (a) => a.cls.includes('ribbon__band'), 40);
  await page.keyboard.press('Enter');
  await expect(page.locator('.ribbon__band--on')).toHaveCount(1);
  await page.keyboard.press('Enter');
  await expect(page.locator('.ribbon__band--on')).toHaveCount(0);
});

test('Escape aborts a pick started from the keyboard-driven screen', async ({ page }) => {
  await open(page);
  await page.locator('main.screen[data-s="went"]').waitFor();
  const before = await page.locator('#rangeEnd').inputValue();

  // The calendar cells are deliberately out of the tab order (decision-log
  // 130: a year of days is not a keyboard path), so the pick is started with a
  // click and aborted with the key — the combination a real user hits.
  await page.locator('.cal__cell[aria-label="1 Jun 2026"]').click();
  await expect(page.locator('.rail__days')).toHaveText('PICK END DAY');
  await page.keyboard.press('Escape');
  await expect(page.locator('.rail__days')).not.toHaveText('PICK END DAY');
  await expect(page.locator('#rangeEnd')).toHaveValue(before);
});

/* ---------- the data path ---------- */

test('the Data sheet opens, reports and closes from the keyboard', async ({ page }) => {
  await open(page);
  await tabTo(page, (a) => a.cls.includes('datactl'));
  expect((await active(page)).ring).toBe(true);
  await page.keyboard.press('Enter');
  await page.locator('.sheet__card').waitFor();

  await page.keyboard.press('Escape');
  await expect(page.locator('.sheet__card')).toHaveCount(0);
  expect((await active(page)).cls).toContain('datactl');
});
