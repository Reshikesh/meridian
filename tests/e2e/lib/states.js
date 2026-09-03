// Every state that only exists after a click, for the responsive matrices.
//
// QUALITY-BAR §2 says "every screen AND sheet open". The Phase 2 defect the
// owner found lived in the gap between "audited every screen" and "audited
// every state" (decision-log #111), so every sheet, row menu, inline confirm,
// row editor — and, from Phase 3, every transient state of Where it went — is
// opened here, one after another, at every width, theme and zoom.
//
// Shared by responsive.spec.js (the width axis) and zoom.spec.js (the zoom
// axis) so the two can never drift apart.

const { DATA_KEY, demoState, emptyState } = require('./seed-state');
const { gappedState, stressState, earlyState, progressState, manyLessonsState } = require('./datasets');

function transientStates(page) {
  const esc = async () => page.keyboard.press('Escape');
  const openLog = async () => page.click('[data-nav="log"]');
  const openManage = async () => { await openLog(); await page.click('.btn--quiet'); };
  const openGoals = async () => {
    await page.click('[data-nav="goals"]');
    await page.locator('main.screen[data-s="goals"] .goaltable').waitFor();
  };
  const openWent = async () => {
    await page.click('[data-nav="went"]');
    await page.locator('main.screen[data-s="went"]').waitFor();
  };
  const day = (label) => page.locator(`.cal__cell[aria-label="${label}"]`);
  const openProgress = async () => {
    await page.click('[data-nav="progress"]');
    await page.locator('main.screen[data-s="progress"]').waitFor();
  };
  const openLessons = async () => {
    await page.click('[data-nav="lessons"]');
    await page.locator('main.screen[data-s="lessons"]').waitFor();
  };

  // Swap the dataset under the page and come back to Where it went.
  //
  // Written from an init script, not from the live page: a setItem in the
  // old document followed by an immediate reload lost the write under load
  // three times in the matrices (the reload came up on the demo). An init
  // script runs inside the new document, before the app's own scripts, so
  // the store's synchronous read sees exactly what was written. Init scripts
  // accumulate and run in registration order, so the last dataset asked for
  // is the one that wins; the seed's own script only writes when the key is
  // absent, so it never gets in the way.
  const loadState = async (state) => {
    const json = JSON.stringify(state);
    await page.addInitScript(([k, v]) => {
      try { localStorage.setItem(k, v); } catch (e) { /* private mode */ }
    }, [DATA_KEY, json]);
    await page.reload();
    await openWent();
    const loaded = await page.evaluate(() => window.Meridian.store.getState().entries.length);
    if (loaded !== state.entries.length) {
      throw new Error(`loadState: the store holds ${loaded} entries, expected ${state.entries.length}`);
    }
  };

  return [
    {
      id: 'sheet-data',
      open: () => page.click('[data-data-open]'),
      ready: '.sheet__card',
      close: esc,
    },
    {
      id: 'sheet-entry',
      open: async () => {
        await openLog();
        await page.click('.quickadd__open');
        // The tallest state of the sheet: a goal picked, so the category
        // is locked and the projection panel is on screen.
        await page.locator('.seg').first().getByText('2 h', { exact: true }).click();
        await page.locator('.seg').nth(1).getByText('Learn Python').click();
      },
      ready: '.sheet__card',
      close: esc,
    },
    {
      id: 'sheet-manage',
      open: openManage,
      ready: '.sheet--wide .sheet__card',
      close: esc,
    },
    {
      id: 'sheet-manage-editing',
      open: async () => {
        await openManage();
        await page.locator('.manage__rowwrap').first()
          .getByRole('button', { name: 'edit' }).click();
      },
      ready: '.manage__editor',
      close: esc,
    },
    {
      id: 'sheet-manage-confirm',
      open: async () => {
        await openManage();
        await page.locator('.manage__rowwrap').first()
          .getByRole('button', { name: 'archive' }).click();
      },
      ready: '.confirm--row',
      close: esc,
    },
    {
      id: 'sheet-category',
      open: async () => {
        await openManage();
        await page.click('.sheet__tools .btn--brand');
      },
      ready: '.sheet--stacked .sheet__card',
      // Two sheets deep, so two Escapes.
      close: async () => { await esc(); await esc(); },
    },
    {
      id: 'rowmenu-last',
      open: async () => {
        await openLog();
        await page.locator('.logrow--entry').last().locator('.rowmenu__btn').click();
      },
      ready: '.rowmenu__panel',
      close: esc,
    },
    {
      id: 'rowmenu-confirm',
      open: async () => {
        await openLog();
        await page.locator('.logrow--entry').last().locator('.rowmenu__btn').click();
        await page.click('.rowmenu__item--warn');
      },
      ready: '.confirm--menu',
      close: esc,
    },

    // ---------- Where it went (Phase 3) ----------
    {
      // PICK END DAY: one day chosen, the status changed, chips on one cell.
      id: 'went-pending',
      open: async () => { await openWent(); await day('1 Jun 2026').click(); },
      ready: '.rail__days:has-text("PICK END DAY")',
      // Escape aborts the pick (spec Appendix B, item 6).
      close: esc,
    },
    {
      // The day numerals on the hovered row and its neighbours.
      id: 'went-hover',
      open: async () => { await openWent(); await day('1 Jun 2026').hover(); },
      ready: '.cal__num',
      close: async () => { await page.mouse.move(0, 0); },
    },
    {
      // A landed range change: ↩ UNDO in place of the day count, for 6 s.
      // The audit runs inside those seconds; closing restores the range.
      id: 'went-undo',
      open: async () => {
        await openWent();
        await day('1 Jun 2026').click();
        await day('4 Jun 2026').click();
      },
      ready: '.rail__undo',
      close: async () => { await page.click('.rail__undo'); },
    },
    {
      // A focused band: the others dimmed, the calendar heat on.
      id: 'went-focus',
      open: async () => {
        await openWent();
        await page.locator('.ribbon__band[data-node="cat:cat_learn"]').click();
      },
      ready: '.ribbon__band--on',
      close: async () => { await page.locator('.ribbon__band--on').click(); },
    },
    {
      // A band reached by keyboard: the focus ring on its bar and name.
      id: 'went-bandfocus',
      open: async () => {
        await openWent();
        await page.locator('.seg--small').nth(1).locator('[data-active="1"]').focus();
        await page.keyboard.press('Tab');
      },
      ready: '.ribbon__band:focus-visible',
      close: async () => { await page.evaluate(() => document.activeElement.blur()); },
    },
    {
      // The goal split, with its sub-lines and the "No goal" band.
      id: 'went-goal',
      open: async () => {
        await openWent();
        await page.locator('.seg--small').first().getByText('Goal', { exact: true }).click();
      },
      ready: '.ribbon__band[data-node="goal:none"]',
      close: async () => {
        await page.locator('.seg--small').first().getByText('Category', { exact: true }).click();
      },
    },
    {
      // A focused date input: the ring on that endpoint, the other chip dim.
      id: 'went-input',
      open: async () => { await openWent(); await page.locator('#rangeStart').focus(); },
      ready: '.cal__ring',
      close: esc,
    },
    {
      // A range with nothing in it: the panel's own empty state.
      id: 'went-empty',
      // Each date is checked as it lands, so a failure here names the step
      // rather than a panel that never came.
      open: async () => {
        await loadState(gappedState());
        const start = page.locator('#rangeStart');
        const end = page.locator('#rangeEnd');
        await start.fill('2/6');
        await start.press('Enter');
        await start.waitFor();
        if ((await start.inputValue()) !== '2 Jun 2026') {
          throw new Error(`went-empty: start did not land, reads "${await start.inputValue()}"`);
        }
        await end.fill('4/6');
        await end.press('Enter');
        if ((await end.inputValue()) !== '4 Jun 2026') {
          throw new Error(`went-empty: end did not land, reads "${await end.inputValue()}"`);
        }
      },
      ready: '.went__empty',
      close: async () => { await loadState(demoState()); },
    },

    // ---------- Goals (Phase 4) ----------
    {
      // The New goal sheet at its tallest: everything filled, so IS THAT
      // REACHABLE carries both of its lines rather than the waiting one.
      id: 'sheet-goal',
      open: async () => {
        await openGoals();
        await page.click('[data-goal-new]');
        await page.locator('.sheet__card').waitFor();
        await page.locator('.fld--goalname').fill('Learn Postgres');
        await page.locator('.fld--identity').fill('someone who can build their own tools');
        await page.locator('.select--sheet select').selectOption({ label: 'Learning' });
        await page.locator('.fld--goalnum').first().fill('130');
        await page.locator('.fld--goalnum').last().fill('30 Sep 2026');
      },
      ready: '.reach__tail',
      close: esc,
    },
    {
      // New category stacked over the goal sheet, in its tallest state: a
      // non-More direction, so the rule it breaks is spelled out under the
      // cards. Two sheets deep, so two Escapes.
      id: 'sheet-goal-category',
      open: async () => {
        await openGoals();
        await page.click('[data-goal-new]');
        await page.locator('.sheet__card').waitFor();
        await page.getByRole('button', { name: '+ New category' }).click();
        await page.locator('.sheet--stacked .sheet__card').waitFor();
        await page.locator('.fld--name').fill('Commuting');
        await page.locator('.dir').filter({ hasText: 'Upkeep' }).click();
      },
      ready: '.sheet--stacked [role="status"]',
      close: async () => { await esc(); await esc(); },
    },
    {
      // The same sheet as the editor, prefilled from a goal that exists.
      id: 'sheet-goal-edit',
      open: async () => {
        await openGoals();
        await page.locator('.goalrow__label').first().click();
      },
      ready: '.sheet__card:has-text("EDIT GOAL")',
      close: esc,
    },
    {
      // The row menu on the last goal, and then its archive confirm — the two
      // states that escape the table's own scroller.
      id: 'goals-rowmenu',
      open: async () => {
        await openGoals();
        await page.locator('.goalrow .rowmenu__btn').last().click();
      },
      ready: '.rowmenu__panel',
      close: esc,
    },
    {
      id: 'goals-confirm',
      open: async () => {
        await openGoals();
        await page.locator('.goalrow .rowmenu__btn').last().click();
        await page.getByRole('menuitem', { name: 'Archive' }).click();
      },
      ready: '.confirm--menu',
      close: esc,
    },
    {
      // An archived goal's muted row, under the ghost row.
      id: 'goals-archived',
      open: async () => {
        await openGoals();
        await page.locator('.goalrow .rowmenu__btn').last().click();
        await page.getByRole('menuitem', { name: 'Archive' }).click();
        await page.click('.confirm--menu .btn--warn');
      },
      ready: '.goals__archived .goalrow',
      close: async () => {
        await page.locator('.goals__archived').getByRole('button', { name: 'restore' }).click();
        await page.locator('.goals__archived').waitFor({ state: 'detached' });
      },
    },
    {
      // QUALITY-BAR §2's long content, on the grid most likely to break under
      // it: twelve goals with thirty-character names, all landing on one date.
      id: 'goals-long',
      open: async () => {
        await loadState(stressState());
        await openGoals();
      },
      ready: '.goaltable__rows > .goalrow',
      close: async () => { await loadState(demoState()); },
    },
    {
      // No goals at all: the head, the ghost row and the footer, and nothing
      // else (spec §12).
      id: 'goals-empty',
      open: async () => {
        await loadState(emptyState());
        await openGoals();
      },
      ready: '.goalrow--ghost',
      close: async () => { await loadState(demoState()); },
    },

    // ---------- Progress (Phase 6) ----------
    {
      // A goal switched off: its row dimmed, its line gone, the switch unchecked.
      id: 'progress-off',
      open: async () => {
        await openProgress();
        await page.locator('.pgoal__switch').first().click();
        await page.mouse.move(0, 0);
      },
      ready: '.pgoal--off',
      close: async () => { await page.locator('.pgoal--off .pgoal__switch').click(); },
    },
    {
      // A row under the pointer: the other lines dimmed.
      id: 'progress-hover',
      open: async () => { await openProgress(); await page.locator('.pgoal').last().hover(); },
      ready: '.pchart__goal',
      close: async () => { await page.mouse.move(0, 0); },
    },
    {
      // Three goals, one on an early estimate: the label in the list, a third
      // line, and the date bands at their fullest.
      id: 'progress-early',
      open: async () => { await loadState(earlyState()); await openProgress(); },
      ready: '.pgoal__early',
      close: async () => { await loadState(demoState()); },
    },
    {
      // A reached goal, a one-day goal and a dashed second goal on Learning.
      id: 'progress-states',
      open: async () => { await loadState(progressState()); await openProgress(); },
      ready: '.pgoal__lands--good',
      close: async () => { await loadState(demoState()); },
    },
    {
      // QUALITY-BAR §2's twelve goals, on the list and the chart at once.
      id: 'progress-long',
      open: async () => { await loadState(stressState()); await openProgress(); },
      ready: '.pgoal',
      close: async () => { await loadState(demoState()); },
    },
    {
      // No goals: the line and the way to Goals.
      id: 'progress-empty',
      open: async () => { await loadState(emptyState()); await openProgress(); },
      ready: '.progress__none',
      close: async () => { await loadState(demoState()); },
    },

    // ---------- Lessons (Phase 6) ----------
    {
      // The New lesson sheet with everything in it: text, a title, a tag.
      id: 'sheet-lesson',
      open: async () => {
        await openLessons();
        await page.click('[data-lesson-new]');
        await page.locator('.sheet__card').waitFor();
        await page.locator('.fld--lesson').fill('Logging at night is guesswork. Log it when it ends.');
        await page.locator('.fld--goalname').fill('Guesswork');
        await page.locator('.tagpick__btn').first().click();
      },
      ready: '.tagpick__btn[data-active="1"]',
      close: esc,
    },
    {
      // The card menu, and then its delete confirm, on the last card.
      id: 'lessons-menu',
      open: async () => {
        await openLessons();
        await page.locator('.lcard .rowmenu__btn').last().click();
      },
      ready: '.rowmenu__panel',
      close: esc,
    },
    {
      id: 'lessons-confirm',
      open: async () => {
        await openLessons();
        await page.locator('.lcard .rowmenu__btn').last().click();
        await page.getByRole('menuitem', { name: 'Delete' }).click();
      },
      ready: '.confirm--menu',
      close: esc,
    },
    {
      // Forty cards: the trim, the count in the label, the archive switch.
      id: 'lessons-many',
      open: async () => { await loadState(manyLessonsState()); await openLessons(); },
      ready: '.wall--fit .lcard',
      close: async () => { await loadState(demoState()); },
    },
    {
      // A search over the forty: every match, the page scrolling.
      id: 'lessons-search',
      open: async () => {
        await loadState(manyLessonsState());
        await openLessons();
        await page.locator('.lessons__search').fill('python');
      },
      ready: '.wall--free .lcard',
      close: async () => { await loadState(demoState()); },
    },
    {
      // The archive: restore and the delete-for-good menu on each card.
      id: 'lessons-archived',
      open: async () => {
        await loadState(manyLessonsState());
        await openLessons();
        await page.getByRole('button', { name: /View archived/ }).click();
      },
      ready: '.lcard--archived',
      close: async () => { await loadState(demoState()); },
    },
    {
      // Nothing written: the line and the way in.
      id: 'lessons-empty',
      open: async () => { await loadState(emptyState()); await openLessons(); },
      ready: '.lessons__none',
      close: async () => { await loadState(demoState()); },
    },
  ];
}

module.exports = { transientStates };
