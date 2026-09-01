'use strict';

const test = require('node:test');
const assert = require('node:assert');
const ids = require('../../src/core/ids.js');

/* Decision 5 makes the workbook hand-editable, so the friend can type an id into
   Excel that the app has never issued. Every test here is a way that could
   silently overwrite one of their rows. */

test('nextId never collides with an id already in play', async (t) => {
  await t.test('starts at 0001 on an empty dataset', () => {
    assert.equal(ids.nextId('e_', []), 'e_0001');
  });

  await t.test('continues past the highest existing number', () => {
    assert.equal(ids.nextId('e_', ['e_0001', 'e_0002', 'e_0007']), 'e_0008');
  });

  await t.test('a gap in the middle is not reused', () => {
    // Reusing e_0002 would attach new hours to a row the friend deleted.
    assert.equal(ids.nextId('e_', ['e_0001', 'e_0003']), 'e_0004');
  });

  await t.test('grows past four digits rather than colliding', () => {
    assert.equal(ids.nextId('e_', ['e_9999']), 'e_10000');
  });

  await t.test('ids that do not fit the pattern are left alone but still block', () => {
    assert.equal(ids.nextId('cat_', ['cat_learn', 'cat_work']), 'cat_0001');
    assert.equal(ids.nextId('e_', ['e_abc', 'mycat', 'e_0001']), 'e_0002');
    assert.equal(ids.nextId('e_', ['e_0001', 'e_0002']), 'e_0003');
  });

  await t.test('a hand-typed id in the way is skipped, not overwritten', () => {
    assert.equal(ids.nextId('e_', ['e_0003', 'e_0004']), 'e_0005');
  });

  await t.test('accepts records as well as strings', () => {
    assert.equal(ids.nextId('goal_', [{ id: 'goal_0001' }, { id: 'goal_0009' }]), 'goal_0010');
  });

  await t.test('the prefix is matched literally, not as a pattern', () => {
    // A prefix with a regex character must not match by accident.
    assert.equal(ids.nextId('a.b_', ['axb_0004']), 'a.b_0001');
  });
});

test('an allocator keeps a whole batch unique against itself', () => {
  const alloc = ids.allocator(['e_0001']);
  const issued = [alloc.next('e_'), alloc.next('e_'), alloc.next('e_')];
  assert.deepEqual(issued, ['e_0002', 'e_0003', 'e_0004']);
  assert.equal(new Set(issued).size, 3, 'an import of 100 rows must not issue one id 100 times');
});

test('an allocator can be told about ids as they are claimed', () => {
  const alloc = ids.allocator([]);
  alloc.claim('e_0005');
  assert.ok(alloc.has('e_0005'));
  assert.equal(alloc.next('e_'), 'e_0006');
});

test('the prefixes are the ones spec §7 uses', () => {
  assert.deepEqual(ids.PREFIX, { entry: 'e_', category: 'cat_', goal: 'goal_', lesson: 'l_' });
});
