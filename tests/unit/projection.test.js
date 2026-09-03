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

test('history is counted per goal, not per dataset, and settles at seven days', async (t) => {
  await t.test('six logged days is an early estimate, not a settled pace', () => {
    const p = projection.project(stateWith(daily(6, 60)), 'goal_py', NOW);
    assert.equal(p.loggedDays, 6);
    assert.equal(p.enoughHistory, true);
    assert.equal(p.mode, 'early');
    assert.equal(p.early, true);
    assert.equal(p.settled, false);
    assert.ok(p.landing, 'decision 27: a date from the second logged day on');
  });

  await t.test('seven is settled, and the label goes', () => {
    const p = projection.project(stateWith(daily(7, 60)), 'goal_py', NOW);
    assert.equal(p.mode, 'settled');
    assert.equal(p.early, false);
    assert.equal(projection.earlyLabel(p), null);
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
    assert.equal(p.mode, 'none');
    assert.equal(p.enoughHistory, false, '30 days of OTHER history proves nothing about this goal');
    assert.equal(p.landing, null);
  });
});

/* ---------- decision 27: the early estimate ---------- */

test('the early estimate runs from the second logged day to the sixth', async (t) => {
  await t.test('one logged day is nothing: a rate needs a duration', () => {
    const p = projection.project(stateWith(daily(1, 120)), 'goal_py', NOW);
    assert.equal(p.mode, 'none');
    assert.equal(p.pace, 0);
    assert.equal(p.landing, null);
    assert.equal(p.slippageDays, null);
    assert.equal(projection.earlyLabel(p), null);
  });

  await t.test('two logged days is hours so far over calendar days so far, times seven', () => {
    // 2 h on each of the last two days: 4 h over 2 days is 14 h a week.
    const p = projection.project(stateWith(daily(2, 120)), 'goal_py', NOW);
    assert.equal(p.mode, 'early');
    assert.equal(p.loggedDays, 2);
    assert.equal(p.paceDays, 2);
    assert.equal(p.pace, 14);
    assert.equal(p.banked, 4);
    // 126 h left at 14 h a week is nine weeks.
    assert.equal(p.landingDays, 63);
    assert.equal(dates.dayKey(p.landing), '2026-08-09');
    assert.equal(projection.earlyLabel(p), 'early estimate — 2 days');
  });

  await t.test('the denominator is calendar days, so a gap slows the estimate', () => {
    // 2 h today and 2 h six days ago: 4 h over seven calendar days.
    const entries = [
      { id: 'a', date: TODAY, duration_min: 120, category_id: 'cat_learn', goal_id: 'goal_py' },
      { id: 'b', date: '2026-06-01', duration_min: 120, category_id: 'cat_learn', goal_id: 'goal_py' },
    ];
    const p = projection.project(stateWith(entries), 'goal_py', NOW);
    assert.equal(p.loggedDays, 2);
    assert.equal(p.paceDays, 7);
    assert.equal(p.pace, 4);
    assert.equal(projection.earlyLabel(p), 'early estimate — 2 days',
      'the label counts logged days, which is what the gate counts');
  });

  await t.test('the label counts up to six and is gone at seven', () => {
    for (let n = 2; n <= 6; n++) {
      const p = projection.project(stateWith(daily(n, 60)), 'goal_py', NOW);
      assert.equal(projection.earlyLabel(p), `early estimate — ${n} days`);
    }
    assert.equal(projection.earlyLabel(projection.project(stateWith(daily(7, 60)), 'goal_py', NOW)), null);
  });

  await t.test('an early estimate already past its date is slipping, like any other', () => {
    const state = stateWith(daily(2, 60), { by_date: dates.dayKey(dates.addDays(TODAY, 7)) });
    const p = projection.project(state, 'goal_py', NOW);
    assert.ok(p.slippageDays > 0);
    assert.deepEqual(projection.goalCounts(state, NOW), { open: 1, slipping: 1, archived: 0 });
  });

  await t.test('a goal reached inside its first week projects nothing', () => {
    const p = projection.project(stateWith(daily(3, 600), { target_amount: 20 }), 'goal_py', NOW);
    assert.equal(p.done, true);
    assert.equal(p.early, true, 'the pace is still an early one');
    assert.equal(p.landing, null);
  });

  await t.test('the preview, the goal sheet and the table read the same call', () => {
    const state = stateWith(daily(3, 60));
    const row = projection.goalRows(state, NOW)[0];
    const before = projection.project(state, 'goal_py', NOW);
    const after = projection.projectWithDelta(state, 'goal_py', 60, NOW);
    assert.equal(row.mode, 'early');
    assert.equal(dates.dayKey(row.landing), dates.dayKey(before.landing));
    assert.equal(after.early, true);
    assert.equal(projection.earlyLabel(after), 'early estimate — 3 days',
      'an hour added today is a fourth entry, not a fourth day');
  });

  await t.test('the reachability panel takes the same rule on the category', () => {
    const state = stateWith(daily(3, 60), { id: 'goal_other' });
    const r = projection.reachability(state,
      { category_id: 'cat_learn', target_amount: 130, by_date: '2026-09-30' }, NOW);
    assert.equal(r.hasHistory, true);
    assert.equal(r.mode, 'early');
    assert.equal(r.loggedDays, 3);
    assert.equal(r.pace, 7, '3 h over 3 days is 7 h a week');
    assert.ok(r.landing);
    assert.equal(projection.earlyLabel(r), 'early estimate — 3 days');
  });
});

