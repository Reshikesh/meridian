'use strict';

const test = require('node:test');
const assert = require('node:assert');

// The vendored UMD sets no global under require(), which is exactly why
// workbook.js takes the namespace as a parameter instead of reaching for one.
const XLSX = require('../../vendor/xlsx.full.min.js');
const workbook = require('../../src/core/workbook.js');
const seed = require('../../seed/seed.js');

const NOW = new Date(2026, 5, 7, 12, 0, 0);

function demo() {
  return seed.buildDemo(NOW);
}

// Build a workbook from rows-of-cells, the way a hand-edited file arrives.
function bookOf(sheets) {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  }
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: false });
}

const CAT_HEAD = ['id', 'name', 'colour', 'direction', 'weekly_plan_hours',
  'weekly_cap_hours', 'sort', 'archived', 'archived_on'];
const ENTRY_HEAD = ['id', 'date', 'duration_min', 'activity', 'category_id',
  'goal_id', 'value', 'created_at'];

const ONE_CATEGORY = [CAT_HEAD, ['cat_learn', 'Learning', '#2b4a7d', 'more', 7, null, 5, 'FALSE', null]];

// The slice of state that has to survive a round trip. `source`, the export
// counter and the analysis range are the app's, not the workbook's.
const data = (s) => ({
  settings: s.settings, categories: s.categories, goals: s.goals,
  entries: s.entries, plan: s.plan, lessons: s.lessons,
});

test('export then import returns exactly what went in', async (t) => {
  await t.test('the demo dataset survives unchanged', () => {
    const before = workbook.canonical(demo());
    const bytes = workbook.encode(XLSX, before, { now: NOW });
    const { state, report } = workbook.decode(XLSX, bytes, { now: NOW });

    assert.equal(report.fatal, null);
    assert.equal(report.rejected, 0);
    assert.deepEqual(data(state), data(before));
  });

  await t.test('a second export of the imported state is identical to the first', () => {
    // "Round-trips exactly" means export -> import -> export. The only field
    // that legitimately differs is exported_at, so the clock is pinned.
    const first = workbook.encode(XLSX, demo(), { now: NOW });
    const { state } = workbook.decode(XLSX, first, { now: NOW });
    const second = workbook.encode(XLSX, state, { now: NOW });
    assert.deepEqual(Buffer.from(second), Buffer.from(first));
  });

  await t.test('an empty dataset round-trips too, sheets and all', () => {
    const before = workbook.canonical(seed.buildEmpty(NOW));
    const { state, report } = workbook.decode(
      XLSX, workbook.encode(XLSX, before, { now: NOW }), { now: NOW });
    assert.equal(report.fatal, null);
    assert.deepEqual(data(state), data(before));
    assert.deepEqual(report.notes, [], 'every sheet is written, so none is reported missing');
  });

  await t.test('a blank weekly_cap_hours stays blank (decision 13)', () => {
    // Writing the default back would change the next export for no reason.
    const bytes = workbook.encode(XLSX, demo(), { now: NOW });
    const { state } = workbook.decode(XLSX, bytes, { now: NOW });
    assert.equal(state.categories[0].weekly_cap_hours, null);
  });

  await t.test('empty has exactly one representation: null', () => {
    const s = workbook.canonical(demo());
    const { state } = workbook.decode(XLSX, workbook.encode(XLSX, s, { now: NOW }), { now: NOW });
    for (const e of state.entries) {
      if (!e.goal_id) assert.strictEqual(e.goal_id, null);
      assert.strictEqual(e.value, null, 'the value column ships blank (decision 10)');
    }
  });
});

test('the workbook is a clean spreadsheet a person can edit', async (t) => {
  const bytes = workbook.encode(XLSX, demo(), { now: NOW });
  const wb = XLSX.read(bytes, { type: 'array', raw: true, cellDates: false });

  await t.test('all seven sheets, in the spec order, each with its header row', () => {
    assert.deepEqual(wb.SheetNames, ['Meta', 'Settings', 'Categories', 'Goals', 'Entries', 'Plan', 'Lessons']);
    for (const def of workbook.SHEETS) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[def.name], { header: 1, raw: true, defval: null });
      assert.deepEqual(rows[0], def.columns, `${def.name} header`);
    }
  });

  await t.test('no formulas anywhere', () => {
    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      for (const addr of Object.keys(ws)) {
        if (addr[0] !== '!') assert.equal(ws[addr].f, undefined, `${name}!${addr}`);
      }
    }
  });

  await t.test('dates are ISO text and minutes are whole numbers', () => {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets.Entries, { raw: true });
    for (const r of rows.slice(0, 5)) {
      assert.match(String(r.date), /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(typeof r.duration_min, 'number');
      assert.equal(r.duration_min, Math.round(r.duration_min));
    }
  });

  await t.test('Meta carries the schema, the app version and the export time', () => {
    const meta = XLSX.utils.sheet_to_json(wb.Sheets.Meta, { raw: true })
      .reduce((acc, r) => Object.assign(acc, { [r.key]: r.value }), {});
    assert.equal(meta.schema_version, workbook.SCHEMA_VERSION);
    assert.equal(meta.app_version, workbook.APP_VERSION);
    assert.equal(meta.exported_at, '2026-06-07T12:00:00');
  });

  await t.test('booleans are written as text, so Excel shows TRUE not a tick', () => {
    const cats = XLSX.utils.sheet_to_json(wb.Sheets.Categories, { raw: true });
    assert.equal(cats[0].archived, 'FALSE');
  });
});

