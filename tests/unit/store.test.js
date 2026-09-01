'use strict';

const test = require('node:test');
const assert = require('node:assert');
const store = require('../../src/store.js');
const seed = require('../../seed/seed.js');
const workbook = require('../../src/core/workbook.js');

const NOW = new Date(2026, 5, 7, 12, 0, 0);
const clock = () => NOW;

// A localStorage that can be inspected, and made to fail on demand.
function fakeStorage(opts) {
  const map = new Map();
  return {
    map,
    available: opts && opts.available === false ? false : true,
    failWith: opts && opts.failWith,
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) {
      if (this.failWith) return { ok: false, reason: this.failWith };
      map.set(k, String(v));
      return { ok: true };
    },
    removeItem(k) { map.delete(k); return { ok: true }; },
  };
}

function loaded(storage) {
  const s = store.createStore({ storage: storage || fakeStorage(), now: clock });
  s.replaceAll(seed.buildDemo(NOW), 'demo');
  return s;
}

const saved = (storage) => JSON.parse(storage.getItem('meridian:data'));

test('an empty browser is first run; a saved dataset is not', async (t) => {
  await t.test('nothing saved means no state', () => {
    const s = store.createStore({ storage: fakeStorage(), now: clock });
    assert.equal(s.load(), null);
    assert.equal(s.hasData(), false);
  });

  await t.test('a saved dataset loads before anything renders', () => {
    const storage = fakeStorage();
    const first = loaded(storage);
    const reopened = store.createStore({ storage, now: clock });
    assert.ok(reopened.load(), 'load() returns the state, not a promise for it');
    assert.equal(reopened.hasData(), true);
    assert.deepEqual(reopened.getState(), first.getState());
  });

  await t.test('unreadable saved data starts fresh without destroying it', () => {
    const storage = fakeStorage();
    storage.setItem('meridian:data', '{not json');
    const s = store.createStore({ storage, now: clock });
    assert.equal(s.load(), null);
    assert.equal(s.getError().code, 'corrupt');
    assert.equal(storage.getItem('meridian:data'), '{not json',
      'the bad value is left alone; a hand-recovery is still possible');
  });

  await t.test('saved data that is not a dataset is ignored', () => {
    const storage = fakeStorage();
    storage.setItem('meridian:data', '{"hello":"world"}');
    assert.equal(store.createStore({ storage, now: clock }).load(), null);
  });
});

test('every mutation reaches storage in the same call (QUALITY-BAR §6)', async (t) => {
  await t.test('an entry is on disk before addEntry returns', () => {
    const storage = fakeStorage();
    const s = loaded(storage);
    const before = s.getState().entries.length;
    s.addEntry({ date: '2026-06-07', duration_min: 30, activity: 'x', category_id: 'cat_learn' });
    assert.equal(saved(storage).entries.length, before + 1, 'nothing is deferred to an effect');
  });

  await t.test('a failed write is surfaced, not swallowed', () => {
    const storage = fakeStorage();
    const s = loaded(storage);
    storage.failWith = 'full';
    const res = s.addEntry({ date: '2026-06-07', duration_min: 30, category_id: 'cat_learn' });
    assert.equal(res.ok, false);
    assert.equal(s.getError().code, 'full');
    assert.match(s.getError().message, /Export your workbook now/);
    assert.equal(s.getState().entries.length, saved(storage).entries.length + 1,
      'the change is on screen; the friend is told it is not saved');
  });

  await t.test('a browser with storage switched off says so', () => {
    const s = store.createStore({ storage: fakeStorage({ available: false }), now: clock });
    s.load();
    assert.equal(s.getError().code, 'unavailable');
  });

  await t.test('subscribers hear about every change', () => {
    const s = loaded();
    let calls = 0;
    const off = s.subscribe(() => { calls += 1; });
    s.addEntry({ date: '2026-06-07', duration_min: 30, category_id: 'cat_learn' });
    s.deleteEntry(s.getState().entries[0].id);
    assert.equal(calls, 2);
    off();
    s.addEntry({ date: '2026-06-07', duration_min: 30, category_id: 'cat_learn' });
    assert.equal(calls, 2, 'unsubscribing works');
  });
});

