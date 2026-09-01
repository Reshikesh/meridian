'use strict';

const test = require('node:test');
const assert = require('node:assert');
const seed = require('../../seed/seed.js');
const dates = require('../../src/core/dates.js');
const aggregate = require('../../src/core/aggregate.js');
const projection = require('../../src/core/projection.js');
const validate = require('../../src/core/validate.js');
const workbook = require('../../src/core/workbook.js');
const XLSX = require('../../vendor/xlsx.full.min.js');

/* Spec §9 [P]: "totals arithmetically consistent (entries sum to the week bars;
   banked hours sum to goal progress)" and "every v1 screen non-empty".

   Every assertion here is swept across all seven possible first-run weekdays.
   Fourteen days contain exactly two of each weekday, so a seed keyed to the
   weekday is stable — but only if it really is keyed to the weekday. A single
   fixed day would pass on six-sevenths of a lie. */

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// A Monday, so `+ i` walks the whole week. Plus a year boundary and both DST
// switches, which are where day arithmetic goes wrong if it ever does.
const MONDAY = new Date(2026, 5, 1, 12, 0, 0);
const EXTRA = [
  ['year boundary', new Date(2027, 0, 1, 12, 0, 0)],
  ['ISO week 53', new Date(2026, 11, 31, 12, 0, 0)],
  ['spring DST', new Date(2026, 2, 29, 12, 0, 0)],
  ['autumn DST', new Date(2026, 9, 25, 12, 0, 0)],
  ['just after the 04:00 boundary', new Date(2026, 5, 3, 4, 1, 0)],
  ['just before it', new Date(2026, 5, 3, 3, 59, 0)],
];

function everyStart() {
  const out = WEEKDAYS.map((label, i) => [label, new Date(2026, 5, 1 + i, 12, 0, 0)]);
  return out.concat(EXTRA);
}


// The complete Monday-to-Sunday week inside the seed. Thirteen full days always
// contain one; today is part-logged and never counts.
function completeWeek(state, now) {
  const todayKey = dates.dayKey(dates.logicalDay(now));
  const days = Object.keys(aggregate.byDay(state.entries)).sort();
  for (const key of days) {
    if (dates.weekdayIndex(key) !== 0) continue;
    const end = dates.dayKey(dates.addDays(key, 6));
    if (end < todayKey) return { start: key, end };
  }
  return null;
}

test('the eight categories are decision 9, exactly', () => {
  const cats = seed.categories();
  assert.deepEqual(cats.map((c) => c.name), [
    'Work', 'Scrolling', 'Family', 'Idle TV', 'Learning', 'Exercise', 'Reading', 'Everything else']);
  assert.deepEqual(cats.map((c) => c.direction), [
    'upkeep', 'less', 'more', 'less', 'more', 'more', 'more', 'upkeep']);
  assert.deepEqual(cats.map((c) => c.colour), [
    '#2b7d5d', '#c8291a', '#a8641d', '#7d2b5d', '#2b4a7d', '#6b4a7d', '#5a6b7d', '#6b6b5a']);
  assert.deepEqual(cats.map((c) => c.weekly_plan_hours), [45, 14, 12, 8, 7, 5, 3, 3]);
  assert.deepEqual(cats.map((c) => c.sort), [1, 2, 3, 4, 5, 6, 7, 8]);

  for (const c of cats) {
    assert.strictEqual(c.weekly_cap_hours, null, 'a blank cap means the plan (decision 13)');
    assert.strictEqual(c.archived, false);
    assert.strictEqual(c.archived_on, null);
  }
});

test('the discretionary hours are the Plan screen’s 52 (rule §8.6)', () => {
  const cats = seed.categories();
  const work = cats.find((c) => c.name === 'Work').weekly_plan_hours;
  const rest = cats.filter((c) => c.name !== 'Work')
    .reduce((n, c) => n + c.weekly_plan_hours, 0);
  assert.equal(work, 45);
  assert.equal(rest, 52, 'spec §9’s discretionary total');
});

test('"start empty" is the categories and their plan, nothing else', () => {
  for (const [label, now] of everyStart()) {
    const s = seed.buildEmpty(now);
    assert.equal(s.source, 'empty', label);
    assert.equal(s.categories.length, 8, label);
    assert.equal(s.plan.length, 8, label);
    assert.deepEqual(s.entries, [], label);
    assert.deepEqual(s.goals, [], label);
    assert.deepEqual(s.lessons, [], label);
    assert.equal(dates.weekdayIndex(s.plan[0].week_effective_from), 0,
      `${label}: a plan takes effect on a Monday`);
  }
});