/* ---------- decision 27: the chart's series ---------- */

test('series is the banked line from the first entry to today, and the projection on', async (t) => {
  await t.test('cumulative hours, one point per logged day, from zero the day before', () => {
    const s = projection.series(stateWith(daily(3, 60)), 'goal_py', NOW);
    assert.deepEqual(s.points, [
      { day: '2026-06-04', hours: 0 },
      { day: '2026-06-05', hours: 1 },
      { day: '2026-06-06', hours: 2 },
      { day: '2026-06-07', hours: 3 },
    ]);
    assert.equal(s.projection.from.day, TODAY);
    assert.equal(s.projection.from.hours, 3);
    assert.equal(s.projection.to.hours, 130);
    assert.equal(s.projection.to.day, s.landing);
    assert.equal(s.byDate, '2026-09-30');
    assert.equal(s.early, true);
  });

  await t.test('the line reaches today even when nothing was logged since', () => {
    const s = projection.series(stateWith(daily(3, 60, 4)), 'goal_py', NOW);
    const last = s.points[s.points.length - 1];
    assert.equal(last.day, TODAY);
    assert.equal(last.hours, 3, 'flat to today, not a claim of new hours');
  });

  await t.test('one logged day draws a line and no projection', () => {
    const s = projection.series(stateWith(daily(1, 90)), 'goal_py', NOW);
    assert.equal(s.points.length, 2);
    assert.equal(s.projection, null);
    assert.equal(s.landing, null);
  });

  await t.test('a reached goal keeps its history and projects nothing', () => {
    const s = projection.series(stateWith(daily(14, 600), { target_amount: 100 }), 'goal_py', NOW);
    assert.equal(s.done, true);
    assert.equal(s.projection, null);
    assert.equal(s.points[s.points.length - 1].hours, 140);
  });

  await t.test('a date already passed still marks the target and is late', () => {
    const s = projection.series(stateWith(daily(14, 60), { by_date: '2026-05-01' }), 'goal_py', NOW);
    assert.equal(s.byDate, '2026-05-01');
    assert.equal(s.late, true);
    assert.ok(s.projection);
  });

  await t.test('zero pace is a line with nothing after it', () => {
    const s = projection.series(stateWith([]), 'goal_py', NOW);
    assert.deepEqual(s.points, []);
    assert.equal(s.projection, null);
  });

  await t.test('an unknown goal is null', () => {
    assert.equal(projection.series(stateWith([]), 'goal_nope', NOW), null);
  });
});

