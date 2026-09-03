'use strict';

const test = require('node:test');
const assert = require('node:assert');
const validate = require('../../src/core/validate.js');

const NOW = new Date(2026, 5, 7, 12, 0, 0);          // Sunday 7 June 2026, midday
const TODAY = '2026-06-07';

function state(overrides) {
  return Object.assign({
    settings: {},
    categories: [
      { id: 'cat_learn', name: 'Learning', direction: 'more', archived: false },
      { id: 'cat_scroll', name: 'Scrolling', direction: 'less', archived: false },
      { id: 'cat_old', name: 'Side project', direction: 'more', archived: true },
    ],
    goals: [
      { id: 'goal_py', short_name: 'Learn Python', category_id: 'cat_learn', archived: false },
    ],
    entries: [],
  }, overrides || {});
}

const fieldsOf = (r) => r.errors.map((e) => e.field);

test('a new entry is checked before anything is written', async (t) => {
  const good = {
    date: TODAY, duration_min: 120, activity: 'Python — async chapter',
    category_id: 'cat_learn', goal_id: 'goal_py',
  };

  await t.test('a valid entry passes', () => {
    assert.deepEqual(validate.validateEntry(good, state(), { now: NOW }), { ok: true, errors: [] });
  });

  await t.test('a duration of zero or less is refused', () => {
    for (const d of [0, -30]) {
      const r = validate.validateEntry(Object.assign({}, good, { duration_min: d }), state(), { now: NOW });
      assert.equal(r.ok, false, `duration ${d}`);
      assert.deepEqual(fieldsOf(r), ['duration_min']);
    }
  });

  await t.test('a duration that is not whole minutes is refused', () => {
    const r = validate.validateEntry(Object.assign({}, good, { duration_min: 90.5 }), state(), { now: NOW });
    assert.equal(r.ok, false);
  });

  await t.test('a missing duration asks for one', () => {
    const r = validate.validateEntry(Object.assign({}, good, { duration_min: null }), state(), { now: NOW });
    assert.equal(r.errors[0].message, 'Enter how long it took.');
  });

  await t.test('a day that has not happened is refused', () => {
    const r = validate.validateEntry(Object.assign({}, good, { date: '2026-06-08' }), state(), { now: NOW });
    assert.deepEqual(fieldsOf(r), ['date']);
  });

  await t.test('at 02:30 the logical day is still yesterday (decision 2)', () => {
    const at0230 = new Date(2026, 5, 8, 2, 30, 0);
    assert.equal(validate.validateEntry(good, state(), { now: at0230 }).ok, true,
      '7 June is today at 02:30 on the 8th');
    const tomorrow = Object.assign({}, good, { date: '2026-06-08' });
    assert.equal(validate.validateEntry(tomorrow, state(), { now: at0230 }).ok, false,
      'the 8th has not started yet');
  });

  await t.test('a category is required, must exist, and must not be archived', () => {
    assert.deepEqual(fieldsOf(validate.validateEntry(
      Object.assign({}, good, { category_id: null, goal_id: null }), state(), { now: NOW })), ['category_id']);
    assert.deepEqual(fieldsOf(validate.validateEntry(
      Object.assign({}, good, { category_id: 'cat_nope', goal_id: null }), state(), { now: NOW })), ['category_id']);
    assert.deepEqual(fieldsOf(validate.validateEntry(
      Object.assign({}, good, { category_id: 'cat_old', goal_id: null }), state(), { now: NOW })), ['category_id']);
  });

  await t.test('a goal lives inside one category (rule §8.2)', () => {
    const r = validate.validateEntry(
      Object.assign({}, good, { category_id: 'cat_scroll' }), state(), { now: NOW });
    assert.deepEqual(fieldsOf(r), ['goal_id']);
    assert.equal(r.errors[0].message, 'Learn Python is fed by Learning.');
  });
});

