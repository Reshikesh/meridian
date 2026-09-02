/* Meridian core — aggregation.
   Pure: no DOM, no storage, no clock of its own.

   Every "accounted for / to go / coverage / unlogged / of N h" figure in the app
   is computed here against the whole day: 24 h, and 168 h a week (decision 17,
   as amended). There is no sleep setting. A day is as long as a day is, and
   sleep is an ordinary category for anyone who wants to log it — a fixed
   nightly figure would be wrong on most nights and would need editing on the
   rest.

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
  var MINUTES_PER_DAY = HOURS_PER_DAY * 60;
  var DEFAULT_ERRANDS_HOURS = 15;   // spec §7 Settings default; the v1.5 Plan screen's

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
  function coverage(minutes, dayCount) {
    var totalHours = HOURS_PER_DAY * Math.max(0, dayCount);
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
  function dayCoverage(entries, dayKey) {
    return coverage(dayMinutes(entries, dayKey), 1);
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

  /* ---------- the Where-it-went screen (spec §4a–§4d) ---------- */

  function categoryNamed(categories, id) {
    for (var i = 0; i < (categories || []).length; i++) {
      if (categories[i].id === id) return categories[i].name;
    }
    return null;
  }

  function goalNamed(goals, id) {
    for (var i = 0; i < (goals || []).length; i++) if (goals[i].id === id) return goals[i];
    return null;
  }

  /* The ribbon chart's nodes (mockup buildNodes, on real data). Category split:
     every category with hours in the selection, archived ones included
     (§8.11). Goal split: every goal with hours plus the "No goal" node; a
     goal's sub-line is the name of the category that feeds it. Goal bands are
     always More and "No goal" is always Upkeep, exactly as the mockup colours
     them. Node ids are 'cat:<id>', 'goal:<id>' and 'goal:none'.

     Ascending is the mockup's default: smallest at the top, the biggest band
     at the bottom. Ties break by name so the order is stable. */
  function chartNodes(entries, categories, goals, split, sort) {
    var nodes;
    if (split === 'goal') {
      nodes = totalsByGoal(entries, goals).map(function (r) {
        var goal = r.id ? goalNamed(goals, r.id) : null;
        return {
          id: r.id ? 'goal:' + r.id : 'goal:none',
          name: r.name,
          sub: r.id ? categoryNamed(categories, goal && goal.category_id) : r.sub,
          direction: r.id ? 'more' : 'upkeep',
          minutes: r.minutes,
          hours: r.hours,
          archived: r.archived
        };
      });
    } else {
      nodes = totalsByCategory(entries, categories).map(function (r) {
        return {
          id: 'cat:' + r.id,
          name: r.name,
          sub: null,
          direction: r.direction === 'more' || r.direction === 'less' ? r.direction : 'upkeep',
          minutes: r.minutes,
          hours: r.hours,
          archived: r.archived
        };
      });
    }
    var dir = sort === 'desc' ? -1 : 1;
    nodes.sort(function (a, b) {
      return dir * (a.minutes - b.minutes) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    });
    return nodes;
  }

  function nodeMatches(entry, nodeId) {
    if (nodeId === 'goal:none') return !entry.goal_id;
    var p = nodeId.indexOf(':');
    var kind = nodeId.slice(0, p), id = nodeId.slice(p + 1);
    if (kind === 'cat') return entry.category_id === id;
    if (kind === 'goal') return entry.goal_id === id;
    return false;
  }

  /* spec §4d: with a band focused, each in-range day is shaded by that node's
     hours on the day, against the node's busiest day over the FULL history —
     not the range — so the shading is comparable from one range to the next.
     Days after `today` cannot be shown, so they do not set the maximum. */
  function heat(entries, nodeId, today) {
    var byDayMap = Object.create(null), max = 0;
    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      if (today && e.date > today) continue;
      if (!nodeMatches(e, nodeId)) continue;
      var m = (byDayMap[e.date] || 0) + (Number(e.duration_min) || 0);
      byDayMap[e.date] = m;
      if (m > max) max = m;
    }
    return { byDay: byDayMap, max: max };
  }

  /* Everything the screen's header needs for one range. */
  function rangeSummary(entries, categories, range) {
    var selected = inRange(entries, range.start, range.end);
    var days = dates.daySpan(range.start, range.end) || 0;
    var minutes = sumMinutes(selected);
    return {
      days: days,
      entries: selected,
      minutes: minutes,
      hours: hours(minutes),
      coverage: coverage(minutes, days),
      split: directionSplit(selected, categories)
    };
  }

  /* One decimal with a thousands separator: `1,019.0`. The mockup groups
     thousands (`2,044 hours logged`); QUALITY-BAR §1 wants one decimal
     everywhere. Deterministic, so a test never depends on the locale. */
  function groupTenths(t) {
    var neg = t < 0;
    t = Math.abs(t);
    var whole = String(Math.floor(t / 10)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-' : '') + whole + '.' + (t % 10);
  }

  function formatHoursGrouped(minutes) {
    return groupTenths(tenths(minutes));
  }

  function groupHours(h) {
    return groupTenths(Math.round((Number(h) || 0) * 10));
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
    MINUTES_PER_DAY: MINUTES_PER_DAY,
    DEFAULT_ERRANDS_HOURS: DEFAULT_ERRANDS_HOURS,
    tenths: tenths,
    hours: hours,
    formatHours: formatHours,
    hoursToMinutes: hoursToMinutes,
    parseDuration: parseDuration,
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
    plannedTotal: plannedTotal,
    chartNodes: chartNodes,
    heat: heat,
    rangeSummary: rangeSummary,
    formatHoursGrouped: formatHoursGrouped,
    groupHours: groupHours
  };
});