test('the edge cases are decided here, not left to each caller', async (t) => {
  await t.test('zero pace gives no landing date, never Infinity', () => {
    // The only way to reach a zero pace is too little history: with one
    // logged day there is no rate, and from two on the early estimate spans
    // every entry, so the pace is positive whenever the hours are.
    const p = projection.project(stateWith(daily(1, 60, 400)), 'goal_py', NOW);
    assert.equal(p.enoughHistory, false);
    assert.equal(p.pace, 0);
    assert.equal(p.landing, null);
    assert.equal(p.slippageDays, null);
    assert.ok(Number.isFinite(p.required), 'a required rate does not need history');
  });

  await t.test('old sparse history is an early estimate stretched thin, not a blank', () => {
    // Three hours logged four hundred days ago: 3 h over 403 days.
    const p = projection.project(stateWith(daily(3, 60, 400)), 'goal_py', NOW);
    assert.equal(p.mode, 'early');
    assert.equal(p.pace, 0.05);
    assert.ok(p.landing, 'a date, years out, with the label on it');
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

/* ---------- the Goals screen (spec §4h, §6, §12) ---------- */

test('goalRows is one projection per goal, live first and archived after', async (t) => {
  function two() {
    const state = stateWith(daily(14, 60));
    state.goals.push({
      id: 'goal_run', short_name: 'Half-marathon training', category_id: 'cat_learn',
      target_amount: 60, target_unit: 'h', by_date: '2026-10-31', archived: false,
    });
    return state;
  }

  await t.test('every goal gets a row, carrying the category that feeds it', () => {
    const rows = projection.goalRows(two(), NOW);
    assert.deepEqual(rows.map((r) => r.goal.id), ['goal_py', 'goal_run']);
    assert.equal(rows[0].category.name, 'Learning');
    assert.equal(rows[0].banked, 14);
    assert.equal(rows[1].banked, 0, 'nothing is logged to the second goal');
  });

  await t.test('an archived goal keeps its row, at the end', () => {
    const state = two();
    state.goals[0].archived = true;
    const rows = projection.goalRows(state, NOW);
    assert.deepEqual(rows.map((r) => r.goal.id), ['goal_run', 'goal_py']);
    assert.equal(rows[1].banked, 14, 'archiving keeps every hour (rule §8.10)');
  });

  await t.test('no goals is no rows, not a throw', () => {
    assert.deepEqual(projection.goalRows({ goals: [], entries: [] }, NOW), []);
  });
});

test('goalCounts drives the headline (spec §6)', async (t) => {
  await t.test('a goal landing past its date is slipping', () => {
    // 14 h banked at 7 h a week, 116 left, against a date three weeks out.
    const state = stateWith(daily(14, 60), { by_date: dates.dayKey(dates.addDays(TODAY, 21)) });
    assert.deepEqual(projection.goalCounts(state, NOW), { open: 1, slipping: 1, archived: 0 });
  });

  await t.test('a goal landing before its date is not', () => {
    const state = stateWith(daily(14, 60), { target_amount: 21, by_date: '2026-07-31' });
    assert.deepEqual(projection.goalCounts(state, NOW), { open: 1, slipping: 0, archived: 0 });
  });

  await t.test('too little history to project counts as open and nothing more', () => {
    const state = stateWith(daily(1, 60), { by_date: dates.dayKey(dates.addDays(TODAY, 1)) });
    assert.deepEqual(projection.goalCounts(state, NOW), { open: 1, slipping: 0, archived: 0 });
  });

  await t.test('archived goals are counted apart, and never slip', () => {
    const state = stateWith(daily(14, 60), { archived: true });
    assert.deepEqual(projection.goalCounts(state, NOW), { open: 0, slipping: 0, archived: 1 });
  });

  await t.test('an empty dataset is three zeroes', () => {
    assert.deepEqual(projection.goalCounts({ goals: [], entries: [] }, NOW),
      { open: 0, slipping: 0, archived: 0 });
  });
});

test('reachability answers the New goal sheet from the feeding category', async (t) => {
  const draft = { category_id: 'cat_learn', target_amount: 130, by_date: '2026-09-30' };

  await t.test('the pace quoted is the category’s, not the goal’s', () => {
    /* The entries below are logged to a DIFFERENT goal in the same category.
       A goal being created has no history of its own, so the sentence "You've
       given Learning 7.0 h a week" can only mean the category. */
    const state = stateWith(daily(14, 60), { id: 'goal_other' });
    const r = projection.reachability(state, draft, NOW);
    assert.equal(r.hasHistory, true);
    assert.equal(r.pace, 7);
    assert.equal(r.paceBlocks, 2);
    assert.equal(r.banked, 0, 'a goal that does not exist yet has banked nothing');
    assert.equal(r.required, 7.91, '130 h over the 115 days to 30 September');
    assert.equal(dates.dayKey(r.landing), '2026-10-15');
  });

  await t.test('with fewer than two logged days there is no pace to quote', () => {
    const state = stateWith(daily(1, 60), { id: 'goal_other' });
    const r = projection.reachability(state, draft, NOW);
    assert.equal(r.hasHistory, false);
    assert.equal(r.loggedDays, 1);
    assert.equal(r.pace, 0);
    assert.equal(r.landing, null, 'never a date from a pace that is not there');
    assert.equal(r.required, 7.91, 'what the date asks for is still knowable');
  });

  await t.test('editing an existing goal counts what it has already banked', () => {
    const state = stateWith(daily(14, 60));
    const r = projection.reachability(state, Object.assign({ id: 'goal_py' }, draft), NOW);
    assert.equal(r.banked, 14);
    assert.equal(r.remaining, 116);
    assert.equal(r.required, 7.06, 'the remainder over the weeks left, not the whole target');
  });

  await t.test('a target already banked asks for nothing more', () => {
    const state = stateWith(daily(14, 60));
    const r = projection.reachability(state,
      { id: 'goal_py', category_id: 'cat_learn', target_amount: 10, by_date: '2026-09-30' }, NOW);
    assert.equal(r.done, true);
    assert.equal(r.remaining, 0);
    assert.equal(r.required, null);
    assert.equal(r.landing, null);
  });

  await t.test('a date already gone gives no required rate', () => {
    const state = stateWith(daily(14, 60), { id: 'goal_other' });
    const r = projection.reachability(state,
      Object.assign({}, draft, { by_date: '2026-01-01' }), NOW);
    assert.equal(r.daysLeft < 0, true);
    assert.equal(r.required, null, 'never a negative rate per week');
    assert.ok(r.landing, 'the pace still lands somewhere');
  });

  await t.test('an unreadable date is simply an unknown one', () => {
    const state = stateWith(daily(14, 60), { id: 'goal_other' });
    const r = projection.reachability(state,
      Object.assign({}, draft, { by_date: 'nonsense' }), NOW);
    assert.equal(r.byDate, null);
    assert.equal(r.required, null);
  });

  await t.test('no category picked yet is answerable without throwing', () => {
    const state = stateWith(daily(14, 60), { id: 'goal_other' });
    const r = projection.reachability(state, { category_id: null, target_amount: '', by_date: '' }, NOW);
    assert.equal(r.category, null);
    assert.equal(r.hasHistory, false);
    assert.equal(r.pace, 0);
    assert.equal(r.required, null);
  });
});
