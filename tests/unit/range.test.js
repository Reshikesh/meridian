'use strict';

const test = require('node:test');
const assert = require('node:assert');
const range = require('../../src/core/range.js');

/* The mockup's own today and the demo dataset's fortnight. */
const TODAY = '2026-06-07';
const MIN = '2026-05-25';
const OPTS = { today: TODAY, minDay: MIN };

const r = (start, end) => ({ start, end });

/* ---------- bounds and clamping (rule §8.15) ---------- */

test('bounds: the range lives between the first logged day and today', async (t) => {
  await t.test('the first entry sets the floor', () => {
    const b = range.bounds([{ date: '2026-06-01' }, { date: '2026-05-25' }, { date: '2026-06-07' }], TODAY);
    assert.deepEqual(b, { minDay: MIN, today: TODAY });
  });

  await t.test('an entry dated after today (a hand-edited workbook) moves nothing', () => {
    const b = range.bounds([{ date: '2026-06-09' }, { date: '2026-06-01' }], TODAY);
    assert.equal(b.minDay, '2026-06-01');
    assert.equal(range.bounds([{ date: '2026-06-09' }], TODAY).minDay, TODAY,
      'only future entries: the horizon is today alone');
  });

  await t.test('no entries: today alone', () => {
    assert.deepEqual(range.bounds([], TODAY), { minDay: TODAY, today: TODAY });
  });
});

test('clamp pulls a range inside the bounds rather than discarding it (D5)', () => {
  assert.deepEqual(range.clamp(r('2026-05-01', '2026-06-30'), MIN, TODAY), r(MIN, TODAY));
  assert.deepEqual(range.clamp(r('2026-06-01', '2026-06-03'), MIN, TODAY), r('2026-06-01', '2026-06-03'));
  assert.deepEqual(range.clamp(r('2026-06-03', '2026-06-01'), MIN, TODAY), r('2026-06-01', '2026-06-03'),
    'a backwards range is put in order');
  assert.deepEqual(range.clamp(r('2026-01-01', '2026-01-10'), MIN, TODAY), r(MIN, MIN),
    'wholly before the first day collapses to the first day');
  assert.deepEqual(range.clamp(r('2026-07-01', '2026-07-10'), MIN, TODAY), r(TODAY, TODAY),
    'wholly after today collapses to today');
  assert.deepEqual(range.clamp(null, MIN, TODAY), r(MIN, TODAY), 'nothing means everything');
  assert.deepEqual(range.clamp(r('2026-06-01', '2026-06-03'), '2026-06-09', TODAY), r(TODAY, TODAY),
    'a floor after today cannot invert the range');
});

/* ---------- presets (mockup setPreset / activePreset) ---------- */

test('presets count back from today and clamp to the first logged day', async (t) => {
  const wide = { today: TODAY, minDay: '2025-07-01' };

  await t.test('on a long history the four presets are distinct', () => {
    assert.deepEqual(range.presetRange('30', wide.today, wide.minDay), r('2026-05-09', TODAY));
    assert.deepEqual(range.presetRange('90', wide.today, wide.minDay), r('2026-03-10', TODAY));
    assert.deepEqual(range.presetRange('ytd', wide.today, wide.minDay), r('2026-01-01', TODAY));
    assert.deepEqual(range.presetRange('all', wide.today, wide.minDay), r('2025-07-01', TODAY));
  });

  await t.test('on the 14-day demo every preset clamps to the same fortnight', () => {
    for (const id of range.PRESETS) {
      assert.deepEqual(range.presetRange(id, TODAY, MIN), r(MIN, TODAY), id);
    }
  });

  await t.test('in January YTD is a few days long and clamps like the others', () => {
    assert.deepEqual(range.presetRange('ytd', '2027-01-04', '2025-07-01'), r('2027-01-01', '2027-01-04'));
    assert.deepEqual(range.presetRange('ytd', '2027-01-04', '2027-01-03'), r('2027-01-03', '2027-01-04'));
  });

  await t.test('an unknown preset is null', () => {
    assert.equal(range.presetRange('7', TODAY, MIN), null);
  });
});

