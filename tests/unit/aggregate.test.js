'use strict';

const test = require('node:test');
const assert = require('node:assert');
const aggregate = require('../../src/core/aggregate.js');

const SETTINGS = { sleep_hours_per_day: 8, errands_hours_per_week: 15 };

const CATEGORIES = [
  { id: 'cat_work', name: 'Work', direction: 'upkeep', weekly_plan_hours: 45, colour: '#2b7d5d' },
  { id: 'cat_scroll', name: 'Scrolling', direction: 'less', weekly_plan_hours: 14, colour: '#c8291a' },
  { id: 'cat_learn', name: 'Learning', direction: 'more', weekly_plan_hours: 7, colour: '#2b4a7d' },
];

const GOALS = [{ id: 'goal_py', short_name: 'Learn Python', category_id: 'cat_learn' }];

const entry = (date, min, cat, goal) => ({
  id: `e_${date}_${cat}`, date, duration_min: min, category_id: cat, goal_id: goal || null,
});

test('hours round in whole minutes, never through toFixed on a float', async (t) => {
  await t.test('nine minutes is 0.2 h, not 0.1', () => {
    // (9 / 60).toFixed(1) === "0.1". Binary floating point rounds 0.15 down.
    assert.equal(aggregate.formatHours(9), '0.2');
    assert.equal(aggregate.formatHours(21), '0.4');   // (21/60).toFixed(1) === "0.3"
  });

  await t.test('the seed grid is exact', () => {
    assert.equal(aggregate.formatHours(120), '2.0');
    assert.equal(aggregate.formatHours(30), '0.5');
    assert.equal(aggregate.formatHours(5700), '95.0');
    assert.equal(aggregate.formatHours(0), '0.0');
  });

  await t.test('hours and minutes convert both ways', () => {
    assert.equal(aggregate.hours(90), 1.5);
    assert.equal(aggregate.hoursToMinutes(1.5), 90);
    assert.equal(aggregate.hoursToMinutes(0.25), 15);
  });
});

test('waking hours are 24 minus the sleep default, never a hard-coded 16 (decision 17)', async (t) => {
  await t.test('the defaults give 16 a day and 112 a week', () => {
    assert.equal(aggregate.wakingHoursPerDay(SETTINGS), 16);
    assert.equal(aggregate.wakingHoursPerWeek(SETTINGS), 112);
    assert.equal(aggregate.wakingMinutesPerDay(SETTINGS), 960);
  });

  await t.test('a friend who edits the sleep setting moves the denominator', () => {
    assert.equal(aggregate.wakingHoursPerDay({ sleep_hours_per_day: 7 }), 17);
    assert.equal(aggregate.wakingHoursPerWeek({ sleep_hours_per_day: 7 }), 119);
  });

  await t.test('nonsense in the workbook falls back to the default', () => {
    for (const bad of [undefined, null, '', 'eight', -1, 24, 99, NaN]) {
      assert.equal(aggregate.wakingHoursPerDay({ sleep_hours_per_day: bad }), 16, String(bad));
    }
  });

  await t.test('168 is exported for the Plan bar, which names sleep explicitly', () => {
    assert.equal(aggregate.HOURS_PER_WEEK, 168);
    assert.equal(aggregate.HOURS_PER_DAY, 24);
  });
});

