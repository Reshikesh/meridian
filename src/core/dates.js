/* Meridian core — dates.
   Pure: no DOM, no storage, no clock of its own (the caller passes `now`).

   Phase 0 owns only what the header stamp needs: the 04:00 day boundary
   (decision 2) and Monday-first ISO week numbers (decision 18). Phase 1 extends
   this module with the spec §3 date parsing; it does not rewrite it.

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

  /* ISO day key, `YYYY-MM-DD`. */
  function dayKey(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* The header stamp, `dd.mm.yyyy / W##` (spec §6).

     The year shown is the calendar year and the week is the ISO week, so the two
     can legitimately disagree — 1 Jan 2027 reads `01.01.2027 / W53`. The mockup's
     format has no year after the W, so the week-year is never displayed. */
  function formatStamp(d) {
    return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear() +
      ' / W' + pad2(isoWeek(d));
  }

  return {
    DAY_START_HOUR: DAY_START_HOUR,
    logicalDay: logicalDay,
    isoWeek: isoWeek,
    isoWeekYear: isoWeekYear,
    dayKey: dayKey,
    formatStamp: formatStamp
  };
});
