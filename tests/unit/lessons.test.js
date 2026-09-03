'use strict';

const test = require('node:test');
const assert = require('node:assert');
const lessons = require('../../src/core/lessons.js');

/* Decision 25: the wall — pinned first, then a fill that rotates newest,
   oldest, random from one visit to the next; a search that shows every match. */

function card(id, date, patch) {
  return Object.assign({ id, date, title: null, text: 'text ' + id, tags: [], pinned: false, archived: false }, patch || {});
}

const SET = [
  card('l_01', '2026-05-03'),
  card('l_02', '2026-05-10', { pinned: true }),
  card('l_03', '2026-05-17', { title: 'Presence', tags: ['cat_family'] }),
  card('l_04', '2026-05-24', { archived: true }),
  card('l_05', '2026-05-31', { tags: ['goal_py'] }),
  card('l_06', '2026-05-31', { pinned: true }),
];

test('the mode rotates newest, oldest, random, one step per visit', () => {
  assert.equal(lessons.modeForVisit(0), 'newest');
  assert.equal(lessons.modeForVisit(1), 'oldest');
  assert.equal(lessons.modeForVisit(2), 'random');
  assert.equal(lessons.modeForVisit(3), 'newest');
  assert.equal(lessons.modeForVisit('nonsense'), 'newest');
  assert.equal(lessons.nextMode('newest'), 'oldest');
  assert.equal(lessons.nextMode('random'), 'newest');
});

test('the wall order is pinned first, then the fill', async (t) => {
  await t.test('newest: pinned newest-first, then the rest newest-first; archived absent', () => {
    const w = lessons.wallOrder(SET, 'newest');
    assert.deepEqual(w.cards.map((c) => c.id), ['l_06', 'l_02', 'l_05', 'l_03', 'l_01']);
    assert.equal(w.pinnedCount, 2);
  });

  await t.test('oldest: the pinned stay in front, the rest reverse', () => {
    const w = lessons.wallOrder(SET, 'oldest');
    assert.deepEqual(w.cards.map((c) => c.id), ['l_06', 'l_02', 'l_01', 'l_03', 'l_05']);
  });

  await t.test('random: the pinned stay in front, the rest shuffled with the random given', () => {
    let n = 0;
    const fixed = () => [0.5, 0.1][n++ % 2];
    const w = lessons.wallOrder(SET, 'random', fixed);
    assert.deepEqual(w.cards.slice(0, 2).map((c) => c.id), ['l_06', 'l_02']);
    assert.deepEqual(w.cards.slice(2).map((c) => c.id).sort(), ['l_01', 'l_03', 'l_05']);
    assert.notDeepEqual(w.cards.slice(2).map((c) => c.id), ['l_05', 'l_03', 'l_01'], 'not simply newest');
  });

  await t.test('two written on one day keep a stable order', () => {
    const a = lessons.wallOrder(SET, 'newest').cards.map((c) => c.id);
    const b = lessons.wallOrder(SET.slice().reverse(), 'newest').cards.map((c) => c.id);
    assert.deepEqual(a, b);
  });

  await t.test('no lessons is an empty wall, not a throw', () => {
    assert.deepEqual(lessons.wallOrder([], 'newest'), { cards: [], pinnedCount: 0 });
    assert.deepEqual(lessons.wallOrder(undefined, 'random'), { cards: [], pinnedCount: 0 });
  });
});

test('the archive is every archived card, newest first', () => {
  assert.deepEqual(lessons.archived(SET).map((c) => c.id), ['l_04']);
});

test('search matches title, text and tag names, case-blind, newest first, every match', async (t) => {
  const names = { cat_family: 'Family', goal_py: 'Learn Python' };

  await t.test('by title', () => {
    assert.deepEqual(lessons.search(SET, 'PRESENCE', names).map((c) => c.id), ['l_03']);
  });

  await t.test('by text', () => {
    assert.deepEqual(lessons.search(SET, 'text l_0', names).map((c) => c.id),
      ['l_06', 'l_05', 'l_03', 'l_02', 'l_01'], 'every live match, and never the archived one');
  });

  await t.test('by the name a tag shows, not its id', () => {
    assert.deepEqual(lessons.search(SET, 'python', names).map((c) => c.id), ['l_05']);
    assert.deepEqual(lessons.search(SET, 'goal_py', {}).map((c) => c.id), ['l_05'], 'the id still works with no names');
  });

  await t.test('blank is no search', () => {
    assert.deepEqual(lessons.search(SET, '   ', names), []);
  });
});

test('the label says which fill, and how many of how many when some are trimmed', () => {
  assert.equal(lessons.modeLabel('newest', 30, 30), 'SHOWING NEWEST');
  assert.equal(lessons.modeLabel('oldest', 8, 30), 'SHOWING OLDEST — 8 OF 30');
  assert.equal(lessons.modeLabel('random', 0, 0), 'SHOWING AT RANDOM');
});