test('the lit preset is the mockup rule, verbatim: exact arithmetic, first match in order', async (t) => {
  const wide = '2025-07-01';

  await t.test('each preset on a long history lights itself', () => {
    for (const id of range.PRESETS) {
      assert.equal(range.activePreset(range.presetRange(id, TODAY, wide), TODAY, wide), id, id);
    }
  });

  await t.test('a range that does not end today lights nothing', () => {
    assert.equal(range.activePreset(r('2026-05-09', '2026-06-06'), TODAY, wide), null);
  });

  await t.test('a hand-picked range lights nothing', () => {
    assert.equal(range.activePreset(r('2026-06-01', TODAY), TODAY, wide), null);
  });

  await t.test('on the 14-day demo a 30D click lights ALL, because ALL is what the range is', () => {
    const after30 = range.presetRange('30', TODAY, MIN);
    assert.equal(range.activePreset(after30, TODAY, MIN), 'all');
  });

  await t.test('when 1 January is the first logged day, YTD wins over ALL by order', () => {
    const first = '2026-01-01';
    assert.equal(range.activePreset(r(first, TODAY), TODAY, first), 'ytd');
  });
});

test('the default range is thirty days clamped to the first logged day (Q1)', () => {
  assert.deepEqual(range.defaultRange(TODAY, MIN), r(MIN, TODAY));
  assert.deepEqual(range.defaultRange(TODAY, '2025-07-01'), r('2026-05-09', TODAY));
});

/* ---------- the stored shape (spec §1) ---------- */

test('meridian:range is {s, e} in epoch days and round-trips', async (t) => {
  await t.test('round trip', () => {
    const stored = range.toStored(r(MIN, TODAY));
    assert.deepEqual(stored, { s: 20598, e: 20611 });
    assert.deepEqual(range.fromStored(stored), r(MIN, TODAY));
    assert.deepEqual(range.fromStored(JSON.stringify(stored)), r(MIN, TODAY));
  });

  await t.test('a swapped pair is put in order', () => {
    assert.deepEqual(range.fromStored({ s: 20611, e: 20598 }), r(MIN, TODAY));
  });

  await t.test('anything unreadable is null so the caller can fall back', () => {
    for (const bad of ['{not json', '', null, undefined, {}, { s: 1 }, { s: 'a', e: 2 },
      { s: 1.5, e: 2 }, { s: NaN, e: 2 }, { s: 1e12, e: 1e12 }, [], 42, 'null']) {
      assert.equal(range.fromStored(bad), null, JSON.stringify(bad));
    }
  });
});

/* ---------- the picker (mockup onDay / landRange / undoRange / commitDate) ---------- */

const start = () => range.emptyView(r('2026-05-30', '2026-06-03'));

