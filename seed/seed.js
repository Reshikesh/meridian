/* Meridian — the demo dataset, and the eight categories a fresh dataset starts
   from (decision 9).

   Built relative to the day the app is first opened, and shaped BY WEEKDAY
   rather than by an offset from today. Fourteen consecutive days ending today
   contain exactly two of every weekday, so a week always sums to the same
   figure whichever day the friend first opens it. Keying the shape to "13 days
   ago" instead would make "a complete week is 95 h" true one day in seven.

   Today is deliberately part-logged — the day is still going — and the entries
   dropped from it are never the ones carrying a goal, so banked hours, pace and
   both landing dates are identical on all seven possible first-run weekdays.

   Arithmetic the unit test pins:
     complete week      95.0 h, no day over 15.0 h (the cap is 16 h, decision 17)
     Learn Python       12.0 h banked, 6.0 h/wk, needs 7.4 — lands 26 days late
     Half-marathon      6.0 h banked, 3.0 h/wk, needs 2.7 — lands 14 days early

   Classic <script src> -> window.MERIDIAN_SEED ; CommonJS -> module.exports */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(isNode ? require('../src/core/dates.js') : root.Meridian.dates);
  if (isNode) module.exports = api;
  else root.MERIDIAN_SEED = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (dates) {
  'use strict';

  /* Decision 9: the eight sample categories, with the colours and planned hours
     of spec §9. The seven discretionary rows total 52, which is spec §9's own
     figure; how the v1.5 Plan screen breaks 168 down is its own question now
     that there is no sleep setting (decision 17, as amended). */
  var CATEGORIES = [
    { id: 'cat_work', name: 'Work', colour: '#2b7d5d', direction: 'upkeep', weekly_plan_hours: 45, sort: 1 },
    { id: 'cat_scroll', name: 'Scrolling', colour: '#c8291a', direction: 'less', weekly_plan_hours: 14, sort: 2 },
    { id: 'cat_family', name: 'Family', colour: '#a8641d', direction: 'more', weekly_plan_hours: 12, sort: 3 },
    { id: 'cat_tv', name: 'Idle TV', colour: '#7d2b5d', direction: 'less', weekly_plan_hours: 8, sort: 4 },
    { id: 'cat_learn', name: 'Learning', colour: '#2b4a7d', direction: 'more', weekly_plan_hours: 7, sort: 5 },
    { id: 'cat_exercise', name: 'Exercise', colour: '#6b4a7d', direction: 'more', weekly_plan_hours: 5, sort: 6 },
    { id: 'cat_reading', name: 'Reading', colour: '#5a6b7d', direction: 'more', weekly_plan_hours: 3, sort: 7 },
    { id: 'cat_else', name: 'Everything else', colour: '#6b6b5a', direction: 'upkeep', weekly_plan_hours: 3, sort: 8 }
  ];

  /* Decision 20: two goals, hours only, dated from the day of first run. */
  var GOALS = [
    {
      id: 'goal_py',
      short_name: 'Learn Python',
      identity: 'someone who can build their own tools',
      category_id: 'cat_learn',
      target_amount: 130,
      weeks: 16
    },
    {
      id: 'goal_run',
      short_name: 'Half-marathon training',
      identity: 'someone who runs in the mornings',
      category_id: 'cat_exercise',
      target_amount: 60,
      weeks: 20
    }
  ];

  /* Monday = 0 (decision 18). Minutes, not hours: the store is integer minutes
     and a 0.5 h that becomes 30 min in one place and 29.999 in another is the
     bug this avoids. `at` is the hour the row was written, used for created_at
     — plausible, and always well clear of the 04:00 boundary. */
  var WEEK = [
    [ // Monday — 15.0 h
      { cat: 'cat_work', min: 540, activity: 'Client review & follow-ups', at: 18 },
      { cat: 'cat_learn', min: 90, activity: 'Python — async chapter', goal: 'goal_py', at: 8 },
      { cat: 'cat_exercise', min: 30, activity: 'Walk after lunch', goal: 'goal_run', at: 13 },
      { cat: 'cat_family', min: 60, activity: 'Dinner with Priya', at: 20 },
      { cat: 'cat_scroll', min: 120, activity: 'Phone, no reason', at: 22 },
      { cat: 'cat_tv', min: 60, activity: 'Evening episode', at: 23 }
    ],
    [ // Tuesday — 15.0 h
      { cat: 'cat_work', min: 540, activity: 'Sprint planning & code review', at: 18 },
      { cat: 'cat_learn', min: 60, activity: 'Python — exercises', goal: 'goal_py', at: 8 },
      { cat: 'cat_family', min: 60, activity: 'Dinner with Priya', at: 20 },
      { cat: 'cat_reading', min: 30, activity: 'Novel before bed', at: 23 },
      { cat: 'cat_scroll', min: 120, activity: 'Phone, no reason', at: 22 },
      { cat: 'cat_tv', min: 90, activity: 'Evening episode', at: 21 }
    ],
    [ // Wednesday — 14.5 h
      { cat: 'cat_work', min: 540, activity: 'Client review & follow-ups', at: 18 },
      { cat: 'cat_learn', min: 60, activity: 'Python — async chapter', goal: 'goal_py', at: 8 },
      { cat: 'cat_exercise', min: 30, activity: 'Walk after lunch', goal: 'goal_run', at: 13 },
      { cat: 'cat_family', min: 60, activity: 'Dinner with Priya', at: 20 },
      { cat: 'cat_scroll', min: 120, activity: 'Phone, no reason', at: 22 },
      { cat: 'cat_tv', min: 60, activity: 'Evening episode', at: 23 }
    ],
    [ // Thursday — 15.0 h
      { cat: 'cat_work', min: 540, activity: 'Backlog triage & email', at: 18 },
      { cat: 'cat_learn', min: 60, activity: 'Python — exercises', goal: 'goal_py', at: 8 },
      { cat: 'cat_exercise', min: 30, activity: 'Walk after lunch', goal: 'goal_run', at: 13 },
      { cat: 'cat_family', min: 60, activity: 'Dinner with Priya', at: 20 },
      { cat: 'cat_scroll', min: 120, activity: 'Phone, no reason', at: 22 },
      { cat: 'cat_tv', min: 90, activity: 'Evening episode', at: 21 }
    ],
    [ // Friday — 15.0 h
      { cat: 'cat_work', min: 480, activity: 'Client review & follow-ups', at: 17 },
      { cat: 'cat_learn', min: 30, activity: 'Python — reading the docs', goal: 'goal_py', at: 8 },
      { cat: 'cat_family', min: 90, activity: 'Dinner with Priya', at: 20 },
      { cat: 'cat_else', min: 60, activity: 'Laundry and shopping', at: 19 },
      { cat: 'cat_scroll', min: 150, activity: 'Phone, no reason', at: 22 },
      { cat: 'cat_tv', min: 90, activity: 'Evening episode', at: 23 }
    ],
    [ // Saturday — 12.0 h
      { cat: 'cat_family', min: 210, activity: 'Morning with the kids', at: 10 },
      { cat: 'cat_exercise', min: 90, activity: 'Long run', goal: 'goal_run', at: 8 },
      { cat: 'cat_reading', min: 60, activity: 'Novel in the garden', at: 15 },
      { cat: 'cat_else', min: 120, activity: 'Errands and admin', at: 13 },
      { cat: 'cat_scroll', min: 150, activity: 'Phone, no reason', at: 21 },
      { cat: 'cat_tv', min: 90, activity: 'Film in the evening', at: 22 }
    ],
    [ // Sunday — 8.5 h
      { cat: 'cat_family', min: 120, activity: 'Lunch with family', at: 14 },
      { cat: 'cat_learn', min: 60, activity: 'Python — async chapter', goal: 'goal_py', at: 9 },
      { cat: 'cat_exercise', min: 120, activity: 'Walk in the park', at: 11 },
      { cat: 'cat_reading', min: 30, activity: 'Novel before bed', at: 22 },
      { cat: 'cat_scroll', min: 120, activity: 'Phone, no reason', at: 21 },
      { cat: 'cat_tv', min: 60, activity: 'Evening episode', at: 20 }
    ]
  ];

  var DAYS = 14;

  /* Today is still in progress. What survives is the part of a day that happens
     before the evening — and, deliberately, every row that carries a goal, so
     the projections do not move with the weekday of first run. */
  var TODAY_CATEGORIES = ['cat_work', 'cat_family', 'cat_learn', 'cat_exercise'];

  var LESSONS = [
    {
      id: 'l_01',
      weeksAgo: 1,
      text: 'Python only happens before 8am. Every evening attempt this month became scrolling.',
      tags: ['goal_py']
    },
    {
      id: 'l_02',
      weeksAgo: 2,
      text: 'Two hours with family beat six hours of "available". Presence is not duration.',
      tags: ['cat_family']
    }
  ];

  function pad4(n) {
    var s = String(n);
    while (s.length < 4) s = '0' + s;
    return s;
  }

  function categories() {
    return CATEGORIES.map(function (c) {
      return {
        id: c.id,
        name: c.name,
        colour: c.colour,
        direction: c.direction,
        weekly_plan_hours: c.weekly_plan_hours,
        weekly_cap_hours: null,            // decision 13: blank means the plan
        sort: c.sort,
        archived: false,
        archived_on: null
      };
    });
  }

  function plan(effectiveFrom) {
    return CATEGORIES.map(function (c) {
      return {
        category_id: c.id,
        planned_hours: c.weekly_plan_hours,
        week_effective_from: effectiveFrom
      };
    });
  }

  function settings(theme) {
    return {
      theme: theme || 'paper',
      day_boundary: '04:00',
      errands_hours_per_week: 15,
      week_start: 'monday'
    };
  }

  /* The eight categories and their plan, nothing else — "Start empty". */
  function buildEmpty(now, opts) {
    var today = dates.logicalDay(now || new Date());
    return {
      version: 1,
      source: 'empty',
      settings: settings(opts && opts.theme),
      categories: categories(),
      goals: [],
      entries: [],
      plan: plan(dates.dayKey(dates.weekStart(today))),
      lessons: [],
      exportInfo: { unexported: 0, exported_at: null }
    };
  }

  function buildDemo(now, opts) {
    var today = dates.logicalDay(now || new Date());
    var todayKey = dates.dayKey(today);
    var firstDay = dates.addDays(today, -(DAYS - 1));

    var entries = [];
    var n = 0;

    for (var i = 0; i < DAYS; i++) {
      var day = dates.addDays(firstDay, i);
      var key = dates.dayKey(day);
      var isToday = key === todayKey;
      var template = WEEK[dates.weekdayIndex(day)];

      for (var j = 0; j < template.length; j++) {
        var t = template[j];
        if (isToday && TODAY_CATEGORIES.indexOf(t.cat) === -1) continue;
        n += 1;
        entries.push({
          id: 'e_' + pad4(n),
          date: key,
          duration_min: t.min,
          activity: t.activity,
          category_id: t.cat,
          goal_id: t.goal || null,
          value: null,
          created_at: dates.isoDateTime(
            new Date(day.getFullYear(), day.getMonth(), day.getDate(), t.at, (j * 7) % 60, 0))
        });
      }
    }

    var goals = GOALS.map(function (g) {
      return {
        id: g.id,
        short_name: g.short_name,
        identity: g.identity,
        category_id: g.category_id,
        target_amount: g.target_amount,
        target_unit: 'h',
        by_date: dates.dayKey(dates.addDays(today, g.weeks * 7)),
        archived: false
      };
    });

    var lessons = LESSONS.map(function (l) {
      var monday = dates.addDays(dates.weekStart(today), -7 * l.weeksAgo);
      var sunday = dates.addDays(monday, 6);
      return {
        id: l.id,
        iso_week: dates.weekKey(monday),
        date: dates.dayKey(sunday),
        text: l.text,
        tags: l.tags.slice()
      };
    });

    return {
      version: 1,
      source: 'demo',
      settings: settings(opts && opts.theme),
      categories: categories(),
      goals: goals,
      entries: entries,
      plan: plan(dates.dayKey(dates.weekStart(firstDay))),
      lessons: lessons,
      exportInfo: { unexported: 0, exported_at: null }
    };
  }

  return {
    CATEGORIES: CATEGORIES,
    GOALS: GOALS,
    WEEK: WEEK,
    DAYS: DAYS,
    TODAY_CATEGORIES: TODAY_CATEGORIES,
    categories: categories,
    plan: plan,
    settings: settings,
    buildDemo: buildDemo,
    buildEmpty: buildEmpty
  };
});