test('the demo week adds up, whichever day it is built on', async (t) => {
  for (const [label, now] of everyStart()) {
    await t.test(label, () => {
      const state = seed.buildDemo(now);
      const week = completeWeek(state, now);
      assert.ok(week, 'thirteen full days always contain a complete Monday-to-Sunday week');

      const inWeek = aggregate.inRange(state.entries, week.start, week.end);
      assert.equal(aggregate.hours(aggregate.sumMinutes(inWeek)), 95,
        'the complete week is 95.0 h');

      const byCategory = aggregate.totalsByCategory(inWeek, state.categories);
      const lived = {};
      byCategory.forEach((r) => { lived[r.name] = r.hours; });
      assert.deepEqual(lived, {
        Work: 44, Scrolling: 15, Family: 11, 'Idle TV': 9,
        Learning: 6, Exercise: 5, Reading: 2, 'Everything else': 3,
      });

      const days = aggregate.byDay(inWeek);
      assert.deepEqual(Object.keys(days).length, 7, 'no day of the week is empty');
      for (const [day, minutes] of Object.entries(days)) {
        assert.ok(minutes <= aggregate.MINUTES_PER_DAY,
          `${day} holds ${minutes} min, over the ${aggregate.HOURS_PER_DAY} h cap`);
        assert.ok(minutes <= 900,
          `${day} leaves the owner room to nudge a duration up without hitting the cap`);
      }
    });
  }
});

test('the shape is the same fourteen days whichever weekday it starts on', () => {
  for (const [label, now] of everyStart()) {
    const state = seed.buildDemo(now);
    const todayKey = dates.dayKey(dates.logicalDay(now));
    const days = Object.keys(aggregate.byDay(state.entries)).sort();

    assert.equal(days.length, 14, `${label}: fourteen consecutive days`);
    assert.equal(days[13], todayKey, `${label}: the last day is today`);
    assert.equal(dates.diffDays(days[0], days[13]), 13, `${label}: no gaps`);

    const counts = {};
    days.forEach((d) => { counts[d] = state.entries.filter((e) => e.date === d).length; });
    for (const d of days.slice(0, 13)) {
      assert.equal(counts[d], 6, `${label}: ${d} has six entries (spec §9 asks for four to six)`);
    }
    assert.ok(counts[todayKey] >= 2 && counts[todayKey] < 6,
      `${label}: today is still in progress (${counts[todayKey]} entries)`);
  }
});

test('both goals read the same on every possible first day (decision 20)', () => {
  for (const [label, now] of everyStart()) {
    const state = seed.buildDemo(now);
    const py = projection.project(state, 'goal_py', now);
    const run = projection.project(state, 'goal_run', now);

    assert.equal(py.banked, 12, `${label}: Learn Python banked`);
    assert.equal(py.pace, 6, `${label}: pace`);
    assert.equal(py.required, 7.38, `${label}: required`);
    assert.equal(py.slippageDays, 26, `${label}: slipping by 26 days`);
    assert.equal(py.target, 130);
    assert.ok(py.enoughHistory, `${label}: twelve logged days clears the seven-day gate`);

    assert.equal(run.banked, 6, `${label}: half-marathon banked`);
    assert.equal(run.pace, 3, `${label}: pace`);
    assert.equal(run.required, 2.7, `${label}: required`);
    assert.equal(run.slippageDays, -14, `${label}: fourteen days early`);
    assert.equal(run.target, 60);
    assert.ok(run.enoughHistory, label);

    assert.ok(py.slippageDays > 0 && run.slippageDays < 0,
      `${label}: the demo needs one goal behind and one ahead`);
    assert.ok(py.weeksRunning >= 2 && run.weeksRunning >= 2, `${label}: a visible streak`);
  }
});

test('banked hours are exactly the entries that carry the goal', () => {
  for (const [label, now] of everyStart()) {
    const state = seed.buildDemo(now);
    for (const goal of state.goals) {
      const summed = aggregate.hours(aggregate.sumMinutes(
        state.entries.filter((e) => e.goal_id === goal.id)));
      assert.equal(projection.project(state, goal.id, now).banked, summed,
        `${label}: ${goal.short_name}`);
      const feeder = state.entries.filter((e) => e.goal_id === goal.id)
        .every((e) => e.category_id === goal.category_id);
      assert.ok(feeder, `${label}: a goal lives inside one category (rule §8.2)`);
    }
  }
});

