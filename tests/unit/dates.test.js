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

/* ---------- Phase 1: the arithmetic the calendar and the workbook run on ---------- */

test('day keys parse strictly, and impossible dates are rejected', () => {
  assert.equal(dates.dayKey(dates.parseDayKey('2026-06-07')), '2026-06-07');
  assert.equal(dates.parseDayKey('2026-02-31'), null, '31 February must not roll into March');
  assert.equal(dates.parseDayKey('2026-6-7'), null, 'the workbook format is zero-padded');
  assert.equal(dates.parseDayKey('7 Jun 2026'), null);
  assert.equal(dates.parseDayKey(''), null);
  assert.equal(dates.parseDayKey(null), null);
  assert.equal(dates.parseDayKey(20260607), null);
});

test('epoch days are stable across a DST transition', async (t) => {
  await t.test('consecutive days differ by exactly one', () => {
    // Whatever the runner's timezone, a local calendar day is one epoch day.
    for (const key of ['2026-03-28', '2026-03-29', '2026-10-24', '2026-10-25', '2026-11-01']) {
      assert.equal(
        dates.epochDay(dates.addDays(key, 1)) - dates.epochDay(key), 1,
        `${key} -> next day`);
    }
  });

  await t.test('round-trips through fromEpochDay', () => {
    const key = '2026-06-07';
    assert.equal(dates.dayKey(dates.fromEpochDay(dates.epochDay(key))), key);
  });

  await t.test('diffDays counts inclusive spans correctly', () => {
    assert.equal(dates.diffDays('2026-06-01', '2026-06-07'), 6);
    assert.equal(dates.diffDays('2026-06-07', '2026-06-01'), -6);
    assert.equal(dates.daySpan('2026-06-01', '2026-06-07'), 7);
    assert.equal(dates.daySpan('2025-12-29', '2026-01-04'), 7);
  });
});

test('weeks are Monday-first everywhere (decision 18)', async (t) => {
  await t.test('Sunday belongs to the week that started six days earlier', () => {
    assert.equal(dates.dayKey(dates.weekStart('2026-06-07')), '2026-06-01');
    assert.equal(dates.dayKey(dates.weekEnd('2026-06-01')), '2026-06-07');
    assert.equal(dates.weekdayIndex('2026-06-01'), 0);
    assert.equal(dates.weekdayIndex('2026-06-07'), 6);
  });

  await t.test('a Monday is its own week start', () => {
    assert.equal(dates.dayKey(dates.weekStart('2026-06-01')), '2026-06-01');
  });

  await t.test('weekKey pairs the ISO week-year with a padded week', () => {
    assert.equal(dates.weekKey(on(2026, 6, 7)), '2026-W23');
    assert.equal(dates.weekKey(on(2026, 1, 5)), '2026-W02');
    assert.equal(dates.weekKey(on(2027, 1, 1)), '2026-W53', 'week-year is not the calendar year');
  });
});

test('eachDay lists an inclusive range and refuses to guess', () => {
  assert.deepEqual(dates.eachDay('2026-06-05', '2026-06-07'),
    ['2026-06-05', '2026-06-06', '2026-06-07']);
  assert.deepEqual(dates.eachDay('2026-06-07', '2026-06-07'), ['2026-06-07']);
  assert.deepEqual(dates.eachDay('2026-06-07', '2026-06-05'), [], 'a backwards range is empty');
  assert.deepEqual(dates.eachDay('nonsense', '2026-06-07'), []);
});

test('typed dates parse the way the mockup parses them (spec §3)', async (t) => {
  const today = on(2026, 6, 7);
  const p = (s) => {
    const d = dates.parseUserDate(s, { today });
    return d ? dates.dayKey(d) : null;
  };

  await t.test('numeric short dates are DAY-first (rule §8.16)', () => {
    assert.equal(p('7/6'), '2026-06-07', '7/6 is 7 June, not 6 July');
    assert.equal(p('7/6/2026'), '2026-06-07');
    assert.equal(p('7/6/26'), '2026-06-07');
    assert.equal(p('07.06.2026'), '2026-06-07', 'the display format parses back');
  });

  await t.test('day-month and month-day both work', () => {
    assert.equal(p('7 Jun 2026'), '2026-06-07');
    assert.equal(p('7 June'), '2026-06-07');
    assert.equal(p('Jun 7'), '2026-06-07');
    assert.equal(p('June 7 2026'), '2026-06-07');
    assert.equal(p('2026-06-07'), '2026-06-07');
  });

  await t.test('a missing year is this year, or last year if that is in the future', () => {
    assert.equal(p('7 Jun'), '2026-06-07', 'today itself is not in the future');
    assert.equal(p('8 Jun'), '2025-06-08', 'tomorrow would be ahead, so it means last year');
    assert.equal(p('1 Jan'), '2026-01-01');
  });

  await t.test('nonsense returns null so the field can revert silently', () => {
    for (const bad of ['foo', '31 Feb', '31/2', '2026-02-31', '', '  ', '13/13/2026', 'Jun 32']) {
      assert.equal(p(bad), null, `${JSON.stringify(bad)} must not parse`);
    }
  });

  await t.test('without a today, a yearless date cannot be resolved', () => {
    assert.equal(dates.parseUserDate('7 Jun', {}), null);
  });
});

test('display formats match the mockup (spec §6)', () => {
  assert.equal(dates.formatLong('2026-06-07'), '7 Jun 2026');
  assert.equal(dates.formatDayMonth('2026-10-14'), '14 Oct');
  assert.equal(dates.formatLong('nonsense'), '');
});

test('created_at is a local wall clock, never an instant', () => {
  // spec §7's own example. A trailing Z would make every row read hours wrong
  // to the friend reading the workbook in Excel.
  assert.equal(dates.isoDateTime(at(2026, 6, 7, 9, 12)), '2026-06-07T09:12:00');
  assert.ok(dates.isIsoDateTime('2026-06-07T09:12:00'));
  assert.ok(dates.isIsoDateTime('2026-06-07T09:12'));
  assert.ok(!dates.isIsoDateTime('2026-06-07T09:12:00Z'));
  assert.ok(!dates.isIsoDateTime('2026-06-07'));
});