test('the two-click pick', async (t) => {
  /* The mockup put the clicked day straight into `range`, so between the two
     clicks every figure on the screen recomputed for that single day and the
     range looked as though it had been replaced by a one-day one. The owner
     reported it at the Phase 4 checkpoint as "I am not able to select a third
     date": the third click was landing, it just did not look like the start of
     anything. The landed range is now left alone until a pick completes. */
  await t.test('the first click anchors a day and leaves the landed range alone', () => {
    const before = start();
    const v = range.pick(before, '2026-06-01', OPTS);
    assert.deepEqual(v.range, r('2026-05-30', '2026-06-03'), 'nothing has been replaced yet');
    assert.equal(v.anchor, '2026-06-01');
    assert.equal(v.pending, true);
    assert.equal(v.undo, null);
    assert.equal(range.status(v), 'PICK END DAY');
    assert.equal(range.showUndo(v), false);
  });

  await t.test('a third click starts a fresh pick over a range that is already landed', () => {
    const landed = range.pick(range.pick(start(), '2026-06-01', OPTS), '2026-06-04', OPTS);
    assert.deepEqual(landed.range, r('2026-06-01', '2026-06-04'));

    const again = range.pick(landed, '2026-06-02', OPTS);
    assert.equal(again.pending, true);
    assert.equal(again.anchor, '2026-06-02');
    assert.deepEqual(again.range, r('2026-06-01', '2026-06-04'), 'still the landed range');

    const done = range.pick(again, '2026-06-06', OPTS);
    assert.deepEqual(done.range, r('2026-06-02', '2026-06-06'));
    assert.deepEqual(done.undo, r('2026-06-01', '2026-06-04'), 'undo goes back a whole range');
  });

  await t.test('the second day may come before the first, in which case they swap', () => {
    const v = range.pick(range.pick(start(), '2026-06-05', OPTS), '2026-05-31', OPTS);
    assert.deepEqual(v.range, r('2026-05-31', '2026-06-05'));
    assert.equal(v.anchor, null);
    assert.equal(range.status(v), '6 DAYS');
  });

  await t.test('the second click lands the pair in order, with the pre-pick range as the undo', () => {
    const v = range.pick(range.pick(start(), '2026-06-05', OPTS), '2026-06-02', OPTS);
    assert.deepEqual(v.range, r('2026-06-02', '2026-06-05'));
    assert.equal(v.pending, false);
    assert.equal(v.anchor, null);
    assert.deepEqual(v.undo, r('2026-05-30', '2026-06-03'));
    assert.equal(range.status(v), '4 DAYS');
    assert.equal(range.showUndo(v), true);
  });

  await t.test('picking the same range again arms no undo', () => {
    const v = range.pick(range.pick(start(), '2026-05-30', OPTS), '2026-06-03', OPTS);
    assert.deepEqual(v.range, r('2026-05-30', '2026-06-03'));
    assert.equal(v.undo, null);
  });

  await t.test('a future day and a day before the first entry are ignored', () => {
    const v = start();
    assert.strictEqual(range.pick(v, '2026-06-08', OPTS), v, 'the same view comes back, untouched');
    assert.strictEqual(range.pick(v, '2026-05-24', OPTS), v);
    assert.equal(range.pick(v, TODAY, OPTS).pending, true, 'today itself is selectable');
    assert.equal(range.pick(v, MIN, OPTS).pending, true, 'so is the first logged day');
  });

  await t.test('Escape drops the anchor, leaving the range it never moved (D6)', () => {
    const v = range.abort(range.pick(start(), '2026-06-01', OPTS));
    assert.deepEqual(v.range, r('2026-05-30', '2026-06-03'));
    assert.equal(v.pending, false);
    assert.equal(v.anchor, null);
    assert.equal(v.undo, null);
    const idle = start();
    assert.strictEqual(range.abort(idle), idle, 'Escape with no pick open is a no-op');
  });
});

/* The defect the owner reported after Phase 7. `app.js` keeps this view alive
   across a screen change so a range, an undo or a split is not lost on the way
   to Log and back (117) — and a half-made pick was kept alive with it. The next
   click on the calendar then finished that stale pick instead of starting a new
   range, and every click after it was off by one: land, anchor, land, anchor.
   The screen reads as "the second click does not land", because the click that
   did land was the one the owner meant as a first. */
