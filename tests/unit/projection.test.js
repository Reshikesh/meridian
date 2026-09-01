'use strict';

const test = require('node:test');
const assert = require('node:assert');
const dates = require('../../src/core/dates.js');
const projection = require('../../src/core/projection.js');

/* Business rule §8.4: straight-line, non-compounding, projected from logged
   hours. The decision this file pins hardest is pace's denominator — whole
   seven-day blocks — because every other reading of it moves a landing date by
   up to twenty days depending on which weekday the app was first opened. */

const NOW = new Date(2026, 5, 7, 12, 0, 0);           // Sunday 7 June 2026, midday
const TODAY = '2026-06-07';

function stateWith(entries, goal) {
  return {
    settings: {},
    categories: [{ id: 'cat_learn', name: 'Learning', direction: 'more' }],
    goals: [Object.assign({
      id: 'goal_py', short_name: 'Learn Python', category_id: 'cat_learn',
      target_amount: 130, target_unit: 'h', by_date: '2026-09-30', archived: false,
    }, goal || {})],
    entries: entries,
  };
}

// `n` entries of `min` minutes, one a day, ending `endOffset` days before today.
function daily(count, min, endOffset) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const key = dates.dayKey(dates.addDays(TODAY, -(endOffset || 0) - i));
    out.push({ id: `e_${i}`, date: key, duration_min: min, category_id: 'cat_learn', goal_id: 'goal_py' });
  }
  return out;
}

test('pace is measured over whole seven-day blocks', async (t) => {
  await t.test('fourteen days of history is two blocks', () => {
    const p = projection.pace(daily(14, 60), TODAY);
    assert.equal(p.blocks, 2);
    assert.equal(p.spanDays, 14);
    assert.equal(p.pace, 7, '14 h over two whole weeks');
    assert.equal(p.windowStart, '2026-05-25');
  });

  await t.test('a partial third week is left out of the denominator', () => {
    // 17 days of history: two whole weeks, and three days that do not make one.
    const p = projection.pace(daily(17, 60), TODAY);
    assert.equal(p.blocks, 2);
    assert.equal(p.pace, 7, 'the three extra days must not divide 17 h by two');
  });

  await t.test('less than a week still reports a rate, over one block', () => {
    const p = projection.pace(daily(3, 60), TODAY);
    assert.equal(p.blocks, 1);
    assert.equal(p.pace, 3);
  });

  await t.test('no history at all is a zero pace, not a division by zero', () => {
    const p = projection.pace([], TODAY);
    assert.equal(p.pace, 0);
    assert.equal(p.blocks, 0);
    assert.equal(p.windowStart, null);
  });

  await t.test('the same window serves categories, so the two never disagree', () => {
    const entries = daily(14, 60);
    const byGoal = projection.goalPace(entries, 'goal_py', TODAY);
    const byCat = projection.categoryPace(entries, 'cat_learn', TODAY);
    assert.deepEqual(byGoal, byCat);
  });
});

test('the projection is straight-line from banked and pace', async (t) => {
  await t.test('the seed’s Learn Python lands 26 days late', () => {
    // 12 h banked over two weeks; 118 h left at 6 h a week is 137.7 days,
    // against a 112-day deadline.
    const entries = [];
    for (let w = 0; w < 2; w++) {
      for (let d = 0; d < 6; d++) {
        entries.push({
          id: `e_${w}_${d}`, date: dates.dayKey(dates.addDays(TODAY, -(w * 7 + d))),
          duration_min: 60, category_id: 'cat_learn', goal_id: 'goal_py',
        });
      }
    }
    const state = stateWith(entries, { by_date: dates.dayKey(dates.addDays(TODAY, 112)) });
    const p = projection.project(state, 'goal_py', NOW);

    assert.equal(p.banked, 12);
    assert.equal(p.pace, 6);
    assert.equal(p.required, 7.38);
    assert.equal(p.landingDays, 138);
    assert.equal(p.slippageDays, 26);
    assert.equal(p.progressPct, 9);
    assert.equal(p.enoughHistory, true);
  });

  await t.test('a landing date is a whole day, rounded up', () => {
    const state = stateWith(daily(14, 60), { target_amount: 21, by_date: '2026-07-31' });
    const p = projection.project(state, 'goal_py', NOW);
    assert.equal(p.banked, 14);
    assert.equal(p.pace, 7);
    assert.equal(p.landingDays, 7, '7 h left at 7 h a week is exactly one week');
    assert.equal(dates.dayKey(p.landing), '2026-06-14');
  });
});

test('"not enough history" is counted per goal, not per dataset', async (t) => {
  await t.test('six logged days is not enough', () => {
    const p = projection.project(stateWith(daily(6, 60)), 'goal_py', NOW);
    assert.equal(p.loggedDays, 6);
    assert.equal(p.enoughHistory, false);
    assert.equal(p.landing, null, 'no date is offered from too little history');
    assert.equal(p.pace, 0);
  });

  await t.test('seven is', () => {
    const p = projection.project(stateWith(daily(7, 60)), 'goal_py', NOW);
    assert.equal(p.enoughHistory, true);
    assert.ok(p.landing);
  });

  await t.test('a busy dataset does not lend its history to a fresh goal', () => {
    const state = stateWith(daily(30, 60));
    state.goals.push({
      id: 'goal_new', short_name: 'New', category_id: 'cat_learn',
      target_amount: 50, target_unit: 'h', by_date: '2026-12-31', archived: false,
    });
    state.entries.push({
      id: 'e_new', date: TODAY, duration_min: 60, category_id: 'cat_learn', goal_id: 'goal_new',
    });
    const p = projection.project(state, 'goal_new', NOW);
    assert.equal(p.loggedDays, 1);
    assert.equal(p.enoughHistory, false, '30 days of OTHER history proves nothing about this goal');
  });
});