test('per-day and per-week totals', async (t) => {
  const entries = [
    entry('2026-06-01', 540, 'cat_work'),
    entry('2026-06-01', 120, 'cat_scroll'),
    entry('2026-06-03', 90, 'cat_learn', 'goal_py'),
    entry('2026-06-07', 60, 'cat_learn', 'goal_py'),
  ];

  await t.test('byDay sums each day', () => {
    assert.deepEqual(Object.assign({}, aggregate.byDay(entries)), {
      '2026-06-01': 660, '2026-06-03': 90, '2026-06-07': 60,
    });
    assert.equal(aggregate.dayMinutes(entries, '2026-06-01'), 660);
    assert.equal(aggregate.dayMinutes(entries, '2026-06-02'), 0);
  });

  await t.test('weekMinutes returns seven Monday-first bars, zeros included', () => {
    const week = aggregate.weekMinutes(entries, '2026-06-04');
    assert.deepEqual(week, [660, 0, 90, 0, 0, 0, 60]);
    assert.equal(week.length, 7, 'the strip always draws seven bars');
  });

  await t.test('distinctDays counts days, not entries', () => {
    assert.equal(aggregate.distinctDays(entries), 3);
    assert.equal(aggregate.firstDay(entries), '2026-06-01');
    assert.equal(aggregate.lastDay(entries), '2026-06-07');
    assert.equal(aggregate.firstDay([]), null);
  });

  await t.test('inRange is inclusive at both ends', () => {
    assert.equal(aggregate.inRange(entries, '2026-06-01', '2026-06-03').length, 3);
    assert.equal(aggregate.inRange(entries, '2026-06-02', '2026-06-06').length, 1);
    assert.equal(aggregate.sumMinutes(aggregate.inRange(entries, '2026-06-01', '2026-06-07')), 810);
  });
});

test('category and goal breakdowns', async (t) => {
  const entries = [
    entry('2026-06-01', 540, 'cat_work'),
    entry('2026-06-02', 120, 'cat_scroll'),
    entry('2026-06-03', 90, 'cat_learn', 'goal_py'),
    entry('2026-06-04', 60, 'cat_learn'),
  ];

  await t.test('categories come back largest first', () => {
    const rows = aggregate.totalsByCategory(entries, CATEGORIES);
    assert.deepEqual(rows.map((r) => r.id), ['cat_work', 'cat_learn', 'cat_scroll']);
    assert.equal(rows[1].minutes, 150);
    assert.equal(rows[1].hours, 2.5);
  });

  await t.test('an archived category keeps its history (rule §8.11)', () => {
    const archived = CATEGORIES.map((c) =>
      (c.id === 'cat_scroll' ? Object.assign({}, c, { archived: true }) : c));
    const rows = aggregate.totalsByCategory(entries, archived);
    const scroll = rows.find((r) => r.id === 'cat_scroll');
    assert.ok(scroll, 'archived categories stay in every historical range');
    assert.equal(scroll.archived, true);
  });

  await t.test('goal totals carry the "No goal" node the ribbon needs (§4c)', () => {
    const rows = aggregate.totalsByGoal(entries, GOALS);
    assert.equal(rows[0].id, null, '"No goal" holds 720 of the 810 minutes');
    assert.equal(rows[0].minutes, 720);
    assert.equal(rows[0].name, 'No goal');
    assert.equal(rows[0].sub, 'across every category');
    assert.equal(rows[1].id, 'goal_py');
    assert.equal(rows[1].minutes, 90);
  });

  await t.test('hours whose category vanished are still counted, not dropped', () => {
    const rows = aggregate.totalsByCategory([entry('2026-06-01', 60, 'cat_gone')], CATEGORIES);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].unknown, true);
    assert.equal(rows[0].minutes, 60);
  });
});

