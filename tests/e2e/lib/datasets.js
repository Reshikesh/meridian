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

module.exports = { gappedState, archivedState, singleCategoryState, stressState };