test('the edge cases are decided here, not left to each caller', async (t) => {
  await t.test('zero pace gives no landing date, never Infinity', () => {
    // The only way to reach a zero pace is too little history: the pace window
    // is the last k whole weeks of a span that starts at the first entry, so at
    // most six days of history can ever fall outside it — never seven.
    const p = projection.project(stateWith(daily(3, 60, 400)), 'goal_py', NOW);
    assert.equal(p.enoughHistory, false);
    assert.equal(p.pace, 0);
    assert.equal(p.landing, null);
    assert.equal(p.slippageDays, null);
    assert.ok(Number.isFinite(p.required), 'a required rate does not need history');
  });

  await t.test('a goal already reached is done, and the number is not clamped', () => {
    const state = stateWith(daily(14, 600), { target_amount: 130 });
    const p = projection.project(state, 'goal_py', NOW);
    assert.equal(p.done, true);
    assert.equal(p.remaining, 0);
    assert.equal(p.landing, null);
    assert.equal(p.slippageDays, 0);
    assert.equal(p.required, null);
    assert.ok(p.progressPct > 100, 'the bar clamps in CSS; the figure stays honest');
  });

  await t.test('a date that has already passed gives no required rate', () => {
    const state = stateWith(daily(14, 60), { by_date: '2026-05-01' });
    const p = projection.project(state, 'goal_py', NOW);
    assert.equal(p.required, null, 'never print a negative hours-per-week');
    assert.equal(p.daysLeft, -37);
    assert.equal(p.landingDays, 116, '116 h left at 7 h a week — not 117, whatever the float says');
    assert.equal(p.slippageDays, 153, 'slippage is still computable, and large');
  });

  await t.test('a date of today gives no required rate either', () => {
    const state = stateWith(daily(14, 60), { by_date: TODAY });
    const p = projection.project(state, 'goal_py', NOW);
    assert.equal(p.required, null, 'do not divide by nought weeks left');
  });

  await t.test('an unknown goal returns null rather than throwing', () => {
    assert.equal(projection.project(stateWith([]), 'goal_nope', NOW), null);
  });
});

test('weeks running counts consecutive ISO weeks for one goal', async (t) => {
  const week = (weeksAgo) => ({
    id: `e_${weeksAgo}`,
    date: dates.dayKey(dates.addDays(dates.weekStart(TODAY), -7 * weeksAgo + 1)),
    duration_min: 60, category_id: 'cat_learn', goal_id: 'goal_py',
  });

  await t.test('an unbroken run counts every week', () => {
    const entries = [week(0), week(1), week(2)];
    assert.equal(projection.weeksRunning(entries, 'goal_py', TODAY), 3);
  });

  await t.test('it stops at the first empty week', () => {
    const entries = [week(0), week(1), week(3)];
    assert.equal(projection.weeksRunning(entries, 'goal_py', TODAY), 2);
  });

  await t.test('a Monday morning with nothing logged yet does not reset the streak', () => {
    // No entry in the current week; the count starts at the week before rather
    // than collapsing to zero and reappearing after the first entry of the day.
    const entries = [week(1), week(2)];
    assert.equal(projection.weeksRunning(entries, 'goal_py', TODAY), 2);
  });

  await t.test('a goal with nothing logged is not running', () => {
    assert.equal(projection.weeksRunning([], 'goal_py', TODAY), 0);
  });
});

test('the entry sheet preview recomputes pace as well as the bank', async (t) => {
  const base = stateWith(daily(14, 60), { by_date: dates.dayKey(dates.addDays(TODAY, 112)) });

  await t.test('adding two hours moves both the bank and the landing date', () => {
    const before = projection.project(base, 'goal_py', NOW);
    const after = projection.projectWithDelta(base, 'goal_py', 120, NOW);
    assert.equal(before.banked, 14);
    assert.equal(after.banked, 16);
    assert.ok(after.landingDays < before.landingDays,
      'the caption is "projected from logged hours" — an hour logged today is history too');
  });

  await t.test('the preview never writes anything', () => {
    const count = base.entries.length;
    projection.projectWithDelta(base, 'goal_py', 120, NOW);
    assert.equal(base.entries.length, count);
  });
});

test('the analysis range is clamped to [first data day, today] (rule §8.15)', async (t) => {
  const state = stateWith(daily(14, 60));

  await t.test('a future end is pulled back to today', () => {
    const r = projection.clampRange(state, { start: '2026-06-01', end: '2026-12-31' }, NOW);
    assert.deepEqual(r, { start: '2026-06-01', end: TODAY });
  });

  await t.test('a start before the first entry is pulled forward', () => {
    const r = projection.clampRange(state, { start: '2020-01-01', end: TODAY }, NOW);
    assert.equal(r.start, '2026-05-25');
  });

  await t.test('a backwards range is swapped, not rejected', () => {
    const r = projection.clampRange(state, { start: TODAY, end: '2026-05-25' }, NOW);
    assert.deepEqual(r, { start: '2026-05-25', end: TODAY });
  });

  await t.test('an empty dataset clamps to today alone', () => {
    const r = projection.clampRange({ entries: [] }, null, NOW);
    assert.deepEqual(r, { start: TODAY, end: TODAY });
  });
});
