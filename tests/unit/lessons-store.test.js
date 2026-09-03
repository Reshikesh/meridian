'use strict';

const test = require('node:test');
const assert = require('node:assert');
const store = require('../../src/store.js');
const seed = require('../../seed/seed.js');

/* Decision 25: lessons are a journal. Written whenever, with or without a
   title, pinned or not; archived off the wall and kept; deleted for good. */

const NOW = new Date(2026, 5, 7, 12, 0, 0);
const clock = () => NOW;

function fakeStorage() {
  const map = new Map();
  return {
    map,
    available: true,
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); return { ok: true }; },
    removeItem(k) { map.delete(k); return { ok: true }; },
  };
}

function loaded(storage) {
  const s = store.createStore({ storage: storage || fakeStorage(), now: clock });
  s.replaceAll(seed.buildDemo(NOW), 'demo');
  return s;
}

const saved = (storage) => JSON.parse(storage.getItem('meridian:data'));

test('a lesson is written whenever, with or without a title, and dated by the 04:00 day', async (t) => {
  await t.test('titled, tagged and pinned on the way in', () => {
    const s = loaded();
    const res = s.addLesson({ title: '  Mornings  ', text: ' Python before eight. ', tags: ['goal_py'], pinned: true });
    assert.equal(res.ok, true);
    assert.equal(res.lesson.title, 'Mornings');
    assert.equal(res.lesson.text, 'Python before eight.');
    assert.deepEqual(res.lesson.tags, ['goal_py']);
    assert.equal(res.lesson.pinned, true);
    assert.equal(res.lesson.archived, false);
    assert.equal(res.lesson.date, '2026-06-07');
    assert.equal(res.lesson.iso_week, '2026-W23');
    assert.match(res.lesson.id, /^l_\d{4}$/);
  });

  await t.test('an empty title is null, never an empty string', () => {
    const s = loaded();
    assert.equal(s.addLesson({ title: '   ', text: 'x' }).lesson.title, null);
    assert.equal(s.addLesson({ text: 'y' }).lesson.title, null);
  });

  await t.test('a lesson written at 02:00 belongs to the day before (decision 2)', () => {
    const s = store.createStore({ storage: fakeStorage(), now: () => new Date(2026, 5, 8, 2, 0, 0) });
    s.replaceAll(seed.buildDemo(NOW), 'demo');
    assert.equal(s.addLesson({ text: 'late' }).lesson.date, '2026-06-07');
  });

  await t.test('editing changes the words and the tags, never the date', () => {
    const s = loaded();
    const id = s.addLesson({ text: 'first', date: '2026-05-31' }).lesson.id;
    const res = s.updateLesson(id, { title: 'Later', text: 'second', tags: ['cat_family'] });
    assert.equal(res.lesson.title, 'Later');
    assert.equal(res.lesson.text, 'second');
    assert.deepEqual(res.lesson.tags, ['cat_family']);
    assert.equal(res.lesson.date, '2026-05-31');
    assert.equal(res.lesson.iso_week, '2026-W22');
  });

  await t.test('pin toggles, or takes a value', () => {
    const s = loaded();
    const id = s.addLesson({ text: 'x' }).lesson.id;
    const find = () => s.getState().lessons.find((l) => l.id === id);
    s.pinLesson(id);
    assert.equal(find().pinned, true);
    s.pinLesson(id);
    assert.equal(find().pinned, false);
    s.pinLesson(id, true);
    assert.equal(find().pinned, true);
  });

  await t.test('archive keeps the card, unpins it, and restore brings it back unpinned', () => {
    const s = loaded();
    const find = () => s.getState().lessons.find((l) => l.id === 'l_01');
    assert.equal(find().pinned, true, 'the seed pins it');
    s.archiveLesson('l_01');
    assert.equal(find().archived, true);
    assert.equal(find().pinned, false);
    s.restoreLesson('l_01');
    assert.equal(find().archived, false);
    assert.equal(find().pinned, false);
  });

  await t.test('delete is for good', () => {
    const storage = fakeStorage();
    const s = loaded(storage);
    const before = s.getState().lessons.length;
    s.deleteLesson('l_02');
    assert.equal(s.getState().lessons.length, before - 1);
    assert.equal(saved(storage).lessons.some((l) => l.id === 'l_02'), false, 'and gone from disk in the same call');
    assert.equal(s.deleteLesson('l_nope').ok, false);
  });

  await t.test('every lesson mutation counts as one unexported change', () => {
    const s = loaded();
    const id = s.addLesson({ text: 'x' }).lesson.id;
    s.updateLesson(id, { text: 'y' });
    s.pinLesson(id);
    s.archiveLesson(id);
    s.restoreLesson(id);
    s.deleteLesson(id);
    assert.equal(s.getState().exportInfo.unexported, 6);
  });
});
