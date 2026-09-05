// Datasets the Where-it-went specs need beyond the demo: a range with nothing
// in it, an archived category, a single category, and the QUALITY-BAR §2
// stress case (20 categories with 30-character names, 12 goals, 365 days).
//
// All derived from the real seed at the fixed reference day, so they are
// byte-identical run to run.

const seed = require('../../../seed/seed.js');
const dates = require('../../../src/core/dates.js');
const { REFERENCE_DAY, demoState } = require('./seed-state');

// The demo with no entries on 2–4 June: a range with nothing in it.
function gappedState() {
  const s = demoState();
  s.entries = s.entries.filter((e) => e.date < '2026-06-02' || e.date > '2026-06-04');
  return s;
}

// The demo with Family archived on 1 June: still in the history, out of the
// pickers (rule §8.11).
function archivedState() {
  const s = demoState();
  s.categories = s.categories.map((c) =>
    (c.id === 'cat_family' ? Object.assign({}, c, { archived: true, archived_on: '2026-06-01' }) : c));
  return s;
}

// Only Work has hours: one band.
function singleCategoryState() {
  const s = demoState();
  s.entries = s.entries.filter((e) => e.category_id === 'cat_work');
  return s;
}

const SWATCHES = ['#2b7d5d', '#2b4a7d', '#a8641d', '#6b4a7d', '#5a6b7d', '#c8291a', '#7d2b5d', '#6b6b5a', '#4a6b8a'];
const DIRECTIONS = ['more', 'less', 'upkeep'];

function pad(n, w) {
  let s = String(n);
  while (s.length < w) s = '0' + s;
  return s;
}

// Exactly thirty characters, every one of them.
function longName(prefix, i) {
  const base = `${prefix} ${pad(i, 2)} `;
  const filler = 'abcdefghijklmnopqrstuvwxyz';
  let s = base;
  while (s.length < 30) s += filler[s.length % filler.length];
  return s.slice(0, 30);
}

// QUALITY-BAR §2: 20 categories (30-character names), 12 goals (30-character
// names, each fed by a More category), 365 days of three entries a day
// ending on the reference day.
function stressState() {
  const s = seed.buildEmpty(REFERENCE_DAY);
  const categories = [];
  for (let i = 0; i < 20; i++) {
    categories.push({
      id: 'cat_s' + pad(i + 1, 2),
      name: longName('Category', i + 1),
      colour: SWATCHES[i % SWATCHES.length],
      direction: DIRECTIONS[i % 3],
      weekly_plan_hours: 3,
      weekly_cap_hours: null,
      sort: i + 1,
      archived: false,
      archived_on: null,
    });
  }
  const more = categories.filter((c) => c.direction === 'more');
  const goals = [];
  for (let i = 0; i < 12; i++) {
    goals.push({
      id: 'goal_s' + pad(i + 1, 2),
      short_name: longName('Goal', i + 1),
      identity: null,
      category_id: more[i % more.length].id,
      target_amount: 100,
      target_unit: 'h',
      by_date: '2026-12-31',
      archived: false,
    });
  }
  const entries = [];
  const today = dates.logicalDay(REFERENCE_DAY);
  let n = 0;
  for (let d = 364; d >= 0; d--) {
    const day = dates.dayKey(dates.addDays(today, -d));
    for (let k = 0; k < 3; k++) {
      const c = categories[(d * 3 + k) % 20];
      const goal = c.direction === 'more' && k === 0
        ? goals.find((g) => g.category_id === c.id) || null
        : null;
      n += 1;
      entries.push({
        id: 'e_' + pad(n, 4),
        date: day,
        duration_min: 60 + ((d + k) * 17) % 120,
        activity: k === 0 ? 'Sixty characters of activity text to stretch the Log row wide' : null,
        category_id: c.id,
        goal_id: goal ? goal.id : null,
        value: null,
        created_at: day + 'T12:00:00',
      });
    }
  }
  s.source = 'demo';
  s.categories = categories;
  s.goals = goals;
  s.entries = entries;
  s.plan = [];
  return s;
}

// Decision 27: the early estimate. The demo plus a third goal, Read the shelf,
// with three logged days — and Reading's own seed entries removed, so the
// category is as young as the goal and the goal sheet quotes an early pace too.
function earlyState() {
  const s = demoState();
  s.entries = s.entries.filter((e) => e.category_id !== 'cat_reading');
  s.goals.push({
    id: 'goal_read', short_name: 'Read the shelf', identity: null, category_id: 'cat_reading',
    target_amount: 40, target_unit: 'h', by_date: '2026-08-31', archived: false,
  });
  ['2026-06-07', '2026-06-05', '2026-06-03'].forEach((day, i) => {
    s.entries.push({
      id: `e_r${i}`, date: day, duration_min: 60, activity: 'Reading', category_id: 'cat_reading',
      goal_id: 'goal_read', value: null, created_at: `${day}T21:00:00`,
    });
  });
  return s;
}