test('a pick does not outlive the screen it was made on (decision 30)', async (t) => {
  await t.test('clicking the anchor day again lands a one-day range', () => {
    const v = range.pick(range.pick(start(), '2026-06-01', OPTS), '2026-06-01', OPTS);
    assert.deepEqual(v.range, r('2026-06-01', '2026-06-01'));
    assert.equal(v.pending, false);
    assert.equal(v.anchor, null);
    assert.equal(range.status(v), '1 DAYS');
    assert.deepEqual(v.undo, r('2026-05-30', '2026-06-03'));
  });

  /* What a screen switch carries: `app.js` holds this object, abandons any
     pick on it, and the remounted screen draws whatever comes back. */
  await t.test('a pending pick abandoned on the way out remounts as a landed range', () => {
    const pending = range.pick(start(), '2026-06-01', OPTS);
    const carried = range.abort(pending);
    assert.equal(carried.pending, false);
    assert.equal(carried.anchor, null);
    assert.deepEqual(carried.range, r('2026-05-30', '2026-06-03'), 'the range never moved');
    assert.equal(carried.undo, null, 'an abandoned pick arms no undo (122)');
    assert.equal(range.status(carried), '5 DAYS', 'PICK END DAY is gone');
  });

  await t.test('abandoning an idle view is identity, so every screen change is free', () => {
    const idle = start();
    assert.strictEqual(range.abort(idle), idle);
    const once = range.abort(range.pick(idle, '2026-06-01', OPTS));
    assert.strictEqual(range.abort(once), once, 'and abandoning twice changes nothing further');
  });

  /* The whole off-by-one, in one sequence: without the abandon in the middle
     the second assertion below reads r('2026-06-01', '2026-06-05') — the stale
     anchor finishing against a day the owner meant to start with. */
  await t.test('after the switch the next click anchors rather than landing', () => {
    const left = range.abort(range.pick(start(), '2026-06-01', OPTS));

    const first = range.pick(left, '2026-06-05', OPTS);
    assert.equal(first.pending, true, 'it starts a new range');
    assert.equal(first.anchor, '2026-06-05');
    assert.deepEqual(first.range, r('2026-05-30', '2026-06-03'), 'and lands nothing yet');

    const second = range.pick(first, '2026-06-07', OPTS);
    assert.deepEqual(second.range, r('2026-06-05', '2026-06-07'), 'the pair the owner clicked');
    assert.equal(second.pending, false);
  });

  /* 117's own reason for existing is untouched: only the pick is dropped. */
  await t.test('the range, the undo, the split, the sort and the focus all survive', () => {
    const landed = range.pick(range.pick(start(), '2026-06-01', OPTS), '2026-06-04', OPTS);
    const dressed = range.toggleFocus(range.setSort(range.setSplit(landed, 'goal'), 'desc'), 'cat:b');
    const carried = range.abort(dressed);
    assert.deepEqual(carried.range, r('2026-06-01', '2026-06-04'));
    assert.deepEqual(carried.undo, r('2026-05-30', '2026-06-03'));
    assert.equal(carried.split, 'goal');
    assert.equal(carried.sort, 'desc');
    assert.equal(carried.focus, 'cat:b');
  });
});

test('landing arms the undo only when the range actually changed', async (t) => {
  await t.test('a change arms it', () => {
    const v = range.land(start(), r(MIN, TODAY));
    assert.deepEqual(v.undo, r('2026-05-30', '2026-06-03'));
  });

  await t.test('an unchanged landing clears an undo that was showing', () => {
    const armed = range.land(start(), r(MIN, TODAY));
    const again = range.land(armed, r(MIN, TODAY));
    assert.equal(again.undo, null);
  });

  await t.test('undo restores the prior range once', () => {
    const armed = range.land(start(), r(MIN, TODAY));
    const back = range.undo(armed);
    assert.deepEqual(back.range, r('2026-05-30', '2026-06-03'));
    assert.equal(back.undo, null);
    assert.strictEqual(range.undo(back).range, back.range, 'nothing to undo is a no-op');
  });
});

test('presets land, clear the focus, and undo against whatever was showing', async (t) => {
  await t.test('a preset clears the focus even when the band is still there', () => {
    const focused = range.toggleFocus(start(), 'cat:cat_work');
    const v = range.preset(focused, 'all', OPTS);
    assert.deepEqual(v.range, r(MIN, TODAY));
    assert.equal(v.focus, null);
    assert.deepEqual(v.undo, r('2026-05-30', '2026-06-03'));
  });

  /* The mockup undid to the half-made pick, because the pick had already
     overwritten the range. It undoes to the range the owner actually had. */
  await t.test('a preset during a pick abandons it and undoes to the real range', () => {
    const v = range.preset(range.pick(start(), '2026-06-01', OPTS), 'all', OPTS);
    assert.equal(v.pending, false);
    assert.equal(v.anchor, null);
    assert.deepEqual(v.undo, r('2026-05-30', '2026-06-03'));
  });

  await t.test('an unknown preset changes nothing', () => {
    const v = start();
    assert.strictEqual(range.preset(v, 'x', OPTS), v);
  });
});