test('every screen the friend can open has something in it', () => {
  for (const [label, now] of everyStart()) {
    const state = seed.buildDemo(now);
    const todayKey = dates.dayKey(dates.logicalDay(now));

    assert.ok(aggregate.dayMinutes(state.entries, todayKey) > 0, `${label}: Log`);

    // Every day of this week up to today has a bar. The rest of the week has
    // not happened yet — on a Monday that is six empty bars, which is right.
    const strip = aggregate.weekMinutes(state.entries, todayKey);
    const soFar = dates.weekdayIndex(todayKey);
    assert.ok(strip.slice(0, soFar + 1).every((m) => m > 0),
      `${label}: every bar up to today — ${JSON.stringify(strip)}`);
    assert.ok(strip.slice(soFar + 1).every((m) => m === 0),
      `${label}: nothing logged in the future`);
    assert.equal(state.goals.length, 2, `${label}: Goals`);
    assert.equal(state.lessons.length, 2, `${label}: lessons for v1.5`);
    assert.equal(state.plan.length, 8, `${label}: a plan for v1.5`);

    const split = aggregate.directionSplit(state.entries, state.categories);
    assert.ok(split.upHours > 0 && split.downHours > 0 && split.keepHours > 0,
      `${label}: all three directions are represented`);

    const goalRows = aggregate.totalsByGoal(state.entries, state.goals);
    assert.ok(goalRows.some((r) => r.id === null && r.minutes > 0),
      `${label}: the ribbon's "No goal" band has something in it`);
  }
});

test('the seed obeys the same rules as an import would', () => {
  for (const [label, now] of everyStart()) {
    const state = seed.buildDemo(now);

    // Every entry would pass the creation-path validator, one at a time, against
    // the day it belongs to — so the seed can never produce data the app itself
    // would refuse to write.
    const growing = Object.assign({}, state, { entries: [] });
    for (const e of state.entries) {
      const r = validate.validateEntry(e, growing, { now: now });
      assert.ok(r.ok, `${label}: ${e.id} — ${JSON.stringify(r.errors)}`);
      growing.entries = growing.entries.concat([e]);
    }

    for (const c of state.categories) {
      const others = Object.assign({}, state, {
        categories: state.categories.filter((x) => x.id !== c.id),
      });
      assert.ok(validate.validateCategory(c, others).ok, `${label}: ${c.name}`);
    }
    for (const g of state.goals) {
      assert.ok(validate.validateGoal(g, state, { now: now }).ok, `${label}: ${g.short_name}`);
    }
  }
});

test('lessons and settings are the ones spec §7 describes', () => {
  const now = MONDAY;
  const state = seed.buildDemo(now);

  assert.deepEqual(state.settings, {
    theme: 'paper', day_boundary: '04:00',
    errands_hours_per_week: 15, week_start: 'monday',
  });
  assert.equal(seed.buildDemo(now, { theme: 'graphite' }).settings.theme, 'graphite');

  for (const l of state.lessons) {
    assert.match(l.iso_week, /^\d{4}-W\d{2}$/);
    assert.ok(dates.parseDayKey(l.date));
    assert.ok(l.text.length > 20);
    assert.ok(Array.isArray(l.tags) && l.tags.length > 0);
  }
  assert.notEqual(state.lessons[0].iso_week, state.lessons[1].iso_week);
});

test('no entry is logged before its own day, and none in the future', () => {
  for (const [label, now] of everyStart()) {
    const state = seed.buildDemo(now);
    const todayKey = dates.dayKey(dates.logicalDay(now));
    for (const e of state.entries) {
      assert.ok(e.date <= todayKey, `${label}: ${e.id} is in the future`);
      assert.equal(e.created_at.slice(0, 10), e.date,
        `${label}: ${e.id} was written on the day it belongs to`);
      assert.ok(dates.isIsoDateTime(e.created_at), `${label}: ${e.id}`);
      assert.strictEqual(e.value, null, 'the value column ships blank (decision 10)');
    }
  }
});

test('the demo dataset survives a trip through the workbook', () => {
  for (const [label, now] of everyStart()) {
    const before = workbook.canonical(seed.buildDemo(now));
    const { state, report } = workbook.decode(
      XLSX, workbook.encode(XLSX, before, { now: now }), { now: now });
    assert.equal(report.fatal, null, label);
    assert.equal(report.rejected, 0, `${label}: ${JSON.stringify(report.rejects)}`);
    assert.deepEqual(report.notes, [], `${label}: nothing to report about the app's own file`);
    assert.deepEqual(state.entries, before.entries, label);
    assert.deepEqual(state.goals, before.goals, label);
    assert.deepEqual(state.categories, before.categories, label);
    assert.deepEqual(state.lessons, before.lessons, label);
    assert.deepEqual(state.plan, before.plan, label);
  }
});
