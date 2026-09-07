'use strict';

const test = require('node:test');
const assert = require('node:assert');
const link = require('../../src/core/link.js');

const {
  UNSUPPORTED, UNLINKED, NEEDS_GRANT, AUTO, EDITED_OUTSIDE, LOCKED,
} = link;

const after = (state, ...events) => events.reduce(link.reduce, state);

/* ---------- detection (decision 32: hidden where the picker is absent) ---------- */

test('detect decides whether any of this exists', async (t) => {
  await t.test('a browser with no picker is unsupported, from any state', () => {
    link.STATES.forEach((state) => {
      assert.equal(link.reduce(state, { type: 'detect', supported: false }), UNSUPPORTED);
    });
  });

  await t.test('a browser with a picker and no workbook is unlinked', () => {
    assert.equal(link.reduce(UNSUPPORTED, { type: 'detect', supported: true }), UNLINKED);
    assert.equal(link.reduce(UNLINKED, { type: 'detect', supported: true }), UNLINKED);
  });

  await t.test('detect never disturbs a workbook that is already linked', () => {
    [NEEDS_GRANT, AUTO, EDITED_OUTSIDE, LOCKED].forEach((state) => {
      assert.equal(link.reduce(state, { type: 'detect', supported: true }), state);
    });
  });

  await t.test('nothing but detect moves an unsupported browser', () => {
    ['linked', 'permission', 'write-ok', 'write-fail', 'newer', 'resolved'].forEach((type) => {
      assert.equal(link.reduce(UNSUPPORTED, { type: type, permission: 'granted' }), UNSUPPORTED);
    });
  });
});

/* ---------- linking, and the per-session grant (decision 33) ---------- */

test('linking lands on the permission the adapter found', async (t) => {
  await t.test('a session that still holds its grant goes straight to auto', () => {
    assert.equal(link.reduce(UNLINKED, { type: 'linked', permission: 'granted' }), AUTO);
  });

  await t.test('a restored handle in a fresh session needs the grant', () => {
    assert.equal(link.reduce(UNLINKED, { type: 'linked', permission: 'prompt' }), NEEDS_GRANT);
    assert.equal(link.reduce(UNLINKED, { type: 'linked' }), NEEDS_GRANT);
  });

  await t.test('unlinking returns to the export flow from anywhere', () => {
    [NEEDS_GRANT, AUTO, EDITED_OUTSIDE, LOCKED].forEach((state) => {
      assert.equal(link.reduce(state, { type: 'unlinked' }), UNLINKED);
    });
  });
});

test('the grant arrives, is dismissed, and can be asked for again', async (t) => {
  await t.test('granted turns needs-grant into auto', () => {
    assert.equal(after(NEEDS_GRANT, { type: 'permission', value: 'granted' }), AUTO);
  });

  await t.test('a dismissal leaves it where it was — the ask can be repeated', () => {
    /* The spike measured Escape and Don-t-Allow both resolving `prompt`, and
       the next ask prompting again (DECISION-LOG 254). */
    assert.equal(after(NEEDS_GRANT, { type: 'permission', value: 'prompt' }), NEEDS_GRANT);
    assert.equal(after(AUTO, { type: 'permission', value: 'prompt' }), NEEDS_GRANT);
  });

  await t.test('a permission report before anything is linked changes nothing', () => {
    assert.equal(link.reduce(UNLINKED, { type: 'permission', value: 'granted' }), UNLINKED);
  });

  await t.test('granted does not lift a locked or edited-outside workbook', () => {
    assert.equal(after(LOCKED, { type: 'permission', value: 'granted' }), LOCKED);
    assert.equal(after(EDITED_OUTSIDE, { type: 'permission', value: 'granted' }), EDITED_OUTSIDE);
  });
});

/* ---------- writes (decision 35, as the spike corrected it) ---------- */

test('a write reports back', async (t) => {
  await t.test('success is auto, from any linked state', () => {
    [NEEDS_GRANT, AUTO, EDITED_OUTSIDE, LOCKED].forEach((state) => {
      assert.equal(link.reduce(state, { type: 'write-ok' }), AUTO);
    });
  });

  await t.test('any failure but a lost grant is a locked workbook', () => {
    ['InvalidStateError', 'NoModificationAllowedError', 'NotFoundError', 'QuotaExceededError', undefined]
      .forEach((name) => {
        assert.equal(link.reduce(AUTO, { type: 'write-fail', name: name }), LOCKED,
          'expected ' + name + ' to lock the workbook');
      });
  });

  await t.test('a lost grant is decision 33, not decision 35', () => {
    assert.equal(link.reduce(AUTO, { type: 'write-fail', name: 'NotAllowedError' }), NEEDS_GRANT);
  });

  await t.test('a locked workbook clears on the next write that works', () => {
    assert.equal(after(AUTO,
      { type: 'write-fail', name: 'InvalidStateError' },
      { type: 'write-ok' }), AUTO);
  });

  await t.test('a write result with no workbook linked changes nothing', () => {
    assert.equal(link.reduce(UNLINKED, { type: 'write-ok' }), UNLINKED);
    assert.equal(link.reduce(UNLINKED, { type: 'write-fail', name: 'InvalidStateError' }), UNLINKED);
  });
});