test('every malformed row is rejected by name, and the rest still import', async (t) => {
  const bytes = bookOf({
    Meta: [['key', 'value'], ['schema_version', 1]],
    Categories: ONE_CATEGORY,
    Goals: [['id', 'short_name', 'identity', 'category_id', 'target_amount', 'target_unit', 'by_date', 'archived'],
      ['goal_py', 'Learn Python', null, 'cat_learn', 130, 'h', '2026-09-30', 'FALSE'],
      ['goal_bad', 'Orphan', null, 'cat_missing', 10, 'h', '2026-09-30', 'FALSE'],
      ['goal_py', 'Duplicate', null, 'cat_learn', 10, 'h', '2026-09-30', 'FALSE'],
      ['goal_zero', 'Nothing', null, 'cat_learn', 0, 'h', '2026-09-30', 'FALSE']],
    Entries: [ENTRY_HEAD,
      ['e_0001', '2026-06-07', 120, 'fine', 'cat_learn', 'goal_py', null, null],
      ['e_0002', '2026-06-07', 'ninety', 'bad minutes', 'cat_learn', null, null, null],
      ['e_0003', '7/6/2026', 60, 'bad date', 'cat_learn', null, null, null],
      ['e_0004', '2026-06-06', 60, 'no such category', 'cat_gone', null, null, null],
      ['e_0005', '2026-06-06', 60, 'no such goal', 'cat_learn', 'goal_gone', null, null],
      ['e_0001', '2026-06-05', 60, 'duplicate id', 'cat_learn', null, null, null]],
  });

  const { state, report } = workbook.decode(XLSX, bytes, { now: NOW });
  const reasons = report.rejects.map((r) => `${r.sheet}:${r.row}:${r.reason}`);

  await t.test('the good rows are kept', () => {
    assert.equal(state.entries.length, 1);
    assert.equal(state.goals.length, 1);
    assert.equal(report.counts.entries, 1);
  });

  await t.test('each reject names its sheet, its Excel row and its reason', () => {
    for (const r of report.rejects) {
      assert.ok(r.sheet && r.row >= 2 && r.reason, JSON.stringify(r));
    }
    assert.ok(reasons.some((r) => r.startsWith('Entries:3:') && /ninety/.test(r)));
    assert.ok(reasons.some((r) => r.startsWith('Entries:4:') && /ISO date/.test(r)));
    assert.ok(reasons.some((r) => r.startsWith('Entries:5:') && /Categories sheet/.test(r)));
    assert.ok(reasons.some((r) => r.startsWith('Entries:6:') && /Goals sheet/.test(r)));
    assert.ok(reasons.some((r) => r.startsWith('Entries:7:') && /appears twice/.test(r)));
  });

  await t.test('a duplicate id is a reject, not a silent last-one-wins', () => {
    assert.ok(reasons.some((r) => r.startsWith('Goals:4:') && /appears twice/.test(r)));
    assert.equal(state.goals[0].short_name, 'Learn Python', 'the first row keeps the id');
  });

  await t.test('a goal fed by a category that is not there is rejected', () => {
    assert.ok(reasons.some((r) => r.startsWith('Goals:3:') && /Categories sheet/.test(r)));
  });

  await t.test('a target of zero is rejected', () => {
    assert.ok(reasons.some((r) => r.startsWith('Goals:5:') && /more than zero/.test(r)));
  });

  await t.test('the per-sheet counts add up', () => {
    const entries = report.sheets.find((s) => s.name === 'Entries');
    assert.deepEqual([entries.accepted, entries.rejected], [1, 5]);
  });
});