// A goal already reached, a goal with one logged day, and a second goal on
// Learning — the states decision 27 names one by one.
function progressState() {
  const s = demoState();
  s.goals.push(
    {
      id: 'goal_walk', short_name: 'Walk the coast path', identity: null, category_id: 'cat_family',
      target_amount: 5, target_unit: 'h', by_date: '2026-06-30', archived: false,
    },
    {
      id: 'goal_pg', short_name: 'Learn Postgres', identity: null, category_id: 'cat_learn',
      target_amount: 40, target_unit: 'h', by_date: '2026-12-31', archived: false,
    },
  );
  // Six hours of Family walks banked to a five-hour goal: reached.
  s.entries.push({
    id: 'e_w1', date: '2026-06-06', duration_min: 360, activity: 'Coast path', category_id: 'cat_family',
    goal_id: 'goal_walk', value: null, created_at: '2026-06-06T18:00:00',
  });
  // One logged day on Postgres: no date yet.
  s.entries.push({
    id: 'e_p1', date: '2026-06-07', duration_min: 60, activity: 'Postgres docs', category_id: 'cat_learn',
    goal_id: 'goal_pg', value: null, created_at: '2026-06-07T10:00:00',
  });
  return s;
}

// Decision 25: a wall with more cards than fit. Forty lessons of uneven
// length — one-liners, paragraphs, some titled, some tagged, three pinned,
// two archived — so the trim, the rotation and the archive all have
// something to do.
const LINES = [
  'Log it when it ends or do not log it.',
  'Python only happens before 8am. Every evening attempt this month became scrolling, and the scrolling was never about anything.',
  'Two hours with family beat six hours of being available. Presence is not duration.',
  'The deadline was invented. The 38 hours were not wasted.',
  'A walk after lunch is worth more than the second coffee, and costs the same twenty minutes.',
  'Reading in bed does not count as reading. It counts as falling asleep with a book.',
  'The weeks with a plan on Sunday night went better. Not because of the plan. Because of the Sunday night.',
  'If the first hour of the day is mine, the rest of the day is negotiable.',
];
function manyLessonsState() {
  const s = demoState();
  const today = dates.logicalDay(REFERENCE_DAY);
  s.lessons = [];
  for (let i = 0; i < 40; i++) {
    const day = dates.addDays(today, -(i * 3 + (i % 2)));
    s.lessons.push({
      id: 'l_' + pad(i + 1, 4),
      iso_week: dates.weekKey(dates.weekStart(day)),
      date: dates.dayKey(day),
      title: i % 3 === 0 ? `Lesson ${i + 1}` : null,
      text: LINES[i % LINES.length] + (i % 5 === 4 ? ' ' + LINES[(i + 3) % LINES.length] : ''),
      tags: i % 4 === 0 ? ['goal_py'] : i % 4 === 2 ? ['cat_family', 'goal_run'] : [],
      pinned: i === 1 || i === 7 || i === 20,
      archived: i === 12 || i === 33,
    });
  }
  return s;
}

// BUILD-PLAN § Phase 5: "2,000 entries load in under 200 ms to first render".
// The seed's own eight categories and two goals, so the app behaves exactly as
// it would for the friend — only the volume is unrealistic. Five entries a day
// over four hundred days, well inside the 24 h day cap.
function perfState() {
  const s = seed.buildEmpty(REFERENCE_DAY);
  const cats = s.categories.map((c) => c.id);
  const goals = seed.GOALS.map((g) => ({
    id: g.id,
    short_name: g.short_name,
    identity: g.identity,
    category_id: g.category_id,
    target_amount: g.target_amount,
    target_unit: 'h',
    by_date: dates.dayKey(dates.addDays(dates.logicalDay(REFERENCE_DAY), g.weeks * 7)),
    archived: false,
  }));

  const entries = [];
  const today = dates.logicalDay(REFERENCE_DAY);
  const DAYS = 400;
  const PER_DAY = 5;
  for (let d = DAYS - 1; d >= 0; d--) {
    const day = dates.dayKey(dates.addDays(today, -d));
    for (let k = 0; k < PER_DAY; k++) {
      const n = entries.length;
      const cat = cats[(d * PER_DAY + k) % cats.length];
      const goal = goals.find((g) => g.category_id === cat);
      entries.push({
        id: 'e_' + pad(n + 1, 5),
        date: day,
        // 30 min to 3 h, deterministic: five of these is at most 12 h a day.
        duration_min: 30 + ((d * PER_DAY + k) * 13) % 151,
        activity: k === 0 ? 'A sixty character activity line, to load the Log row fully' : null,
        category_id: cat,
        goal_id: goal && k % 2 === 0 ? goal.id : null,
        value: null,
        created_at: day + 'T12:00:00',
      });
    }
  }

  s.source = 'demo';
  s.goals = goals;
  s.entries = entries;
  return s;
}

// Two logged days, 6 and 7 June. The calendar then has exactly one band, and
// that band carries all three cell states at once: 1-5 June before the first
// logged day, 6-7 available, 8-30 in the future. The demo shows pre-data days
// too (1-24 May), but spread over two bands; this is the one dataset where an
// unavailable day and an available one sit side by side (decision 31).
function twoDayState() {
  const s = demoState();
  s.entries = s.entries.filter((e) => e.date >= '2026-06-06');
  return s;
}

module.exports = {
  gappedState, archivedState, singleCategoryState, stressState, perfState,
  earlyState, progressState, manyLessonsState, twoDayState,
};