/* ---------- the file changing underneath (decisions 34 and 37 C) ---------- */

test('a file that changed under us stops the writing', async (t) => {
  await t.test('newer moves any linked state to edited-outside', () => {
    [NEEDS_GRANT, AUTO, LOCKED].forEach((state) => {
      assert.equal(link.reduce(state, { type: 'newer' }), EDITED_OUTSIDE);
    });
  });

  await t.test('answering the prompt returns to auto, and the write follows', () => {
    assert.equal(after(AUTO, { type: 'newer' }, { type: 'resolved' }), AUTO);
  });

  await t.test('edited-outside does not write', () => {
    assert.equal(link.shouldWrite(EDITED_OUTSIDE), false);
  });
});

/* ---------- what may write at all (DECISION-LOG 255) ---------- */

test('shouldWrite: never while the browser would prompt', async (t) => {
  await t.test('auto and locked write; a locked workbook is how a retry happens', () => {
    assert.equal(link.shouldWrite(AUTO), true);
    assert.equal(link.shouldWrite(LOCKED), true);
  });

  await t.test('needs-grant does not: the write would hang on the prompt', () => {
    assert.equal(link.shouldWrite(NEEDS_GRANT), false);
  });

  await t.test('nothing unlinked writes', () => {
    assert.equal(link.shouldWrite(UNLINKED), false);
    assert.equal(link.shouldWrite(UNSUPPORTED), false);
  });
});

/* ---------- the header's one label ---------- */

test('label: one line, in one order of precedence', async (t) => {
  const err = { code: 'blocked', message: 'Meridian cannot save in this browser.' };

  await t.test('a browser that has stopped saving outranks every other state', () => {
    link.STATES.forEach((state) => {
      assert.deepEqual(link.label(state, { error: err, unexported: 3 }),
        { text: 'NOT SAVING', tone: 'error' });
    });
  });

  await t.test('the two warn states', () => {
    assert.deepEqual(link.label(LOCKED, {}), { text: 'WORKBOOK LOCKED', tone: 'warn' });
    assert.deepEqual(link.label(EDITED_OUTSIDE, {}), { text: 'EDITED OUTSIDE', tone: 'warn' });
  });

  await t.test('a pending grant counts what is waiting', () => {
    assert.deepEqual(link.label(NEEDS_GRANT, { unexported: 1 }), { text: 'SAVE · 1', tone: 'live' });
    assert.deepEqual(link.label(NEEDS_GRANT, { unexported: 12 }), { text: 'SAVE · 12', tone: 'live' });
  });

  await t.test('with nothing pending, an ungranted session is still saved', () => {
    /* The file is already right; a session that has not been asked yet has
       nothing to shout about (decision 33). */
    assert.deepEqual(link.label(NEEDS_GRANT, { unexported: 0 }), { text: 'SAVED · AUTO', tone: null });
  });

  await t.test('auto is the calm one', () => {
    assert.deepEqual(link.label(AUTO, { unexported: 0 }), { text: 'SAVED · AUTO', tone: null });
  });

  await t.test('unlinked and unsupported keep the export label this app has always shown', () => {
    assert.deepEqual(link.label(UNLINKED, { exportLabel: '3 unexported changes', unexported: 3 }),
      { text: '3 unexported changes', tone: 'live' });
    assert.deepEqual(link.label(UNSUPPORTED, { exportLabel: 'Exported 2 h ago', unexported: 0 }),
      { text: 'Exported 2 h ago', tone: null });
  });
});

/* ---------- what the control's click does ---------- */

test('action: the click means something different in each state', () => {
  assert.equal(link.action(NEEDS_GRANT), 'grant');
  assert.equal(link.action(EDITED_OUTSIDE), 'resolve');
  assert.equal(link.action(LOCKED), 'retry');
  assert.equal(link.action(AUTO), 'open-data');
  assert.equal(link.action(UNLINKED), 'open-data');
  assert.equal(link.action(UNSUPPORTED), 'open-data');
});
