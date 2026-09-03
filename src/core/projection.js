/* Meridian core — projections.
   Pure: no DOM, no storage, no clock of its own (the caller passes `now`).

   Business rule §8.4: the projection is straight-line and non-compounding —
   landing = today + (target − banked) ÷ current pace — and it is projected from
   logged hours, never from the plan.

   Pace's denominator is the decision that matters. The mockup has none, and the
   obvious readings each swing a landing date by up to twenty days depending on
   which weekday the friend first opened the app. Pace here is measured over
   WHOLE seven-day blocks:

       span   = logical today − first logged day for this subject + 1
       k      = max(1, floor(span / 7))
       window = the k×7 days ending today
       pace   = hours in that window ÷ k

   Every partial week is left out of the denominator, so the number does not
   move because a Monday arrived. Goals and categories use the identical rule;
   if they did not, the New goal sheet's reachability line and the Goals table
   would disagree two clicks apart.

   Classic <script src> -> window.Meridian.projection ; CommonJS -> module.exports */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(
    isNode ? require('./dates.js') : root.Meridian.dates,
    isNode ? require('./aggregate.js') : root.Meridian.aggregate,
    isNode ? require('./range.js') : root.Meridian.range
  );
  if (isNode) module.exports = api;
  else (root.Meridian = root.Meridian || {}).projection = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (dates, aggregate, range) {
  'use strict';

  /* BUILD-PLAN § Phase 1: a SETTLED pace needs seven logged days. Counted per
     subject, not per dataset — otherwise a goal with a single entry inside a
     busy month would project confidently from that one entry. Seven distinct
     days also span at least seven calendar days, so this satisfies spec §12's
     "once ≥1 full week exists" as well. */
  var MIN_LOGGED_DAYS = 7;

  /* Decision 27: from the second logged day there is an EARLY estimate — the
     hours so far over the calendar days so far, scaled to a week — and it is
     labelled as such until the seventh day, when the whole-week rule above
     takes over. One logged day is still nothing: a rate needs a duration. */
  var EARLY_LOGGED_DAYS = 2;

  var DAYS_PER_WEEK = 7;

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function byGoal(entries, goalId) {
    return entries.filter(function (e) { return e.goal_id === goalId; });
  }

  function byCategory(entries, categoryId) {
    return entries.filter(function (e) { return e.category_id === categoryId; });
  }

  /* Hours per week over whole seven-day blocks. `blocks` is how many whole
     weeks the window covers, and is 1 for any history shorter than a week. */
  function pace(subject, todayKey) {
    var first = aggregate.firstDay(subject);
    if (!first) return { pace: 0, blocks: 0, minutes: 0, spanDays: 0, windowStart: null };

    var span = dates.diffDays(first, todayKey) + 1;
    if (!(span > 0)) return { pace: 0, blocks: 0, minutes: 0, spanDays: 0, windowStart: null };

    var blocks = Math.max(1, Math.floor(span / DAYS_PER_WEEK));
    var windowStart = dates.dayKey(dates.addDays(todayKey, -(blocks * DAYS_PER_WEEK - 1)));
    var minutes = aggregate.sumMinutes(aggregate.inRange(subject, windowStart, todayKey));

    return {
      pace: Math.round(aggregate.hours(minutes) / blocks * 100) / 100,
      blocks: blocks,
      minutes: minutes,
      spanDays: span,
      windowStart: windowStart
    };
  }

  /* The pace behind a projection, and how much to trust it (decision 27):

       settled  seven or more logged days — whole seven-day blocks, pace()
       early    two to six — hours so far ÷ calendar days since the first
                entry × 7, flagged so every screen can say so
       none     fewer than two — no rate, no date

     Calendar days, not logged days, in the early denominator: it is the same
     denominator the settled rule uses (whole weeks of calendar time), so the
     figure does not halve on the seventh day for someone who logs twice a
     week. The label counts logged days, because that is what the gate counts
     and what the owner can do something about. */
  function paceMode(subject, todayKey) {
    var loggedDays = aggregate.distinctDays(subject);
    if (loggedDays >= MIN_LOGGED_DAYS) {
      var p = pace(subject, todayKey);
      return { mode: 'settled', early: false, loggedDays: loggedDays,
        pace: p.pace, blocks: p.blocks, days: p.spanDays };
    }
    if (loggedDays >= EARLY_LOGGED_DAYS) {
      var first = aggregate.firstDay(subject);
      var span = dates.diffDays(first, todayKey) + 1;
      if (!(span >= loggedDays)) span = loggedDays;
      var hours = aggregate.hours(aggregate.sumMinutes(subject));
      return { mode: 'early', early: true, loggedDays: loggedDays,
        pace: round2(hours / span * DAYS_PER_WEEK), blocks: 0, days: span };
    }
    return { mode: 'none', early: false, loggedDays: loggedDays, pace: 0, blocks: 0, days: 0 };
  }

  /* "early estimate — 3 days": the one string the Goals table, the goal
     sheet, the entry sheet and Progress all show, built here so it cannot be
     four strings. Null when the pace is settled or absent. */
  function earlyLabel(p) {
    if (!p || !p.early) return null;
    return 'early estimate — ' + p.loggedDays + ' days';
  }

  function goalPace(entries, goalId, todayKey) {
    return pace(byGoal(entries, goalId), todayKey);
  }

  /* The New goal sheet's "You've given Learning 7.0 h a week for 11 weeks"
     (spec §6) — same window, category as the subject. Returns numbers; the
     sentence is assembled in the UI. */
  function categoryPace(entries, categoryId, todayKey) {
    return pace(byCategory(entries, categoryId), todayKey);
  }

  /* Consecutive ISO weeks, counted backwards, that carry at least one entry for
     this goal.

     The current week is given grace: on a Monday morning, before anything is
     logged, a naive count would read zero and a visible streak would collapse
     and reappear a few hours later. If the current week is still empty the
     count starts at the week before instead. */
  function weeksRunning(entries, goalId, todayKey) {
    var subject = byGoal(entries, goalId);
    if (!subject.length) return 0;

    var weeks = Object.create(null);
    for (var i = 0; i < subject.length; i++) {
      var d = dates.parseDayKey(subject[i].date);
      if (d) weeks[dates.weekKey(d)] = 1;
    }

    var cursor = dates.weekStart(todayKey);
    if (!weeks[dates.weekKey(cursor)]) cursor = dates.addDays(cursor, -DAYS_PER_WEEK);

    var n = 0;
    while (weeks[dates.weekKey(cursor)]) {
      n++;
      cursor = dates.addDays(cursor, -DAYS_PER_WEEK);
    }
    return n;
  }

  function findGoal(goals, goalId) {
    for (var i = 0; i < goals.length; i++) if (goals[i].id === goalId) return goals[i];
    return null;
  }

  /* Everything the Goals table and the entry sheet's SAVING THIS MOVES preview
     need for one goal.

     Edge cases are decided here rather than left to each caller:
       no pace yet   -> landing null, slippage null (never Infinity)
       already there -> landing null, slippage 0, progress may exceed 100
       date passed   -> required null (never a negative rate per week) */
  function project(state, goalId, now) {
    var todayKey = dates.dayKey(dates.logicalDay(now));
    var goal = findGoal(state.goals || [], goalId);
    if (!goal) return null;

    var subject = byGoal(state.entries || [], goalId);
    var bankedHours = aggregate.hours(aggregate.sumMinutes(subject));
    var target = Number(goal.target_amount) || 0;
    var remaining = Math.max(0, Math.round((target - bankedHours) * 100) / 100);
    var done = bankedHours >= target && target > 0;

    var p = paceMode(subject, todayKey);
    var loggedDays = p.loggedDays;
    var enoughHistory = p.mode !== 'none';
    var rate = p.pace;

    var landing = null, landingDays = null;
    if (!done && enoughHistory && rate > 0) {
      /* Rounded before the ceiling: 116 / 7 * 7 is 116.00000000000001 in binary
         floating point, and a bare Math.ceil would put the landing date a whole
         day later for no reason a reader could ever find. */
      var exactDays = Math.round(remaining / rate * DAYS_PER_WEEK * 1e6) / 1e6;
      landingDays = Math.ceil(exactDays);
      landing = dates.addDays(todayKey, landingDays);
    }

    var byDate = dates.parseDayKey(goal.by_date);
    var daysLeft = byDate ? dates.diffDays(todayKey, byDate) : null;

    var required = null;
    if (!done && byDate && daysLeft > 0) {
      required = Math.round(remaining / (daysLeft / DAYS_PER_WEEK) * 100) / 100;
    }

    var slippage = null;
    if (done) slippage = 0;
    else if (landing && byDate) slippage = dates.diffDays(byDate, landing);

    return {
      goal: goal,
      banked: bankedHours,
      target: target,
      remaining: remaining,
      done: done,
      progressPct: target > 0 ? Math.round(bankedHours / target * 100) : 0,
      loggedDays: loggedDays,
      enoughHistory: enoughHistory,
      mode: p.mode,
      early: p.early,
      settled: p.mode === 'settled',
      pace: rate,
      paceBlocks: p.blocks,
      paceDays: p.days,
      required: required,
      byDate: byDate,
      daysLeft: daysLeft,
      landing: landing,
      landingDays: landingDays,
      slippageDays: slippage,
      weeksRunning: weeksRunning(state.entries || [], goalId, todayKey)
    };
  }

  /* The entry sheet's "SAVING THIS MOVES ... Lands 14 Oct → 11 Oct" (spec §6):
     the same projection with one entry that does not exist yet.

     Pace is recomputed rather than held fixed, because the caption the mockup
     puts under the projection is "Projected from logged hours" — an hour logged
     today changes the pace as well as the bank, and showing only the bank
     moving would be a different, quieter lie. */
  function projectWithDelta(state, goalId, addedMinutes, now, opts) {
    var goal = findGoal(state.goals || [], goalId);
    if (!goal) return null;
    var dayKey = (opts && opts.date) || dates.dayKey(dates.logicalDay(now));
    var next = {
      goals: state.goals,
      entries: (state.entries || []).concat([{
        id: '__preview__',
        date: dayKey,
        duration_min: Math.max(0, Math.round(Number(addedMinutes) || 0)),
        category_id: goal.category_id,
        goal_id: goalId
      }])
    };
    return project(next, goalId, now);
  }

  /* ---------- the Progress chart (decision 27) ----------
     One goal's line: the hours banked, adding up day by day from the first
     entry to today, and the straight projection on to the landing. Points
     are (day key, hours); the chart scales them to percent of target itself,
     so a 60-hour and a 130-hour goal can share one axis.

     The history starts at zero on the day before the first entry, so the
     line rises out of the axis rather than appearing mid-air, and it always
     ends on today, flat if nothing was logged since, so "to today" is what
     the chart shows rather than what the caption claims. */
  function series(state, goalId, now) {
    var row = project(state, goalId, now);
    if (!row) return null;
    var todayKey = dates.dayKey(dates.logicalDay(now));
    var totals = aggregate.byDay(byGoal(state.entries || [], goalId));
    var days = Object.keys(totals).filter(function (d) { return d <= todayKey; }).sort();

    var points = [];
    if (days.length) {
      points.push({ day: dates.dayKey(dates.addDays(days[0], -1)), hours: 0 });
      var cum = 0;
      days.forEach(function (d) {
        cum += totals[d];
        points.push({ day: d, hours: aggregate.hours(cum) });
      });
      if (days[days.length - 1] !== todayKey) points.push({ day: todayKey, hours: aggregate.hours(cum) });
    }

    var landingKey = row.landing ? dates.dayKey(row.landing) : null;
    return {
      goal: row.goal,
      row: row,
      points: points,
      projection: landingKey ? {
        from: { day: todayKey, hours: row.banked },
        to: { day: landingKey, hours: row.target }
      } : null,
      target: row.target,
      byDate: row.byDate ? dates.dayKey(row.byDate) : null,
      landing: landingKey,
      late: row.slippageDays !== null && row.slippageDays > 0,
      done: row.done,
      early: row.early
    };
  }

  /* ---------- the Goals screen (spec §4h, §6, §12) ---------- */

  function categoryOf(state, categoryId) {
    var list = state.categories || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === categoryId) return list[i];
    return null;
  }

  /* One projection per goal, live first and archived after, each row carrying
     the category that feeds it. The screen does no arithmetic of its own: the
     table and the entry sheet's SAVING THIS MOVES read the same `project()`,
     so two clicks apart they cannot disagree.

     Within each half the order is the state's own, which workbook.canonical
     fixes, so a row never moves because something else was edited. */
  function goalRows(state, now) {
    var live = [];
    var archived = [];
    (state.goals || []).forEach(function (g) {
      var row = project(state, g.id, now);
      if (!row) return;
      row.category = categoryOf(state, g.category_id);
      (g.archived ? archived : live).push(row);
    });
    return live.concat(archived);
  }

  /* The headline's "Three open. One slipping." (spec §6). Slipping is a live
     goal whose landing falls after the date it was given; a goal with too
     little history to project is neither slipping nor on time, so it counts as
     open and nothing more. */
  function goalCounts(state, now) {
    var open = 0, slipping = 0, archived = 0;
    goalRows(state, now).forEach(function (row) {
      if (row.goal.archived) { archived++; return; }
      open++;
      if (row.slippageDays !== null && row.slippageDays > 0) slipping++;
    });
    return { open: open, slipping: slipping, archived: archived };
  }

  /* The New goal sheet's IS THAT REACHABLE (spec §6):

       "You've given Learning 7.0 h a week for 11 weeks. This needs 10.0 h."
       "At 7.0 h it lands 14 Oct. Meridian will keep both dates in view
        instead of just the one you typed."

     The pace quoted is the FEEDING CATEGORY's, not the goal's — that is what
     the copy says, and a goal being created has no history of its own to
     quote. `banked` is zero for a new goal and the goal's own hours when an
     existing one is being edited, so the sentence stays true after two weeks
     of logging rather than restating the untouched target.

     Takes a draft rather than a saved goal, so the panel answers while the
     owner is still typing. */
  function reachability(state, draft, now) {
    var todayKey = dates.dayKey(dates.logicalDay(now));
    var categoryId = draft && draft.category_id;
    var category = categoryOf(state, categoryId);

    var entries = state.entries || [];
    var subject = categoryId ? byCategory(entries, categoryId) : [];
    var p = paceMode(subject, todayKey);
    var loggedDays = p.loggedDays;
    var hasHistory = p.mode !== 'none';
    var rate = p.pace;

    var banked = draft && draft.id
      ? aggregate.hours(aggregate.sumMinutes(byGoal(entries, draft.id)))
      : 0;
    var target = Number(draft && draft.target_amount) || 0;
    var remaining = Math.max(0, Math.round((target - banked) * 100) / 100);
    var done = target > 0 && banked >= target;

    var byDate = dates.parseDayKey(draft && draft.by_date);
    var daysLeft = byDate ? dates.diffDays(todayKey, byDate) : null;

    var required = null;
    if (!done && byDate && daysLeft > 0) {
      required = Math.round(remaining / (daysLeft / DAYS_PER_WEEK) * 100) / 100;
    }

    /* The same arithmetic as project(), on the category's pace: the date the
       goal lands if the category keeps doing what it has been doing. */
    var landing = null;
    if (!done && rate > 0) {
      var exactDays = Math.round(remaining / rate * DAYS_PER_WEEK * 1e6) / 1e6;
      landing = dates.addDays(todayKey, Math.ceil(exactDays));
    }

    return {
      category: category,
      hasHistory: hasHistory,
      loggedDays: loggedDays,
      mode: p.mode,
      early: p.early,
      settled: p.mode === 'settled',
      pace: rate,
      paceBlocks: p.blocks,
      paceDays: p.days,
      banked: banked,
      target: target,
      remaining: remaining,
      done: done,
      byDate: byDate,
      daysLeft: daysLeft,
      required: required,
      landing: landing
    };
  }

  /* Business rule §8.15: the analysis range is clamped to [first data day,
     today] and future days are never selectable. The rule itself lives in
     range.js since Phase 3 built the calendar; this is the same rule with the
     clock resolved, kept so there is one implementation, not two. */
  function clampRange(state, rng, now) {
    var todayKey = dates.dayKey(dates.logicalDay(now));
    var b = range.bounds(state.entries || [], todayKey);
    return range.clamp(rng, b.minDay, b.today);
  }

  return {
    MIN_LOGGED_DAYS: MIN_LOGGED_DAYS,
    EARLY_LOGGED_DAYS: EARLY_LOGGED_DAYS,
    pace: pace,
    paceMode: paceMode,
    earlyLabel: earlyLabel,
    series: series,
    goalPace: goalPace,
    categoryPace: categoryPace,
    weeksRunning: weeksRunning,
    project: project,
    projectWithDelta: projectWithDelta,
    goalRows: goalRows,
    goalCounts: goalCounts,
    reachability: reachability,
    clampRange: clampRange
  };
});
