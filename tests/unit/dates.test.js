'use strict';

const test = require('node:test');
const assert = require('node:assert');
const dates = require('../../src/core/dates.js');

/* Local-time constructor: `new Date(y, m-1, d, h, min)` is what the app sees,
   because the day boundary is defined against the owner's local clock. */
function at(y, m, d, h, min) {
  return new Date(y, m - 1, d, h || 0, min || 0);
}

/* A date used only for its calendar day; midday keeps it clear of the boundary. */
function on(y, m, d) {
  return at(y, m, d, 12, 0);
}

test('04:00 day boundary (decision 2)', async (t) => {
  await t.test('03:59 still belongs to the previous day', () => {
    assert.equal(dates.dayKey(dates.logicalDay(at(2026, 6, 8, 3, 59))), '2026-06-07');
  });

  await t.test('04:00 starts the new day', () => {
    assert.equal(dates.dayKey(dates.logicalDay(at(2026, 6, 8, 4, 0))), '2026-06-08');
  });

  await t.test('late evening stays on its own day', () => {
    assert.equal(dates.dayKey(dates.logicalDay(at(2026, 6, 8, 23, 59))), '2026-06-08');
  });

  await t.test('00:00 rolls back across a month boundary', () => {
    assert.equal(dates.dayKey(dates.logicalDay(at(2026, 6, 1, 0, 0))), '2026-05-31');
  });

  await t.test('00:30 on 1 January rolls back across the year', () => {
    assert.equal(dates.dayKey(dates.logicalDay(at(2026, 1, 1, 0, 30))), '2025-12-31');
  });

  await t.test('the boundary hour is 4', () => {
    assert.equal(dates.DAY_START_HOUR, 4);
  });
});

test('ISO week numbering (decision 18)', async (t) => {
  /* [year, month, day, expected week, expected ISO week-year].
     2026 is a 53-week ISO year: 31 Dec 2026 is a Thursday. */
  const cases = [
    [2026, 6, 7, 23, 2026],   // the mockup's hard-coded stamp, 07.06.2026 / W23
    [2026, 6, 1, 23, 2026],   // Monday of that same ISO week
    [2026, 6, 8, 24, 2026],
    [2025, 12, 28, 52, 2025], // Sunday, last day of 2025-W52
    [2025, 12, 29, 1, 2026],  // Monday, first day of 2026-W01 — week-year jumps
    [2025, 12, 31, 1, 2026],
    [2026, 1, 1, 1, 2026],
    [2026, 1, 4, 1, 2026],    // Sunday, last day of 2026-W01
    [2026, 1, 5, 2, 2026],
    [2026, 12, 31, 53, 2026], // Thursday, so 2026 has 53 ISO weeks
    [2027, 1, 1, 53, 2026],
    [2027, 1, 3, 53, 2026],   // Sunday, last day of 2026-W53
    [2027, 1, 4, 1, 2027],    // Monday, first day of 2027-W01
    [2024, 12, 30, 1, 2025],
    [2021, 1, 1, 53, 2020]
  ];

  for (const [y, m, d, week, weekYear] of cases) {
    await t.test(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')} is ${weekYear}-W${String(week).padStart(2, '0')}`, () => {
      assert.equal(dates.isoWeek(on(y, m, d)), week);
      assert.equal(dates.isoWeekYear(on(y, m, d)), weekYear);
    });
  }
});

test('header stamp formatting (spec §6)', async (t) => {
  await t.test('matches the mockup exactly', () => {
    assert.equal(dates.formatStamp(on(2026, 6, 7)), '07.06.2026 / W23');
  });

  await t.test('pads day, month and week to two digits', () => {
    assert.equal(dates.formatStamp(on(2026, 1, 5)), '05.01.2026 / W02');
  });

  await t.test('calendar year and ISO week-year may disagree', () => {
    // 1 Jan 2027 falls in 2026-W53. The stamp shows the calendar year and the
    // week number, never the week-year.
    assert.equal(dates.formatStamp(on(2027, 1, 1)), '01.01.2027 / W53');
  });

  await t.test('boundary and week roll over together', () => {
    // 02:00 on 1 Jan 2027 is logically 31 Dec 2026, which is 2026-W53.
    assert.equal(dates.formatStamp(dates.logicalDay(at(2027, 1, 1, 2, 0))), '31.12.2026 / W53');
  });
});

test('dayKey is an ISO day string', () => {
  assert.equal(dates.dayKey(on(2026, 6, 7)), '2026-06-07');
  assert.equal(dates.dayKey(on(2026, 1, 5)), '2026-01-05');
});