test('a day cannot hold more than the 24 hours it has (rule §8.17)', async (t) => {
  const full = state({
    entries: [{ id: 'e_1', date: TODAY, duration_min: 1380, category_id: 'cat_learn' }],
  });

  await t.test('the last hour of the day fits', () => {
    const r = validate.validateEntry(
      { date: TODAY, duration_min: 60, category_id: 'cat_learn' }, full, { now: NOW });
    assert.equal(r.ok, true, '23 h logged plus 1 h is exactly 24');
  });

  await t.test('one minute more does not, and says how much is left', () => {
    const r = validate.validateEntry(
      { date: TODAY, duration_min: 61, category_id: 'cat_learn' }, full, { now: NOW });
    assert.equal(r.ok, false);
    assert.equal(r.errors[0].field, 'duration_min');
    assert.match(r.errors[0].message, /over 24 h\. 1\.0 h left\./);
  });

  await t.test('editing an entry does not count it twice', () => {
    // Raising the existing 23 h entry to 23.5 h must be measured against the
    // rest of the day, not against a day that already contains it.
    const r = validate.validateEntry(
      { date: TODAY, duration_min: 1410, category_id: 'cat_learn' },
      full, { now: NOW, excludeId: 'e_1' });
    assert.equal(r.ok, true);
  });

  await t.test('a day with sleep logged as a category still fits', () => {
    // Decision 17 as amended: sleep is an ordinary category, so 8 h of it on
    // top of a 16 h waking day is an ordinary, legal day.
    const withSleep = state({
      entries: [{ id: 'e_1', date: TODAY, duration_min: 960, category_id: 'cat_learn' }],
    });
    const r = validate.validateEntry(
      { date: TODAY, duration_min: 480, category_id: 'cat_learn' }, withSleep, { now: NOW });
    assert.equal(r.ok, true);
  });

  await t.test('the check is reusable on its own', () => {
    const cap = validate.dayCapCheck(full, TODAY, 120, null);
    assert.equal(cap.ok, false);
    assert.equal(cap.capMinutes, 1440);
    assert.equal(cap.usedMinutes, 1380);
    assert.equal(cap.remainingMinutes, 60);
  });
});

test('categories', async (t) => {
  await t.test('a blank or duplicate name is refused', () => {
    assert.deepEqual(fieldsOf(validate.validateCategory({ name: '  ', direction: 'more' }, state())), ['name']);
    const dup = validate.validateCategory({ name: 'learning', direction: 'more' }, state());
    assert.deepEqual(fieldsOf(dup), ['name'], 'names clash case-insensitively');
  });

  await t.test('renaming a category to its own name is fine', () => {
    const r = validate.validateCategory(
      { name: 'Learning', direction: 'more' }, state(), { excludeId: 'cat_learn' });
    assert.equal(r.ok, true);
  });

  await t.test('the direction must be one of the three', () => {
    assert.deepEqual(fieldsOf(validate.validateCategory({ name: 'X', direction: 'More' }, state())), ['direction']);
    assert.deepEqual(fieldsOf(validate.validateCategory({ name: 'X', direction: null }, state())), ['direction']);
  });

  await t.test('a category that feeds a goal cannot stop being More (rule §8.3)', () => {
    const r = validate.validateCategory(
      { name: 'Learning', direction: 'less' }, state(), { excludeId: 'cat_learn' });
    assert.deepEqual(fieldsOf(r), ['direction']);
    assert.match(r.errors[0].message, /feeds Learn Python/);
  });

  await t.test('planned hours cannot be negative, and a colour must be a colour', () => {
    assert.deepEqual(fieldsOf(validate.validateCategory(
      { name: 'X', direction: 'more', weekly_plan_hours: -1 }, state())), ['weekly_plan_hours']);
    assert.deepEqual(fieldsOf(validate.validateCategory(
      { name: 'X', direction: 'more', colour: 'blue' }, state())), ['colour']);
  });
});

test('goals', async (t) => {
  const good = {
    short_name: 'Learn Python', identity: 'someone who can build their own tools',
    category_id: 'cat_learn', target_amount: 130, target_unit: 'h', by_date: '2026-09-30',
  };

  await t.test('a valid goal passes', () => {
    assert.equal(validate.validateGoal(good, state(), { now: NOW }).ok, true);
  });

  await t.test('only More categories can carry goals (rule §8.3)', () => {
    const r = validate.validateGoal(
      Object.assign({}, good, { category_id: 'cat_scroll' }), state(), { now: NOW });
    assert.equal(r.errors[0].message, 'Only More categories can carry goals.');
  });

  await t.test('a target of zero or less is refused', () => {
    for (const v of [0, -5]) {
      assert.deepEqual(fieldsOf(validate.validateGoal(
        Object.assign({}, good, { target_amount: v }), state(), { now: NOW })), ['target_amount']);
    }
  });

  await t.test('a date in the past, or today, is refused', () => {
    assert.deepEqual(fieldsOf(validate.validateGoal(
      Object.assign({}, good, { by_date: '2026-01-01' }), state(), { now: NOW })), ['by_date']);
    assert.deepEqual(fieldsOf(validate.validateGoal(
      Object.assign({}, good, { by_date: TODAY }), state(), { now: NOW })), ['by_date']);
  });

  await t.test('goals are measured in hours in v1 (decision 14)', () => {
    assert.deepEqual(fieldsOf(validate.validateGoal(
      Object.assign({}, good, { target_unit: 'km' }), state(), { now: NOW })), ['target_unit']);
  });
});