test('the unexported counter tells the truth', async (t) => {
  await t.test('demo data opens at zero: it is regenerable, not unsaved work', () => {
    const s = loaded();
    assert.equal(s.getState().exportInfo.unexported, 0);
  });

  await t.test('each edit counts one', () => {
    const s = loaded();
    s.addEntry({ date: '2026-06-07', duration_min: 30, category_id: 'cat_learn' });
    s.addCategory({ name: 'Volunteering', direction: 'more', weekly_plan_hours: 2 });
    assert.equal(s.getState().exportInfo.unexported, 2);
  });

  await t.test('a completed import is one change, not one per row', () => {
    const s = loaded();
    s.replaceAll(seed.buildDemo(NOW), 'import');
    assert.equal(s.getState().exportInfo.unexported, 1);
  });

  await t.test('exporting clears it and stamps the time', () => {
    const storage = fakeStorage();
    const s = loaded(storage);
    s.addEntry({ date: '2026-06-07', duration_min: 30, category_id: 'cat_learn' });
    s.markExported(NOW);
    assert.equal(s.getState().exportInfo.unexported, 0);
    assert.equal(s.getState().exportInfo.exported_at, '2026-06-07T12:00:00');
    assert.equal(saved(storage).exportInfo.unexported, 0, 'and it survives a reload');
  });

  await t.test('choosing a theme is a preference, not an edit', () => {
    const s = loaded();
    s.setSettings({ theme: 'graphite' }, { silent: true });
    assert.equal(s.getState().settings.theme, 'graphite');
    assert.equal(s.getState().exportInfo.unexported, 0);
  });
});

test('entries', async (t) => {
  await t.test('a new entry gets an id, a created_at and a null value column', () => {
    const s = loaded();
    const res = s.addEntry({
      date: '2026-06-07', duration_min: 120, activity: 'Python — async chapter',
      category_id: 'cat_learn', goal_id: 'goal_py',
    });
    assert.ok(res.entry.id.startsWith('e_'));
    assert.equal(res.entry.created_at, '2026-06-07T12:00:00');
    assert.strictEqual(res.entry.value, null);          // decision 10
    assert.strictEqual(res.entry.activity, 'Python — async chapter');
  });

  await t.test('a new id never collides with one already in the dataset', () => {
    const s = loaded();
    const ids = new Set(s.getState().entries.map((e) => e.id));
    for (let i = 0; i < 5; i++) {
      const res = s.addEntry({ date: '2026-06-07', duration_min: 6, category_id: 'cat_learn' });
      assert.equal(ids.has(res.entry.id), false, res.entry.id);
      ids.add(res.entry.id);
    }
  });

  await t.test('editing does not rewrite created_at', () => {
    const s = loaded();
    const first = s.getState().entries[0];
    const res = s.updateEntry(first.id, { duration_min: 45, activity: 'Edited in Excel' });
    assert.equal(res.entry.created_at, first.created_at,
      'created_at records when the row was written, not when it was last touched');
    assert.equal(res.entry.duration_min, 45);
  });

  await t.test('clearing the goal or the activity stores null, not empty string', () => {
    const s = loaded();
    const withGoal = s.getState().entries.find((e) => e.goal_id);
    const res = s.updateEntry(withGoal.id, { goal_id: '', activity: '' });
    assert.strictEqual(res.entry.goal_id, null);
    assert.strictEqual(res.entry.activity, null);
  });

  await t.test('deleting removes exactly one row', () => {
    const s = loaded();
    const before = s.getState().entries.length;
    const id = s.getState().entries[0].id;
    s.deleteEntry(id);
    assert.equal(s.getState().entries.length, before - 1);
    assert.equal(s.getState().entries.some((e) => e.id === id), false);
    assert.equal(s.deleteEntry('e_nope').ok, false, 'deleting nothing is not a crash');
  });
});

test('categories follow the archive-not-delete rules', async (t) => {
  await t.test('archiving stamps the date it stopped counting (rule §8.10)', () => {
    const s = loaded();
    s.archiveCategory('cat_scroll', NOW);
    const c = s.getState().categories.find((x) => x.id === 'cat_scroll');
    assert.equal(c.archived, true);
    assert.equal(c.archived_on, '2026-06-07');
  });

  await t.test('the hours stay exactly where they were (rule §8.11)', () => {
    const s = loaded();
    const before = s.getState().entries.filter((e) => e.category_id === 'cat_scroll').length;
    s.archiveCategory('cat_scroll', NOW);
    assert.equal(s.getState().entries.filter((e) => e.category_id === 'cat_scroll').length, before);
  });

  await t.test('restoring clears the date', () => {
    const s = loaded();
    s.archiveCategory('cat_scroll', NOW);
    s.restoreCategory('cat_scroll');
    const c = s.getState().categories.find((x) => x.id === 'cat_scroll');
    assert.equal(c.archived, false);
    assert.strictEqual(c.archived_on, null);
  });

  await t.test('a category with hours cannot be deleted, whoever asks', () => {
    const s = loaded();
    const res = s.deleteCategory('cat_scroll');
    assert.equal(res.ok, false);
    assert.equal(res.error.code, 'has_hours');
    assert.ok(res.error.minutes > 0);
    assert.ok(s.getState().categories.some((c) => c.id === 'cat_scroll'),
      'the guard lives in the store, so no screen can route around it');
  });

  await t.test('a category with no hours can be, and takes its plan row with it', () => {
    const s = loaded();
    const res = s.addCategory({ name: 'Language app', direction: 'more', weekly_plan_hours: 0 });
    assert.equal(s.deleteCategory(res.category.id).ok, true);
    assert.equal(s.getState().categories.some((c) => c.id === res.category.id), false);
    assert.equal(s.getState().plan.some((p) => p.category_id === res.category.id), false);
  });

  await t.test('a new category goes to the end of the sort order', () => {
    const s = loaded();
    const res = s.addCategory({ name: 'Volunteering', direction: 'more', weekly_plan_hours: 2 });
    assert.equal(res.category.sort, 9);
    assert.equal(res.category.archived, false);
    assert.strictEqual(res.category.weekly_cap_hours, null);
  });
});

