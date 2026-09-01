/* Meridian core — aggregation.
   Pure: no DOM, no storage, no clock of its own.

   Every "accounted for / to go / coverage / unlogged / of N h" figure in the app
   is computed here against WAKING hours — 24 minus the sleep default, 16 h a day
   and 112 h a week (decision 17). The only 168 in the app is the Plan screen's
   own bar, which names sleep explicitly; `HOURS_PER_WEEK` is exported for it and
   is never a denominator for coverage.

   Classic <script src> -> window.Meridian.aggregate ; CommonJS -> module.exports */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(isNode ? require('./dates.js') : root.Meridian.dates);
  if (isNode) module.exports = api;
  else (root.Meridian = root.Meridian || {}).aggregate = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (dates) {
  'use strict';

  var HOURS_PER_DAY = 24;
  var HOURS_PER_WEEK = 168;
  var DEFAULT_SLEEP_HOURS = 8;      // spec §7 Settings default
  var DEFAULT_ERRANDS_HOURS = 15;

  /* ---------- hours ---------- */

  /* Hours to one decimal, rounded in whole minutes.

     Never `(minutes / 60).toFixed(1)`: binary floating point makes
     `(0.15).toFixed(1)` return "0.1", so nine minutes would read 0.1 h instead
     of 0.2. Rounding to tenths of an hour first — six-minute units — keeps the
     arithmetic in integers. */
  function tenths(minutes) {
    return Math.round((Number(minutes) || 0) / 6);
  }

  function hours(minutes) {
    return tenths(minutes) / 10;
  }

  function formatHours(minutes) {
    return (tenths(minutes) / 10).toFixed(1);
  }

  function hoursToMinutes(h) {
    return Math.round((Number(h) || 0) * 60);
  }

  /* What the quick-add row and the entry sheet's "Other" field accept:
     `1.5`, `1.5h`, `90m` (BUILD-PLAN § Phase 2), plus the spellings a person
     reaches for by reflex — `1.5 hrs`, `90 mins`, `.5h`, `2H`.

     A bare number is HOURS. That is the unit every figure in the app is
     written in, and the field's own placeholder says `1.5 h`; reading a bare
     `2` as two minutes would be a silent, unrecoverable misreading of the most
     common input there is.

     Returns whole minutes, or null for anything it cannot understand — never a
     guess. The caller turns null into the message next to the field. */
  var DURATION_RE = /^([0-9]*\.?[0-9]+)\s*([a-z]*)$/;

  function parseDuration(text) {
    if (text === null || text === undefined) return null;
    var s = String(text).trim().toLowerCase();
    if (!s) return null;

    var m = DURATION_RE.exec(s);
    if (!m) return null;

    var n = Number(m[1]);
    if (!isFinite(n) || n <= 0) return null;

    var unit = m[2];
    var minutes;
    if (unit === '' || unit === 'h' || unit === 'hr' || unit === 'hrs' ||
        unit === 'hour' || unit === 'hours') {
      minutes = n * 60;
    } else if (unit === 'm' || unit === 'min' || unit === 'mins' ||
               unit === 'minute' || unit === 'minutes') {
      minutes = n;
    } else {
      return null;
    }

    minutes = Math.round(minutes);
    return minutes > 0 ? minutes : null;
  }

  /* ---------- settings-derived denominators (decision 17) ---------- */

  function sleepHours(settings) {
    var v = settings && settings.sleep_hours_per_day;
    v = (v === null || v === undefined || v === '') ? DEFAULT_SLEEP_HOURS : Number(v);
    if (!isFinite(v) || v < 0 || v >= HOURS_PER_DAY) v = DEFAULT_SLEEP_HOURS;
    return v;
  }

  function wakingHoursPerDay(settings) {
    return HOURS_PER_DAY - sleepHours(settings);
  }

  function wakingHoursPerWeek(settings) {
    return wakingHoursPerDay(settings) * 7;
  }

  function wakingMinutesPerDay(settings) {
    return Math.round(wakingHoursPerDay(settings) * 60);
  }

  /* ---------- selection ---------- */

  function inRange(entries, startKey, endKey) {
    var out = [];
    for (var i = 0; i < entries.length; i++) {
      var d = entries[i].date;
      if (d >= startKey && d <= endKey) out.push(entries[i]);
    }
    return out;
  }

  function sumMinutes(entries) {
    var total = 0;
    for (var i = 0; i < entries.length; i++) total += Number(entries[i].duration_min) || 0;
    return total;
  }

  /* dayKey -> minutes, for every day that has an entry. */
  function byDay(entries) {
    var out = Object.create(null);
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      out[e.date] = (out[e.date] || 0) + (Number(e.duration_min) || 0);
    }
    return out;
  }

  function dayMinutes(entries, dayKey) {
    var total = 0;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].date === dayKey) total += Number(entries[i].duration_min) || 0;
    }
    return total;
  }

  /* Seven day totals, Monday first (decision 18), for the week containing
     `anyDay`. Days with nothing logged are 0, not absent — the Log week strip
     draws seven bars whatever the data does. */
  function weekMinutes(entries, anyDay) {
    var monday = dates.weekStart(anyDay);
    if (!monday) return [0, 0, 0, 0, 0, 0, 0];
    var totals = byDay(entries);
    var out = [];
    for (var i = 0; i < 7; i++) out.push(totals[dates.dayKey(dates.addDays(monday, i))] || 0);
    return out;
  }

  /* Distinct days carrying at least one entry — the history measure that
     projection.js gates on. */
  function distinctDays(entries) {
    var seen = Object.create(null), n = 0;
    for (var i = 0; i < entries.length; i++) {
      if (!seen[entries[i].date]) { seen[entries[i].date] = 1; n++; }
    }
    return n;
  }

  function firstDay(entries) {
    var min = null;
    for (var i = 0; i < entries.length; i++) {
      if (min === null || entries[i].date < min) min = entries[i].date;
    }
    return min;
  }

  function lastDay(entries) {
    var max = null;
    for (var i = 0; i < entries.length; i++) {
      if (max === null || entries[i].date > max) max = entries[i].date;
    }
    return max;
  }

  /* ---------- breakdowns ---------- */

  function minutesByKey(entries, key) {
    var out = Object.create(null);
    for (var i = 0; i < entries.length; i++) {
      var k = entries[i][key];
      if (k === null || k === undefined) k = '';
      out[k] = (out[k] || 0) + (Number(entries[i].duration_min) || 0);
    }
    return out;
  }

  /* One row per category that has hours in the selection, largest first.
     Archived categories are included: they stay in every historical range
     (business rule §8.11); it is the pickers they leave, not the past. */
  function totalsByCategory(entries, categories, opts) {
    var mins = minutesByKey(entries, 'category_id');
    var rows = [];
    for (var i = 0; i < categories.length; i++) {
      var c = categories[i];
      var m = mins[c.id] || 0;
      if (m > 0 || (opts && opts.includeEmpty)) {
        rows.push({
          id: c.id, name: c.name, colour: c.colour, direction: c.direction,
          archived: !!c.archived, minutes: m, hours: hours(m)
        });
      }
      delete mins[c.id];
    }
    /* An entry whose category no longer exists cannot happen through the app —
       import checks the foreign key — but a row is kept rather than dropped so
       the hours in a total never disappear without explanation. */
    Object.keys(mins).forEach(function (k) {
      if (mins[k] > 0) {
        rows.push({
          id: k, name: k, colour: null, direction: 'upkeep',
          archived: false, minutes: mins[k], hours: hours(mins[k]), unknown: true
        });
      }
    });
    rows.sort(function (a, b) { return b.minutes - a.minutes || (a.name < b.name ? -1 : 1); });
    return rows;
  }

  /* One row per goal with hours in the selection, plus the "No goal" node the
     ribbon chart's goal split needs (spec §4c). */
  function totalsByGoal(entries, goals, opts) {
    var mins = minutesByKey(entries, 'goal_id');
    var rows = [];
    for (var i = 0; i < goals.length; i++) {
      var g = goals[i];
      var m = mins[g.id] || 0;
      if (m > 0 || (opts && opts.includeEmpty)) {
        rows.push({
          id: g.id, name: g.short_name, minutes: m, hours: hours(m),
          archived: !!g.archived
        });
      }
      delete mins[g.id];
    }
    /* The "No goal" node is a band like any other and sorts with them — on real
       data it is usually the largest one (spec Appendix B, item 3). */
    var none = 0;
    Object.keys(mins).forEach(function (k) { none += mins[k]; });
    if (none > 0 || (opts && opts.includeEmpty)) {
      rows.push({
        id: null, name: 'No goal', sub: 'across every category',
        minutes: none, hours: hours(none), archived: false
      });
    }
    rows.sort(function (a, b) { return b.minutes - a.minutes || (a.name < b.name ? -1 : 1); });
    return rows;
  }

  function directionOf(categories, id) {
    for (var i = 0; i < categories.length; i++) {
      if (categories[i].id === id) return categories[i].direction;
    }
    return 'upkeep';
  }

  function directionMinutes(entries, categories) {
    var out = { more: 0, less: 0, upkeep: 0 };
    for (var i = 0; i < entries.length; i++) {
      var d = directionOf(categories, entries[i].category_id);
      if (d !== 'more' && d !== 'less') d = 'upkeep';
      out[d] += Number(entries[i].duration_min) || 0;
    }
    return out;
  }

  /* spec §4b. Upkeep is the residual, never summed independently for display:
     rounding each of three parts on its own lets the labels total 101 % and the
     caption's hours miss the total by an hour. Deriving the third part from the
     first two makes both reconcile by construction. The bar's own width uses
     the unrounded remainder, clamped, so a rounding residual can never paint a
     negative segment. */
  function directionSplit(entries, categories) {
    var mins = directionMinutes(entries, categories);
    var total = mins.more + mins.less + mins.upkeep;

    var loggedT = tenths(total);
    var upT = tenths(mins.more);
    var downT = tenths(mins.less);
    var keepT = loggedT - upT - downT;

    var pct = function (m) { return total > 0 ? Math.round(m / total * 100) : 0; };
    var upPct = pct(mins.more);
    var downPct = pct(mins.less);

    var width = function (m) {
      return (total > 0 ? (m / total * 100) : 0).toFixed(3) + '%';
    };

    return {
      minutes: mins,
      totalMinutes: total,
      upHours: upT / 10,
      downHours: downT / 10,
      keepHours: keepT / 10,
      upPct: upPct,
      downPct: downPct,
      keepPct: total > 0 ? 100 - upPct - downPct : 0,
      upWidth: width(mins.more),
      downWidth: width(mins.less),
      keepWidth: width(Math.max(0, total - mins.more - mins.less))
    };
  }

  /* The donut and the "{n}% coverage · {n} h unlogged" caption (spec §4a).
     The percentage is never clamped — 105 % coverage is a real thing to say
     about a day someone over-logged — but the arc geometry is, in the chart.  */
  function coverage(minutes, dayCount, settings) {
    var totalHours = wakingHoursPerDay(settings) * Math.max(0, dayCount);
    var loggedT = tenths(minutes);
    var totalT = Math.round(totalHours * 10);
    return {
      loggedHours: loggedT / 10,
      totalHours: totalHours,
      unloggedHours: Math.max(0, totalT - loggedT) / 10,
      pct: totalHours > 0 ? Math.round(loggedT / totalT * 100) : 0
    };
  }

  /* The Log header's "{x} h accounted for, {y} to go" (spec §6). */
  function dayCoverage(entries, dayKey, settings) {
    return coverage(dayMinutes(entries, dayKey), 1, settings);
  }

  /* Decision 13: a Less category's weekly cap is its planned hours unless the
     workbook carries an explicit one. Kept as a selector so the column stays
     blank — materialising the default would change the next export. */
  function capHours(category) {
    if (!category) return 0;
    var cap = category.weekly_cap_hours;
    if (cap === null || cap === undefined || cap === '') return Number(category.weekly_plan_hours) || 0;
    return Number(cap) || 0;
  }

  function activeCategories(categories) {
    return categories.filter(function (c) { return !c.archived; });
  }

  function plannedTotal(categories) {
    return activeCategories(categories).reduce(function (n, c) {
      return n + (Number(c.weekly_plan_hours) || 0);
    }, 0);
  }

  return {
    HOURS_PER_DAY: HOURS_PER_DAY,
    HOURS_PER_WEEK: HOURS_PER_WEEK,
    DEFAULT_SLEEP_HOURS: DEFAULT_SLEEP_HOURS,
    DEFAULT_ERRANDS_HOURS: DEFAULT_ERRANDS_HOURS,
    tenths: tenths,
    hours: hours,
    formatHours: formatHours,
    hoursToMinutes: hoursToMinutes,
    parseDuration: parseDuration,
    sleepHours: sleepHours,
    wakingHoursPerDay: wakingHoursPerDay,
    wakingHoursPerWeek: wakingHoursPerWeek,
    wakingMinutesPerDay: wakingMinutesPerDay,
    inRange: inRange,
    sumMinutes: sumMinutes,
    byDay: byDay,
    dayMinutes: dayMinutes,
    weekMinutes: weekMinutes,
    distinctDays: distinctDays,
    firstDay: firstDay,
    lastDay: lastDay,
    totalsByCategory: totalsByCategory,
    totalsByGoal: totalsByGoal,
    directionMinutes: directionMinutes,
    directionSplit: directionSplit,
    coverage: coverage,
    dayCoverage: dayCoverage,
    capHours: capHours,
    activeCategories: activeCategories,
    plannedTotal: plannedTotal
  };
});
