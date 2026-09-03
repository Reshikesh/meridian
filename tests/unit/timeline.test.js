'use strict';

const test = require('node:test');
const assert = require('node:assert');
const dates = require('../../src/core/dates.js');
const projection = require('../../src/core/projection.js');
const timeline = require('../../src/core/timeline.js');

/* The Progress chart's geometry (spec §4e as decision 27 recasts it): every
   live goal on one chart, the vertical axis in percent of target, the axes
   ranged over every goal, and the date labels in as many bands as they need
   so that none of them ever overlaps another. */

const NOW = new Date(2026, 5, 7, 12, 0, 0);
const TODAY = '2026-06-07';

function goal(id, patch) {
  return Object.assign({
    id, short_name: id, category_id: 'cat_learn', target_amount: 130,
    target_unit: 'h', by_date: '2026-09-30', archived: false,
  }, patch || {});
}

function daily(goalId, count, min, endOffset) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      id: `${goalId}_${i}`, date: dates.dayKey(dates.addDays(TODAY, -(endOffset || 0) - i)),
      duration_min: min, category_id: 'cat_learn', goal_id: goalId,
    });
  }
  return out;
}

function line(state, id, extra) {
  return Object.assign(projection.series(state, id, NOW), { colour: '#2b4a7d', dashed: false }, extra || {});
}

const OPTS = { today: TODAY, width: 880 };

test('the x axis runs from the earliest history to the latest date in view', async (t) => {
  await t.test('one goal: from the day before its first entry to its landing', () => {
    const state = { goals: [goal('a')], entries: daily('a', 14, 60) };
    const s = line(state, 'a');
    const g = timeline.layout([s], OPTS);
    assert.equal(g.domain.start, '2026-05-24', 'the zero point, the day before the first entry');
    // 130 days from 24 May to the landing; eight percent of that is ten days of air.
    assert.equal(g.domain.end, dates.dayKey(dates.addDays(s.landing, 10)), 'air past the landing for its label');
    assert.equal(g.W, 880);
    assert.equal(g.xL, 56);
    assert.equal(g.xR, 856);
  });

  await t.test('two goals: the earliest start and the latest end of either', () => {
    const state = {
      goals: [goal('a'), goal('b', { by_date: '2027-01-31', target_amount: 20 })],
      entries: daily('a', 14, 60).concat(daily('b', 3, 60, 30)),
    };
    const g = timeline.layout([line(state, 'a'), line(state, 'b')], OPTS);
    assert.equal(g.domain.start, '2026-05-05', 'goal b started earlier');
    assert.equal(g.domain.end, '2027-02-22', 'goal b is dated later than anything a projects');
  });

  await t.test('a landing beyond two years is drawn to the edge and marked clipped', () => {
    const state = { goals: [goal('a', { by_date: '2026-12-31' })], entries: daily('a', 2, 6) };
    const s = line(state, 'a');
    assert.ok(dates.diffDays(TODAY, s.landing) > 730, 'a tenth of an hour a day takes years');
    const g = timeline.layout([s], OPTS);
    assert.equal(g.domain.end, dates.dayKey(dates.addDays(TODAY, 104 * 7 + Math.round((104 * 7 + 1) * 0.08))));
    assert.equal(g.goals[0].projection.clipped, true);
    assert.ok(g.goals[0].projection.to.x <= g.xR + 0.01);
    assert.ok(g.goals[0].projection.to.y > g.yTop, 'the line has not reached the target at the edge');
    const label = g.labels.find((l) => l.kind === 'landing');
    assert.equal(label.clipped, true);
    assert.match(label.text, /\d{4}$/, 'a date years out carries its year');
  });

  await t.test('a chart never spans less than a fortnight', () => {
    const state = { goals: [goal('a', { by_date: '2026-06-08' })], entries: daily('a', 1, 60) };
    const g = timeline.layout([line(state, 'a')], OPTS);
    assert.equal(dates.diffDays(g.domain.start, g.domain.end), 14);
  });

  await t.test('no goals at all still lays out axes around today', () => {
    const g = timeline.layout([], OPTS);
    assert.equal(g.goals.length, 0);
    assert.equal(g.lanes, 1);
    assert.equal(dates.diffDays(g.domain.start, g.domain.end), 14);
    assert.ok(g.xTicks.length >= 1);
  });
});

