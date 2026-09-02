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

const { DATA_KEY, demoState } = require('./seed-state');
const { gappedState } = require('./datasets');

function transientStates(page) {
  const esc = async () => page.keyboard.press('Escape');
  const openLog = async () => page.click('[data-nav="log"]');
  const openManage = async () => { await openLog(); await page.click('.btn--quiet'); };
  const openWent = async () => {
    await page.click('[data-nav="went"]');
    await page.locator('main.screen[data-s="went"]').waitFor();
  };
  const day = (label) => page.locator(`.cal__cell[aria-label="${label}"]`);

  // Swap the dataset under the page and come back to Where it went. The
  // init script only writes the demo when the key is absent, so what is
  // written here survives the reload.
  const loadState = async (state) => {
    await page.evaluate(([k, json]) => localStorage.setItem(k, json), [DATA_KEY, JSON.stringify(state)]);
    await page.reload();
    await openWent();
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
  ];
}

module.exports = { transientStates };
