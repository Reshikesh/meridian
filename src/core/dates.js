/* Meridian core — dates.
   Pure: no DOM, no storage, no clock of its own (the caller passes `now`).

   Owns the 04:00 day boundary (decision 2), Monday-first ISO weeks (decision
   18), the epoch-day arithmetic the calendar runs on (spec §4d), and the typed
   date parsing from spec §3.

   Classic <script src> -> window.Meridian.dates ; CommonJS -> module.exports */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Meridian = root.Meridian || {}).dates = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* decision 2: the logging day ends at 04:00, so "today" is the local clock
     minus four hours. */
  var DAY_START_HOUR = 4;

  var DAY_MS = 86400000;
  var WEEK_MS = 604800000;

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  var MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

  /* Monday first (decision 18), so index 0 is Monday everywhere in the app and
     `weekdayIndex` can address these directly. */
  var WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  var WEEKDAYS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday',
                       'Friday', 'Saturday', 'Sunday'];

  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  /* The logical day `now` falls in, as a Date at local midnight.

     Deliberately calendar-field arithmetic rather than `now - 4h`: on a DST
     transition a local day is 23 or 25 hours long, so subtracting a fixed four
     hours lands on the wrong calendar day. Spec §10 lists timezone/DST as an
     open gap; this is the resolution. */
  function logicalDay(now) {
    var back = now.getHours() < DAY_START_HOUR ? 1 : 0;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
  }

  /* ISO-8601 week number, 1..53. Week 1 is the week containing the first
     Thursday of the year, equivalently the week containing 4 January.

     Computed on UTC day numbers so that a DST hour inside the interval cannot
     shift the quotient. */
  function isoWeek(d) {
    var day = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    var dow = (new Date(day).getUTCDay() + 6) % 7;          // Mon=0 .. Sun=6
    var thursday = day + (3 - dow) * DAY_MS;
    var isoYear = new Date(thursday).getUTCFullYear();
    var jan4 = Date.UTC(isoYear, 0, 4);
    var jan4dow = (new Date(jan4).getUTCDay() + 6) % 7;
    var week1Monday = jan4 - jan4dow * DAY_MS;
    return Math.round((thursday - week1Monday) / WEEK_MS) + 1;
  }

  /* The ISO week-year, which is not always the calendar year: 1 Jan 2027 falls
     in 2026-W53. The header shows the week number alone, but the workbook's
     `iso_week` column (spec §7) needs the pair. */
  function isoWeekYear(d) {
    var day = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
    var dow = (new Date(day).getUTCDay() + 6) % 7;
    return new Date(day + (3 - dow) * DAY_MS).getUTCFullYear();
  }

  /* `2026-W23`, the workbook's iso_week column. Padded, as ISO 8601 writes it. */
  function weekKey(d) {
    return isoWeekYear(d) + '-W' + pad2(isoWeek(d));
  }

  /* ISO day key, `YYYY-MM-DD`. */
  function dayKey(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* Field-by-field, because the Date constructor rolls overflow forward: without
     the round-trip check `2026-02-31` would quietly become 3 March. */
  function makeDay(y, mon, day) {
    if (!(y >= 1000 && y <= 9999) || mon < 1 || mon > 12 || day < 1 || day > 31) return null;
    var d = new Date(y, mon - 1, day);
    if (d.getFullYear() !== y || d.getMonth() !== mon - 1 || d.getDate() !== day) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /* Strict `YYYY-MM-DD` -> local-midnight Date, or null. */
  function parseDayKey(s) {
    if (typeof s !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
    return m ? makeDay(+m[1], +m[2], +m[3]) : null;
  }

  /* Accepts either shape a caller might hold — a day key or a Date — and
     returns a Date at local midnight, so no arithmetic below carries a time. */
  function toDate(v) {
    if (v == null) return null;
    if (typeof v === 'string') return parseDayKey(v);
    if (v instanceof Date) {
      if (isNaN(v.getTime())) return null;
      return new Date(v.getFullYear(), v.getMonth(), v.getDate());
    }
    return null;
  }

  /* Whole days since 1970-01-01, computed on UTC so a DST hour cannot shift the
     quotient. The calendar (spec §4d) indexes days by this integer. */
  function epochDay(v) {
    var d = toDate(v);
    if (!d) return null;
    return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
  }

  function fromEpochDay(n) {
    var u = new Date(n * DAY_MS);
    return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
  }

  function addDays(v, n) {
    var d = toDate(v);
    return d ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + n) : null;
  }

  /* Whole days from `a` to `b`; negative when b precedes a. */
  function diffDays(a, b) {
    var x = epochDay(a), y = epochDay(b);
    return (x === null || y === null) ? null : y - x;
  }

  /* Monday=0 .. Sunday=6 (decision 18: Monday first, everywhere). */
  function weekdayIndex(v) {
    var d = toDate(v);
    return d ? (d.getDay() + 6) % 7 : null;
  }

  function weekStart(v) {
    var d = toDate(v);
    return d ? addDays(d, -weekdayIndex(d)) : null;
  }

  function weekEnd(v) {
    var s = weekStart(v);
    return s ? addDays(s, 6) : null;
  }

  /* Inclusive day count; null when either end will not parse. */
  function daySpan(a, b) {
    var n = diffDays(a, b);
    return n === null ? null : n + 1;
  }

  /* Inclusive list of day keys. Returns [] rather than throwing when the range
     runs backwards, so a caller with a swapped range renders empty, not broken. */
  function eachDay(a, b) {
    var start = toDate(a), end = toDate(b);
    if (!start || !end) return [];
    var out = [];
    for (var d = start; d <= end; d = addDays(d, 1)) out.push(dayKey(d));
    return out;
  }

  /* The header stamp, `dd.mm.yyyy / W##` (spec §6).

     The year shown is the calendar year and the week is the ISO week, so the two
     can legitimately disagree — 1 Jan 2027 reads `01.01.2027 / W53`. The mockup's
     format has no year after the W, so the week-year is never displayed. */
  function formatStamp(d) {
    return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear() +
      ' / W' + pad2(isoWeek(d));
  }

  /* `7 Jun 2026` — the form the mockup uses inside fields (spec §6). */
  function formatLong(v) {
    var d = toDate(v);
    return d ? d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear() : '';
  }

  /* `7 Jun` — the same without the year, for a landing date inside a table row. */
  function formatDayMonth(v) {
    var d = toDate(v);
    return d ? d.getDate() + ' ' + MONTHS[d.getMonth()] : '';
  }

  /* `SUNDAY 7 JUNE` — the Log screen's day eyebrow (spec §6). Uppercased here
     rather than in CSS because the month is spelled out in full only in this
     one place, and `text-transform` on a string the app never shows in mixed
     case would hide that from anyone reading the markup. */
  function formatDayHeading(v) {
    var d = toDate(v);
    if (!d) return '';
    return (WEEKDAYS_FULL[weekdayIndex(d)] + ' ' + d.getDate() + ' ' +
      MONTHS_FULL[d.getMonth()]).toUpperCase();
  }

  /* `SUN 7 JUNE` — the same, abbreviated, for the entry sheet's title. */
  function formatDayShort(v) {
    var d = toDate(v);
    if (!d) return '';
    return (WEEKDAYS[weekdayIndex(d)] + ' ' + d.getDate() + ' ' +
      MONTHS_FULL[d.getMonth()]).toUpperCase();
  }

  /* Local wall clock, no zone suffix: `2026-06-07T09:12:00` (spec §7 example).
     Deliberately not an instant — the workbook is read by a human in Excel, and
     a trailing Z would make every row look hours wrong to them. */
  function isoDateTime(t) {
    return t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate()) +
      'T' + pad2(t.getHours()) + ':' + pad2(t.getMinutes()) + ':' + pad2(t.getSeconds());
  }

  function isIsoDateTime(s) {
    return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s.trim());
  }

  /* A month word is matched on its first three letters, as the mockup does
     (`n.slice(0, 3)`), so `sept` and `september` both read as September. */
  function monthIndex(word) {
    var w = String(word).toLowerCase();
    if (w.length < 3) return 0;
    for (var i = 0; i < 12; i++) {
      if (MONTHS_FULL[i].toLowerCase() === w || MONTHS[i].toLowerCase() === w.slice(0, 3)) return i + 1;
    }
    return 0;
  }

  /* A year the caller did not type. The mockup hard-codes its rule to its own
     2026 horizon; generalised here: the current year, unless that lands in the
     future, in which case the year before.

     `future` turns the rule round, for a field that can only mean a date ahead
     — the goal sheet's BY. There, `30 Sep` typed in October means next year's
     September, and the backward rule would answer with a date already gone. */
  function withYear(day, mon, yearText, today, future) {
    if (yearText != null && yearText !== '') {
      var y = +yearText;
      return makeDay(y < 100 ? 2000 + y : y, mon, day);
    }
    if (!today) return null;
    var here = makeDay(today.getFullYear(), mon, day);
    if (!here) return null;
    if (future) return here < today ? makeDay(today.getFullYear() + 1, mon, day) : here;
    return here > today ? makeDay(today.getFullYear() - 1, mon, day) : here;
  }

  /* spec §3: parse what the owner types into a date field.

     Forms, in the order they are tried: ISO `Y-M-D`; `7 Jun [2026]`; `Jun 7`;
     day-first numeric `D/M[/Y]` with `/`, `.` or `-` between the parts — so
     `7/6` is 7 June, business rule §8.16.
     Anything else returns null and the caller silently reverts the field.

     `opts.future` resolves a missing year forwards instead of back (withYear). */
  function parseUserDate(text, opts) {
    if (typeof text !== 'string') return null;
    var s = text.trim().replace(/\s+/g, ' ');
    if (!s) return null;
    var today = (opts && opts.today && toDate(opts.today)) || null;
    var future = !!(opts && opts.future);
    var m;

    m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (m) return makeDay(+m[1], +m[2], +m[3]);

    m = /^(\d{1,2})[ -]([A-Za-z]{3,9})\.?(?:[ ,-]+(\d{2}|\d{4}))?$/.exec(s);
    if (m) {
      var mo = monthIndex(m[2]);
      return mo ? withYear(+m[1], mo, m[3], today, future) : null;
    }

    m = /^([A-Za-z]{3,9})\.? ?(\d{1,2})(?:[ ,]+(\d{2}|\d{4}))?$/.exec(s);
    if (m) {
      var mo2 = monthIndex(m[1]);
      return mo2 ? withYear(+m[2], mo2, m[3], today, future) : null;
    }

    m = /^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/.exec(s);
    if (m) return withYear(+m[1], +m[2], m[3], today, future);

    return null;
  }

  return {
    DAY_START_HOUR: DAY_START_HOUR,
    MONTHS: MONTHS,
    MONTHS_FULL: MONTHS_FULL,
    WEEKDAYS: WEEKDAYS,
    WEEKDAYS_FULL: WEEKDAYS_FULL,
    logicalDay: logicalDay,
    isoWeek: isoWeek,
    isoWeekYear: isoWeekYear,
    weekKey: weekKey,
    dayKey: dayKey,
    parseDayKey: parseDayKey,
    makeDay: makeDay,
    toDate: toDate,
    epochDay: epochDay,
    fromEpochDay: fromEpochDay,
    addDays: addDays,
    diffDays: diffDays,
    weekdayIndex: weekdayIndex,
    weekStart: weekStart,
    weekEnd: weekEnd,
    daySpan: daySpan,
    eachDay: eachDay,
    formatStamp: formatStamp,
    formatLong: formatLong,
    formatDayMonth: formatDayMonth,
    formatDayHeading: formatDayHeading,
    formatDayShort: formatDayShort,
    isoDateTime: isoDateTime,
    isIsoDateTime: isIsoDateTime,
    parseUserDate: parseUserDate
  };
});