test('an entry whose goal belongs to another category is rejected (rule §8.2)', () => {
  const bytes = bookOf({
    Categories: [CAT_HEAD,
      ['cat_learn', 'Learning', '#2b4a7d', 'more', 7, null, 5, 'FALSE', null],
      ['cat_family', 'Family', '#a8641d', 'more', 12, null, 3, 'FALSE', null]],
    Goals: [['id', 'short_name', 'identity', 'category_id', 'target_amount', 'target_unit', 'by_date', 'archived'],
      ['goal_py', 'Learn Python', null, 'cat_learn', 130, 'h', '2026-09-30', 'FALSE']],
    Entries: [ENTRY_HEAD,
      ['e_0001', '2026-06-07', 60, 'wrong category', 'cat_family', 'goal_py', null, null]],
  });
  const { state, report } = workbook.decode(XLSX, bytes, { now: NOW });
  assert.equal(state.entries.length, 0);
  assert.match(report.rejects[0].reason, /is fed by Learning, but this row is Family/);
});

test('what is missing, unknown or already past is reported, not fatal', async (t) => {
  await t.test('unknown columns are ignored with a note', () => {
    const bytes = bookOf({
      Categories: [CAT_HEAD.concat(['my_notes', 'colour_2']),
        ['cat_learn', 'Learning', '#2b4a7d', 'more', 7, null, 5, 'FALSE', null, 'hello', 'x']],
    });
    const { state, report } = workbook.decode(XLSX, bytes, { now: NOW });
    assert.equal(state.categories.length, 1);
    assert.ok(report.notes.some((n) => /ignored columns my_notes, colour_2/.test(n)));
    assert.ok(report.notes.some((n) => /not written back on the next export/.test(n)));
  });

  await t.test('columns are read by name, so a reordered sheet still works', () => {
    const bytes = bookOf({
      Categories: [['direction', 'name', 'id', 'weekly_plan_hours'],
        ['more', 'Learning', 'cat_learn', 7]],
    });
    const { state, report } = workbook.decode(XLSX, bytes, { now: NOW });
    assert.equal(report.rejected, 0);
    assert.equal(state.categories[0].name, 'Learning');
    assert.equal(state.categories[0].colour, null);
  });

  await t.test('missing sheets are notes, and the import still lands', () => {
    const { state, report } = workbook.decode(XLSX, bookOf({ Categories: ONE_CATEGORY }), { now: NOW });
    assert.equal(report.fatal, null);
    assert.equal(state.categories.length, 1);
    for (const name of ['Goals', 'Entries', 'Plan', 'Lessons', 'Settings']) {
      assert.ok(report.notes.some((n) => n.startsWith(`${name}:`)), `${name} reported missing`);
    }
    assert.deepEqual(state.settings, workbook.defaultSettings());
  });

  await t.test('an over-full day is kept and noted, never discarded (decision 5)', () => {
    const bytes = bookOf({
      Categories: ONE_CATEGORY,
      Entries: [ENTRY_HEAD, ['e_0001', '2026-06-05', 1020, 'a 17 h day', 'cat_learn', null, null, null]],
    });
    const { state, report } = workbook.decode(XLSX, bytes, { now: NOW });
    assert.equal(state.entries.length, 1, 'a day somebody lived is not a validation error');
    assert.ok(report.notes.some((n) => /1 day holds more than 16 h \(2026-06-05\)/.test(n)));
  });

  await t.test('a goal whose date has passed is kept and noted', () => {
    const bytes = bookOf({
      Categories: ONE_CATEGORY,
      Goals: [['id', 'short_name', 'category_id', 'target_amount', 'by_date'],
        ['goal_py', 'Learn Python', 'cat_learn', 130, '2026-01-01']],
    });
    const { state, report } = workbook.decode(XLSX, bytes, { now: NOW });
    assert.equal(state.goals.length, 1);
    assert.ok(report.notes.some((n) => /1 goal has a date that has already passed/.test(n)));
  });

  await t.test('an Excel-converted date is decoded without a timezone', () => {
    // Retyping a date in Excel turns the ISO text into a serial number. Read as
    // a Date it would be UTC midnight, and a day early for anyone west of UTC.
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ONE_CATEGORY), 'Categories');
    const ws = XLSX.utils.aoa_to_sheet([ENTRY_HEAD,
      ['e_0001', null, 60, 'retyped date', 'cat_learn', null, null, null]]);
    ws.B2 = { t: 'n', v: 46180, w: '07/06/2026' };   // 2026-06-07 as an Excel serial
    XLSX.utils.book_append_sheet(wb, ws, 'Entries');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellDates: false });

    const { state, report } = workbook.decode(XLSX, bytes, { now: NOW });
    assert.equal(report.rejected, 0);
    assert.equal(state.entries[0].date, '2026-06-07');
  });
});