test('goals keep their hours when archived (spec §6)', () => {
  const s = loaded();
  const banked = s.getState().entries.filter((e) => e.goal_id === 'goal_py').length;
  s.archiveGoal('goal_py');
  assert.equal(s.getState().goals.find((g) => g.id === 'goal_py').archived, true);
  assert.equal(s.getState().entries.filter((e) => e.goal_id === 'goal_py').length, banked,
    '"Archived goals keep their hours. Nothing is deleted."');
  s.restoreGoal('goal_py');
  assert.equal(s.getState().goals.find((g) => g.id === 'goal_py').archived, false);
});

test('a new goal is hours-only, whatever it is handed (decision 14)', () => {
  const s = loaded();
  const res = s.addGoal({
    short_name: 'Read more', identity: 'someone who reads instead of scrolls',
    category_id: 'cat_reading', target_amount: '40', target_unit: 'count', by_date: '2026-12-31',
  });
  assert.equal(res.goal.target_unit, 'h');
  assert.strictEqual(res.goal.target_amount, 40);
  assert.equal(res.goal.archived, false);
});

test('start fresh returns the browser to first run', () => {
  const storage = fakeStorage();
  const s = loaded(storage);
  s.startFresh();
  assert.equal(s.getState(), null);
  assert.equal(s.hasData(), false);
  assert.equal(storage.getItem('meridian:data'), null);
});

test('state stays in its canonical order, so an export never reshuffles', () => {
  const s = loaded();
  s.addEntry({ date: '2026-05-30', duration_min: 30, category_id: 'cat_learn' });
  const entries = s.getState().entries;
  for (let i = 1; i < entries.length; i++) {
    const a = entries[i - 1], b = entries[i];
    assert.ok(a.date < b.date || (a.date === b.date && a.id <= b.id),
      `entries out of order at ${i}: ${a.date}/${a.id} then ${b.date}/${b.id}`);
  }
  assert.deepEqual(s.getState().categories.map((c) => c.sort), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('the leave warning appears only when there is something to lose', () => {
  const s = loaded();
  const handlers = {};
  const win = {
    addEventListener: (name, fn) => { handlers[name] = fn; },
    removeEventListener: () => { delete handlers.beforeunload; },
  };
  const off = store.installUnloadGuard(s, win);

  const fire = () => {
    let prevented = false;
    handlers.beforeunload({ preventDefault: () => { prevented = true; } });
    return prevented;
  };

  assert.equal(fire(), false, 'nothing unexported, no warning');
  s.addEntry({ date: '2026-06-07', duration_min: 30, category_id: 'cat_learn' });
  assert.equal(fire(), true);
  s.markExported(NOW);
  assert.equal(fire(), false);
  off();
  assert.equal(handlers.beforeunload, undefined);
});

test('the localStorage keys are the mandated ones', () => {
  assert.deepEqual(store.KEYS, {
    data: 'meridian:data',
    theme: 'meridian:theme',
    range: 'meridian:range',      // renamed from the mockup's meridian.range
  });
});

test('what the store holds is what the workbook writes', () => {
  // A guard against the two shapes drifting apart: anything the store puts in
  // state has to survive an export, and export reads canonical state.
  const s = loaded();
  s.addEntry({ date: '2026-06-07', duration_min: 30, activity: 'x', category_id: 'cat_learn' });
  const rows = workbook.toRows(s.getState(), { now: NOW });
  assert.equal(rows.Entries.length, s.getState().entries.length);
  assert.deepEqual(Object.keys(rows.Entries[0]), workbook.SHEETS[4].columns);
});