test('a category with hours is archived, never deleted (rule §8.10)', () => {
  const used = state({
    entries: [{ id: 'e_1', date: TODAY, duration_min: 60, category_id: 'cat_learn' }],
  });
  // The base state carries a goal fed by cat_learn, so that one is doubly
  // undeletable; cat_scroll has neither hours nor a goal.
  assert.deepEqual(validate.canDeleteCategory(used, 'cat_learn'),
    { ok: false, minutes: 60, goals: ['Learn Python'] });
  assert.deepEqual(validate.canDeleteCategory(used, 'cat_scroll'),
    { ok: true, minutes: 0, goals: [] });
});

/* Phase 5 audit: deleting a category with no hours but a goal fed by it left
   the goal naming an id that no longer existed. The app went on showing it,
   no hour could ever reach it because every picker filters on a category that
   is gone, and an export of that state would not import — the Goals row is
   rejected on its foreign key, so the round trip QUALITY-BAR §6 requires was
   broken by a delete the Manage sheet called safe. */
test('a category with no hours but a goal fed by it is not deletable', () => {
  const clean = state({ entries: [] });
  assert.deepEqual(validate.canDeleteCategory(clean, 'cat_learn'),
    { ok: false, minutes: 0, goals: ['Learn Python'] });

  // Archived goals count: "Archived goals keep their hours" is only true while
  // the category they name still exists.
  const archived = state({ entries: [] });
  archived.goals[0].archived = true;
  assert.equal(validate.canDeleteCategory(archived, 'cat_learn').ok, false);

  // With the goal moved off it, the category is free to go.
  const moved = state({ entries: [] });
  moved.goals[0].category_id = 'cat_other';
  assert.deepEqual(validate.canDeleteCategory(moved, 'cat_learn'),
    { ok: true, minutes: 0, goals: [] });
});

test('workbook cells coerce the way Excel hands them over', async (t) => {
  await t.test('a whole number can arrive as a number or as text', () => {
    assert.deepEqual(validate.asInteger(120, 'duration_min', { min: 1 }), { ok: true, value: 120 });
    assert.deepEqual(validate.asInteger('120', 'duration_min', { min: 1 }), { ok: true, value: 120 });
    assert.equal(validate.asInteger('ninety', 'duration_min', { min: 1 }).ok, false);
    assert.equal(validate.asInteger(90.5, 'duration_min', { min: 1 }).ok, false);
    assert.equal(validate.asInteger(0, 'duration_min', { min: 1 }).ok, false);
  });

  await t.test('a boolean can arrive as text or as a real boolean', () => {
    assert.deepEqual(validate.asBool('TRUE', 'archived'), { ok: true, value: true });
    assert.deepEqual(validate.asBool(true, 'archived'), { ok: true, value: true });
    assert.deepEqual(validate.asBool('false', 'archived'), { ok: true, value: false });
    assert.deepEqual(validate.asBool(null, 'archived'), { ok: true, value: false });
    assert.equal(validate.asBool('maybe', 'archived').ok, false);
  });

  await t.test('an enum is normalised, so "More" from Excel becomes "more"', () => {
    assert.deepEqual(validate.asEnum('More', 'direction', validate.DIRECTIONS), { ok: true, value: 'more' });
    assert.equal(validate.asEnum('sideways', 'direction', validate.DIRECTIONS).ok, false);
  });

  await t.test('a date must be ISO text, or an Excel serial decoded without a timezone', () => {
    assert.deepEqual(validate.asDayKey('2026-06-07', 'date'), { ok: true, value: '2026-06-07' });
    assert.equal(validate.asDayKey('7/6/2026', 'date').ok, false);
    assert.equal(validate.asDayKey(46180, 'date').ok, false, 'a serial with no decoder is not guessed at');
    assert.deepEqual(
      validate.asDayKey(46180, 'date', { parseSerial: () => '2026-06-07' }),
      { ok: true, value: '2026-06-07' });
  });

  await t.test('blank is blank, and required means required', () => {
    assert.deepEqual(validate.asText('  ', 'activity'), { ok: true, value: null });
    assert.deepEqual(validate.asText(null, 'activity'), { ok: true, value: null });
    assert.equal(validate.asText('', 'name', { required: true }).ok, false);
    assert.deepEqual(validate.asText('  Learning  ', 'name'), { ok: true, value: 'Learning' });
  });

  await t.test('the value column accepts 1 to 5, or nothing (decision 10)', () => {
    assert.deepEqual(validate.asInteger(3, 'value', { min: 1, max: 5 }), { ok: true, value: 3 });
    assert.deepEqual(validate.asInteger(null, 'value', { min: 1, max: 5 }), { ok: true, value: null });
    assert.equal(validate.asInteger(6, 'value', { min: 1, max: 5 }).ok, false);
  });
});