test('the direction split derives upkeep as the residual (spec §4b)', async (t) => {
  const split = (up, down, keep) => aggregate.directionSplit([
    entry('2026-06-01', up, 'cat_learn'),
    entry('2026-06-01', down, 'cat_scroll'),
    entry('2026-06-01', keep, 'cat_work'),
  ], CATEGORIES);

  await t.test('the three percentages always total 100', () => {
    // 1/1/4 of six hours: rounding each part on its own gives 17+17+67 = 101.
    const a = split(60, 60, 240);
    assert.equal(a.upPct + a.downPct + a.keepPct, 100);
    assert.equal(a.keepPct, 66);

    // 10/10/10 of thirty: rounding each part gives 33+33+33 = 99.
    const b = split(600, 600, 600);
    assert.equal(b.upPct + b.downPct + b.keepPct, 100);
    assert.equal(b.keepPct, 34);
  });

  await t.test('the three hour figures always add up to the total', () => {
    // 3.4 / 3.4 / 3.2 of ten hours: rounding each part gives 3+3+3 = 9 h.
    const s = split(204, 204, 192);
    assert.equal(s.upHours + s.downHours + s.keepHours,
      aggregate.hours(600), 'the caption must reconcile with the total');
  });

  await t.test('the seed week reads 24 more, 24 less, 47 upkeep', () => {
    const s = aggregate.directionSplit([
      entry('2026-06-01', 1440, 'cat_learn'),
      entry('2026-06-02', 1440, 'cat_scroll'),
      entry('2026-06-03', 2820, 'cat_work'),
    ], CATEGORIES);
    assert.equal(s.upHours, 24);
    assert.equal(s.downHours, 24);
    assert.equal(s.keepHours, 47);
    assert.equal(s.upPct + s.downPct + s.keepPct, 100);
  });

  await t.test('an empty range divides by nothing and stays at zero', () => {
    const s = aggregate.directionSplit([], CATEGORIES);
    assert.deepEqual(
      [s.upPct, s.downPct, s.keepPct, s.upHours, s.downHours, s.keepHours],
      [0, 0, 0, 0, 0, 0]);
    assert.equal(s.upWidth, '0.000%');
  });

  await t.test('widths are the mockup three-decimal percentages', () => {
    const s = split(60, 60, 240);
    assert.equal(s.upWidth, '16.667%');
    assert.equal(s.keepWidth, '66.667%');
  });
});

test('coverage uses waking hours, not the 24-hour day (decision 17)', async (t) => {
  await t.test('a seed week reads 95 of 112', () => {
    const c = aggregate.coverage(5700, 7, SETTINGS);
    assert.equal(c.loggedHours, 95);
    assert.equal(c.totalHours, 112);
    assert.equal(c.unloggedHours, 17);
    assert.equal(c.pct, 85);
  });

  await t.test('a single day reads against 16 h', () => {
    const c = aggregate.coverage(570, 1, SETTINGS);
    assert.equal(c.loggedHours, 9.5);
    assert.equal(c.totalHours, 16);
    assert.equal(c.unloggedHours, 6.5, 'the mockup’s "9.5 accounted for, 6.5 to go"');
  });

  await t.test('an over-logged day is reported honestly, not clamped', () => {
    const c = aggregate.coverage(1020, 1, SETTINGS);   // 17 h on a 16 h day
    assert.equal(c.pct, 106);
    assert.equal(c.unloggedHours, 0, 'hours to go cannot go negative');
  });

  await t.test('an empty range does not divide by zero', () => {
    const c = aggregate.coverage(0, 0, SETTINGS);
    assert.equal(c.pct, 0);
    assert.equal(c.totalHours, 0);
  });
});

test('a Less category’s cap is its plan unless the workbook says otherwise (decision 13)', () => {
  assert.equal(aggregate.capHours({ weekly_plan_hours: 14, weekly_cap_hours: null }), 14);
  assert.equal(aggregate.capHours({ weekly_plan_hours: 14, weekly_cap_hours: '' }), 14);
  assert.equal(aggregate.capHours({ weekly_plan_hours: 14, weekly_cap_hours: 10 }), 10);
  assert.equal(aggregate.capHours({ weekly_plan_hours: 14, weekly_cap_hours: 0 }), 0);
});

test('plannedTotal counts only categories still in the plan (rule §8.11)', () => {
  const cats = CATEGORIES.concat([
    { id: 'cat_old', name: 'Side project', direction: 'more', weekly_plan_hours: 5, archived: true },
  ]);
  assert.equal(aggregate.plannedTotal(cats), 66);
  assert.equal(aggregate.activeCategories(cats).length, 3);
});