test('a focused band that leaves the range is dropped, one that stays is kept', async (t) => {
  const nodeIds = (rng) => (rng.start === MIN ? ['cat:a', 'cat:b'] : ['cat:a']);
  const opts = Object.assign({ nodeIds }, OPTS);

  await t.test('land', () => {
    const focused = range.toggleFocus(start(), 'cat:b');
    assert.equal(range.land(focused, r(MIN, TODAY), opts).focus, 'cat:b');
    assert.equal(range.land(focused, r('2026-06-01', TODAY), opts).focus, null);
  });

  /* Decision 30 took the pick out from under this rule rather than changing it:
     the focus is cleared the moment a pick opens, so by the time the second
     click lands there is nothing left for `nodeIds` to judge. Landing by any
     other route — a preset, a typed date, an undo — still applies it. */
  await t.test('a pick clears the focus outright; undo still applies the rule', () => {
    const focused = range.toggleFocus(start(), 'cat:b');
    assert.equal(range.pick(focused, MIN, opts).focus, null, 'gone on the first click');
    const kept = range.pick(range.pick(focused, MIN, opts), TODAY, opts);
    assert.equal(kept.focus, null, 'and it does not come back when the pair lands');
    assert.equal(range.undo(range.land(focused, r(MIN, TODAY), opts), opts).focus, null,
      'undo back to a range without the node drops it');
  });

  await t.test('without a nodeIds function the focus is left alone', () => {
    const focused = range.toggleFocus(start(), 'cat:b');
    assert.equal(range.land(focused, r('2026-06-01', TODAY)).focus, 'cat:b');
  });
});

test('typed dates (mockup commitDate; spec §12 bad input)', async (t) => {
  await t.test('7/6 lands 7 June, day-first, and the range is put in order', () => {
    const out = range.commitTyped(start(), 'end', '7/6', OPTS);
    assert.deepEqual(out.view.range, r('2026-05-30', '2026-06-07'));
    assert.equal(out.day, '2026-06-07');
    assert.deepEqual(out.view.undo, r('2026-05-30', '2026-06-03'), 'a typed date arms the undo');
  });

  await t.test('a start after the end swaps', () => {
    const out = range.commitTyped(start(), 'start', '6 Jun', OPTS);
    assert.deepEqual(out.view.range, r('2026-06-03', '2026-06-06'));
  });

  await t.test('nonsense, 31 Feb and out-of-bounds dates are null so the field reverts', () => {
    for (const bad of ['foo', '31 Feb', '2026-02-31', '', '24/5', '8/6', '1 Jan', '2025-12-31']) {
      assert.equal(range.commitTyped(start(), 'start', bad, OPTS), null, JSON.stringify(bad));
    }
  });

  await t.test('the same date typed again lands unchanged and arms no undo', () => {
    const out = range.commitTyped(start(), 'end', '3 Jun 2026', OPTS);
    assert.deepEqual(out.view.range, start().range);
    assert.equal(out.view.undo, null);
  });
});

test('split, sort and focus', () => {
  const v = range.toggleFocus(start(), 'cat:x');
  assert.equal(v.focus, 'cat:x');
  assert.equal(range.toggleFocus(v, 'cat:x').focus, null, 'a second click clears');
  assert.equal(range.toggleFocus(v, 'cat:y').focus, 'cat:y');
  assert.equal(range.setSplit(v, 'goal').split, 'goal');
  assert.equal(range.setSplit(v, 'goal').focus, null, 'changing the split clears the focus');
  assert.equal(range.setSplit(v, 'cat').focus, null, 'even to the same split (mockup setDim)');
  assert.equal(range.setSplit(v, 'x').split, 'cat', 'an unknown split is ignored');
  assert.equal(range.setSort(v, 'desc').sort, 'desc');
  assert.equal(range.setSort(v, 'x').sort, 'asc');
  assert.equal(range.setSort(v, 'desc').focus, 'cat:x', 'sort keeps the focus');
  assert.equal(range.UNDO_MS, 6000);
});