test('the y axis is percent of target, and ranges over every goal', async (t) => {
  await t.test('100 % is the mockup’s ceiling line, at the top of the plot', () => {
    const state = { goals: [goal('a', { by_date: '2026-08-31' })], entries: daily('a', 14, 60) };
    const g = timeline.layout([line(state, 'a')], OPTS);
    assert.equal(g.yMax, 100);
    assert.equal(g.lanes, 1);
    assert.equal(g.H, 330, 'the mockup’s height at one band of labels');
    assert.equal(g.y0, 290, 'the axis where the mockup draws it');
    assert.equal(g.yTop, 43, 'the 100 % line where the mockup draws 130 h');
    assert.deepEqual(g.yTicks.map((k) => k.label), ['0%', '50%', '100%']);
  });

  await t.test('a 60-hour and a 130-hour goal share the line', () => {
    const state = {
      goals: [goal('a'), goal('b', { target_amount: 60 })],
      entries: daily('a', 14, 60).concat(daily('b', 14, 60)),
    };
    const g = timeline.layout([line(state, 'a'), line(state, 'b')], OPTS);
    const endA = g.goals[0].projection.to.y;
    const endB = g.goals[1].projection.to.y;
    assert.equal(endA.toFixed(3), g.yTop.toFixed(3));
    assert.equal(endB.toFixed(3), g.yTop.toFixed(3), 'both projections aim at 100 %');
    assert.ok(g.goals[1].now.y < g.goals[0].now.y, '14 h is further along 60 than along 130');
  });

  await t.test('a goal past its target stretches the axis, in tens', () => {
    const state = { goals: [goal('a', { target_amount: 10 })], entries: daily('a', 14, 60) };
    const g = timeline.layout([line(state, 'a')], OPTS);
    assert.equal(g.yMax, 140);
    assert.equal(g.yTicks[g.yTicks.length - 1].label, '140%');
    assert.ok(g.yTop > 43, 'the 100 % line has come down to make room');
    assert.equal(g.goals[0].projection, null, 'reached: history only');
  });
});

test('every goal is its own line', async (t) => {
  await t.test('history is a polyline to today, and the projection carries on to the landing', () => {
    // 116 h left at 7 h a week lands 1 October, a month past 31 August.
    const state = { goals: [goal('a', { by_date: '2026-08-31' })], entries: daily('a', 14, 60) };
    const s = line(state, 'a');
    const g = timeline.layout([s], OPTS).goals[0];
    assert.equal(g.history.length, s.points.length);
    assert.equal(g.history[0].y.toFixed(3), (290).toFixed(3), 'starts on the axis');
    assert.equal(g.now.x.toFixed(3), g.projection.from.x.toFixed(3));
    assert.equal(g.now.y.toFixed(3), g.projection.from.y.toFixed(3), 'the projection starts where the history ends');
    assert.match(g.historyPath, /^M[\d.]+,[\d.]+( L[\d.]+,[\d.]+)+$/);
    assert.ok(g.landing.x > g.target.x, 'this goal lands after its date');
    assert.equal(g.late, true);
    assert.ok(g.band, 'and gets the warn band');
    assert.equal(g.band.x.toFixed(3), g.target.x.toFixed(3));
    assert.equal((g.band.x + g.band.width).toFixed(3), g.landing.x.toFixed(3));
  });

  await t.test('on time: no band', () => {
    const state = { goals: [goal('a', { target_amount: 21, by_date: '2026-07-31' })], entries: daily('a', 14, 60) };
    const g = timeline.layout([line(state, 'a')], OPTS).goals[0];
    assert.equal(g.late, false);
    assert.equal(g.band, null);
    assert.ok(g.landing.x < g.target.x);
  });

  await t.test('one logged day: a short line, a target, no projection and no landing', () => {
    const state = { goals: [goal('a')], entries: daily('a', 1, 60) };
    const g = timeline.layout([line(state, 'a')], OPTS).goals[0];
    assert.equal(g.history.length, 2);
    assert.equal(g.projection, null);
    assert.equal(g.landing, null);
    assert.ok(g.target);
  });

  await t.test('nothing logged: no line at all, the target still marked', () => {
    const state = { goals: [goal('a')], entries: [] };
    const g = timeline.layout([line(state, 'a')], OPTS).goals[0];
    assert.equal(g.history.length, 0);
    assert.equal(g.historyPath, null);
    assert.equal(g.now, null);
    assert.ok(g.target);
  });

  await t.test('a date already passed puts the target left of today and the band after it', () => {
    const state = { goals: [goal('a', { by_date: '2026-05-01' })], entries: daily('a', 14, 60) };
    const g = timeline.layout([line(state, 'a')], OPTS);
    const gl = g.goals[0];
    assert.ok(gl.target.x < g.todayX);
    assert.ok(gl.band.width > 0);
  });

  await t.test('colour and dash pass straight through', () => {
    const state = { goals: [goal('a')], entries: daily('a', 14, 60) };
    const g = timeline.layout([line(state, 'a', { colour: '#a8641d', dashed: true })], OPTS).goals[0];
    assert.equal(g.colour, '#a8641d');
    assert.equal(g.dashed, true);
  });
});