test('a workbook that cannot be read at all fails as a whole, cleanly', async (t) => {
  await t.test('a file that is not a spreadsheet', () => {
    const { state, report } = workbook.decode(XLSX, Buffer.from('not a workbook'), { now: NOW });
    assert.equal(state, null);
    assert.equal(report.ok, false);
    assert.equal(report.fatal.code, 'unreadable');
  });

  await t.test('no Categories sheet: nothing else can be read', () => {
    const { state, report } = workbook.decode(XLSX, bookOf({
      Entries: [ENTRY_HEAD, ['e_0001', '2026-06-07', 60, 'x', 'cat_learn', null, null, null]],
    }), { now: NOW });
    assert.equal(state, null);
    assert.equal(report.fatal.code, 'no_categories');
  });

  await t.test('a workbook from a newer Meridian is refused, not guessed at', () => {
    const { state, report } = workbook.decode(XLSX, bookOf({
      Meta: [['key', 'value'], ['schema_version', workbook.SCHEMA_VERSION + 1]],
      Categories: ONE_CATEGORY,
    }), { now: NOW });
    assert.equal(state, null);
    assert.equal(report.fatal.code, 'schema_newer');
    assert.match(report.fatal.message, /newer version of Meridian/);
  });

  await t.test('an older schema is read, with a note about what will happen', () => {
    const older = bookOf({ Meta: [['key', 'value'], ['schema_version', 0]], Categories: ONE_CATEGORY });
    const { state, report } = workbook.decode(XLSX, older, { now: NOW });
    assert.ok(state);
    assert.ok(report.notes.some((n) => /schema 0/.test(n)));
  });
});

test('settings come back through the workbook', async (t) => {
  await t.test('a valid settings sheet is applied', () => {
    const { state, report } = workbook.decode(XLSX, bookOf({
      Settings: [['key', 'value'], ['theme', 'graphite'], ['sleep_hours_per_day', 7],
        ['errands_hours_per_week', 12], ['day_boundary', '04:00'], ['week_start', 'monday']],
      Categories: ONE_CATEGORY,
    }), { now: NOW });
    assert.equal(report.rejected, 0);
    assert.equal(state.settings.theme, 'graphite');
    assert.equal(state.settings.sleep_hours_per_day, 7);
  });

  await t.test('a bad setting is one reject, and the others still apply', () => {
    const { state, report } = workbook.decode(XLSX, bookOf({
      Settings: [['key', 'value'], ['theme', 'neon'], ['sleep_hours_per_day', 7], ['made_up', 'x']],
      Categories: ONE_CATEGORY,
    }), { now: NOW });
    assert.equal(report.rejects.length, 1);
    assert.match(report.rejects[0].reason, /theme "neon"/);
    assert.equal(state.settings.theme, 'paper', 'the default stands');
    assert.equal(state.settings.sleep_hours_per_day, 7);
    assert.ok(report.notes.some((n) => /ignored unknown setting "made_up"/.test(n)));
  });
});

test('the plan sheet insists on Mondays (spec §7)', () => {
  const { state, report } = workbook.decode(XLSX, bookOf({
    Categories: ONE_CATEGORY,
    Plan: [['category_id', 'planned_hours', 'week_effective_from'],
      ['cat_learn', 7, '2026-06-01'],
      ['cat_learn', 7, '2026-06-03'],
      ['cat_gone', 7, '2026-06-01']],
  }), { now: NOW });
  assert.equal(state.plan.length, 1);
  assert.match(report.rejects[0].reason, /is not a Monday/);
  assert.match(report.rejects[1].reason, /Categories sheet/);
});

test('lessons carry an ISO week and a tag list', () => {
  const { state, report } = workbook.decode(XLSX, bookOf({
    Categories: ONE_CATEGORY,
    Lessons: [['id', 'iso_week', 'date', 'text', 'tags'],
      ['l_01', '2026-W22', '2026-05-31', 'Python only happens before 8am.', 'goal_py,cat_learn'],
      ['l_02', 'week 22', '2026-05-31', 'bad week', null]],
  }), { now: NOW });
  assert.deepEqual(state.lessons[0].tags, ['goal_py', 'cat_learn']);
  assert.match(report.rejects[0].reason, /is not an ISO week/);
});

test('the export filename is the date alone', () => {
  // Chromium rewrites ':' in a download name, so an ISO datetime would land as
  // 09_12_00 on the friend's disk.
  assert.equal(workbook.exportFilename(NOW), 'meridian-data-2026-06-07.xlsx');
  assert.equal(workbook.exportFilename(new Date(2026, 5, 8, 2, 30, 0)),
    'meridian-data-2026-06-07.xlsx', 'the 04:00 boundary applies here too');
});