test('date labels never overlap: a label that would is moved to the next band', async (t) => {
  await t.test('one goal, target and landing apart: one band', () => {
    const state = { goals: [goal('a', { by_date: '2026-08-31' })], entries: daily('a', 14, 60) };
    const g = timeline.layout([line(state, 'a')], OPTS);
    assert.equal(g.lanes, 1);
    assert.deepEqual(g.labels.map((l) => l.kind).sort(), ['landing', 'target']);
    const target = g.labels.find((l) => l.kind === 'target');
    const landing = g.labels.find((l) => l.kind === 'landing');
    assert.equal(target.anchor, 'end', 'left of its line, as the mockup sets TARGET');
    assert.equal(landing.anchor, 'start', 'right of its line, as the mockup sets 14 OCT');
    assert.equal(target.text, '31 AUG');
    assert.equal(landing.text, '1 OCT');
    assert.equal(landing.tone, 'warn');
  });

  await t.test('a target and a landing a day apart: two bands, and the chart grows by one', () => {
    // The seed’s own case: 30 September asked for, 1 October projected.
    const state = {
      goals: [goal('a'), goal('b', { by_date: '2026-10-01' })],
      entries: daily('a', 14, 60).concat(daily('b', 14, 60)),
    };
    const g = timeline.layout([line(state, 'a'), line(state, 'b')], OPTS);
    assert.ok(g.lanes >= 2);
    assert.equal(g.H, 330 + (g.lanes - 1) * 19);
    // No two labels in one band overlap.
    const byLane = {};
    g.labels.forEach((l) => { (byLane[l.lane] = byLane[l.lane] || []).push(l); });
    Object.values(byLane).forEach((ls) => {
      ls.sort((p, q) => p.left - q.left);
      for (let i = 1; i < ls.length; i++) assert.ok(ls[i].left >= ls[i - 1].right + 10, 'clear air');
    });
    // Every label sits inside its band.
    g.labels.forEach((l) => assert.equal(l.y, 24 + l.lane * 19 + 12));
  });

  await t.test('a landing at the far right anchors to the left so it stays on the chart', () => {
    const state = { goals: [goal('a', { by_date: '2026-06-20' })], entries: daily('a', 14, 60) };
    const g = timeline.layout([line(state, 'a')], { today: TODAY, width: 320 });
    const landing = g.labels.find((l) => l.kind === 'landing');
    assert.ok(landing.right <= g.W, `${landing.right} past the edge at ${g.W}`);
  });

  await t.test('lanes fill left to right, whatever order the goals came in', () => {
    const labels = [
      { left: 300, right: 340 }, { left: 10, right: 60 }, { left: 50, right: 90 }, { left: 320, right: 360 },
    ];
    assert.equal(timeline.assignLanes(labels), 2);
    assert.equal(labels[1].lane, 0);
    assert.equal(labels[2].lane, 1);
    assert.equal(labels[0].lane, 0);
    assert.equal(labels[3].lane, 1);
  });
});

test('week ticks land on Mondays at a step the width can carry', async (t) => {
  await t.test('the mockup’s six-week step over its half year, five labels', () => {
    const e0 = dates.epochDay('2026-04-20');
    const e1 = dates.epochDay('2026-10-12');
    const w = timeline.weekTicks(e0, e1, 880);
    assert.equal(w.stepWeeks, 6);
    assert.deepEqual(w.ticks.map((k) => k.label), ['W17', 'W23', 'W29', 'W35', 'W41']);
    w.ticks.forEach((k) => assert.equal(dates.weekdayIndex(dates.fromEpochDay(k.epoch)), 0, 'a Monday'));
  });

  await t.test('a narrow chart takes fewer', () => {
    const e0 = dates.epochDay('2026-04-20');
    const e1 = dates.epochDay('2026-10-12');
    assert.ok(timeline.weekTicks(e0, e1, 360).ticks.length <= 3);
  });

  await t.test('a fortnight is ticked week by week', () => {
    const e0 = dates.epochDay('2026-06-06');
    const w = timeline.weekTicks(e0, e0 + 14, 880);
    assert.equal(w.stepWeeks, 1);
    assert.deepEqual(w.ticks.map((k) => k.label), ['W24', 'W25']);
  });

  await t.test('the first tick is never before the domain starts', () => {
    const e0 = dates.epochDay('2026-06-03');       // a Wednesday
    const w = timeline.weekTicks(e0, e0 + 60, 880);
    assert.ok(w.ticks[0].epoch >= e0);
  });
});

test('mark text is the day and month, with the year only when it is far off', () => {
  assert.equal(timeline.markText('2026-09-30', TODAY), '30 SEP');
  assert.equal(timeline.markText('2027-06-06', TODAY), '6 JUN');
  assert.equal(timeline.markText('2027-06-08', TODAY), '8 JUN 2027');
  assert.equal(timeline.markText('nonsense', TODAY), '');
});

test('the width is measured, and the chart never squeezes under its minimum', () => {
  const state = { goals: [goal('a')], entries: daily('a', 14, 60) };
  const s = line(state, 'a');
  assert.equal(timeline.layout([s], { today: TODAY, width: 100 }).W, 320);
  assert.equal(timeline.layout([s], { today: TODAY, width: 1200 }).W, 1200);
  assert.equal(timeline.layout([s], { today: TODAY }).W, 880);
});
