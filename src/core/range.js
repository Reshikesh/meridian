/* Meridian core — the analysis range (spec §3, §4d; business rule §8.15).
   Pure: no DOM, no storage, no clock of its own. Ranges are day keys,
   `{start, end}`, inclusive at both ends, the same strings entries carry.

   Two things live here. The range rules — presets, clamping to [first logged
   day, today], which preset is lit, the stored shape — and the picker's own
   state machine: the two-click pick, the landing that arms a six-second undo,
   the undo itself, the typed-date commit. They are rules, so they are core,
   and the screen only draws what comes back.

   Ported from the mockup's onDay / landRange / undoRange / setPreset /
   commitDate / activePreset. Where the mockup hard-codes its own horizon
   (1 Jul 2025 to 7 Jun 2026) this takes `today` and `minDay` as arguments.

   Classic <script src> -> window.Meridian.range ; CommonJS -> module.exports */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(isNode ? require('./dates.js') : root.Meridian.dates);
  if (isNode) module.exports = api;
  else (root.Meridian = root.Meridian || {}).range = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (dates) {
  'use strict';

  var PRESETS = ['30', '90', 'ytd', 'all'];
  var SPLITS = ['cat', 'goal'];
  var SORTS = ['desc', 'asc'];

  /* spec §3: "undo armed 6 s". */
  var UNDO_MS = 6000;

  function assign(view, patch) {
    return Object.assign({}, view, patch);
  }

  function shift(dayKey, n) {
    return dates.dayKey(dates.addDays(dayKey, n));
  }

  function jan1(dayKey) {
    return dayKey.slice(0, 4) + '-01-01';
  }

  function same(a, b) {
    return !!a && !!b && a.start === b.start && a.end === b.end;
  }

  /* ---------- bounds and clamping ---------- */

  /* Rule §8.15: the range lives in [first logged day, today]. An entry dated
     after today can arrive through a hand-edited workbook; it is never
     selectable, so it does not move the first day either. With no entries the
     horizon is today alone. */
  function bounds(entries, today) {
    var first = null;
    for (var i = 0; i < (entries || []).length; i++) {
      var d = entries[i].date;
      if (!d || d > today) continue;
      if (first === null || d < first) first = d;
    }
    return { minDay: first === null ? today : first, today: today };
  }

  function normalise(a, b) {
    return a <= b ? { start: a, end: b } : { start: b, end: a };
  }

  function clampDay(d, lo, hi) {
    if (d < lo) return lo;
    if (d > hi) return hi;
    return d;
  }

  /* A stored range that is now out of bounds — the earliest entries were
     deleted, or the day rolled over — is pulled back inside, never thrown away.
     A range wholly outside collapses to the nearer edge. */
  function clamp(range, minDay, today) {
    var lo = minDay <= today ? minDay : today;
    var hi = today;
    var s = (range && range.start) || lo;
    var e = (range && range.end) || hi;
    var r = normalise(s, e);
    return normalise(clampDay(r.start, lo, hi), clampDay(r.end, lo, hi));
  }

  /* ---------- presets ---------- */

  /* Mockup setPreset: 30 and 90 count back from today inclusive, YTD is
     1 January of today's year, ALL is the first logged day; a start before the
     first day is pulled up to it. */
  function presetRange(id, today, minDay) {
    var start;
    if (id === '30') start = shift(today, -29);
    else if (id === '90') start = shift(today, -89);
    else if (id === 'ytd') start = jan1(today);
    else if (id === 'all') start = minDay;
    else return null;
    if (start < minDay) start = minDay;
    return { start: start, end: today };
  }

  /* Mockup activePreset, verbatim: nothing is lit unless the range ends today;
     then the first match in order 30 -> 90 -> YTD -> ALL, compared exactly and
     without clamping. So a 30D click on a dataset younger than thirty days
     lights ALL, because ALL is what the range then is. */
  function activePreset(range, today, minDay) {
    if (!range || range.end !== today) return null;
    var s = range.start;
    if (s === shift(today, -29)) return '30';
    if (s === shift(today, -89)) return '90';
    if (s === jan1(today)) return 'ytd';
    if (s === minDay) return 'all';
    return null;
  }

  /* With nothing stored: the last thirty days, clamped to the first logged
     day. The mockup hard-codes 15 Jan 2026, which cannot apply to real data. */
  function defaultRange(today, minDay) {
    return presetRange('30', today, minDay);
  }

  /* ---------- the stored shape (spec §1) ---------- */

  /* `{"s": <epoch-day>, "e": <epoch-day>}` under `meridian:range`. */
  function toStored(range) {
    return { s: dates.epochDay(range.start), e: dates.epochDay(range.end) };
  }

  /* Validates shape only; the caller clamps against the live dataset. Anything
     unreadable is null, and the caller falls back to the default. */
  function fromStored(raw) {
    var o = raw;
    if (typeof raw === 'string') {
      try { o = JSON.parse(raw); } catch (e) { return null; }
    }
    if (!o || typeof o !== 'object') return null;
    if (!Number.isInteger(o.s) || !Number.isInteger(o.e)) return null;
    var s = dates.fromEpochDay(o.s), e = dates.fromEpochDay(o.e);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
    var sk = dates.dayKey(s), ek = dates.dayKey(e);
    if (!dates.parseDayKey(sk) || !dates.parseDayKey(ek)) return null;
    return normalise(sk, ek);
  }

  /* ---------- the picker's state ---------- */

  /* `range`   what the screen aggregates; during a pick it is the one clicked
               day, as in the mockup.
     `pending` PICK END DAY: one day chosen, waiting for the second.
     `prev`    the range before the first click, restored by Escape and used as
               the undo target when the second click lands.
     `undo`    the range ↩ UNDO would restore, for six seconds after a change.
     `split`   'cat' | 'goal'; `sort` 'asc' | 'desc' (mockup defaults);
     `focus`   the focused band's node id, or null. */
  function emptyView(range) {
    return { range: range, pending: false, prev: null, undo: null, split: 'cat', sort: 'asc', focus: null };
  }

  /* A focused band whose category or goal has no hours in the new range would
     leave every other band dimmed against nothing (spec §4c dims all-but-one),
     so focus clears when its node is not among the new ones. `opts.nodeIds` is
     the caller's `range -> [id]`; without it focus is kept. */
  function keepFocus(view, next, opts) {
    if (!view.focus || !opts || typeof opts.nodeIds !== 'function') return view.focus;
    return opts.nodeIds(next).indexOf(view.focus) === -1 ? null : view.focus;
  }

  /* Mockup landRange: the undo is armed only when the range actually changed,
     and an unchanged landing clears any undo that was showing. `opts.prev` is
     the range to compare against and to offer back; by default the current
     one — which during a pick is the clicked day, as in the mockup. */
  function land(view, next, opts) {
    opts = opts || {};
    var prev = opts.prev || view.range;
    var changed = !same(prev, next);
    return assign(view, {
      range: next,
      pending: false,
      prev: null,
      undo: changed ? prev : null,
      focus: keepFocus(view, next, opts)
    });
  }

  /* Mockup onDay: a future day (or one before the first entry) is ignored; the
     first click starts a pick on that one day and remembers the range it
     replaced; the second click lands the two, whichever order they came in,
     with the pre-pick range as the undo target. Nothing is stored until it
     lands. */
  function pick(view, day, opts) {
    if (day > opts.today || day < opts.minDay) return view;
    if (!view.pending) {
      return assign(view, { range: { start: day, end: day }, pending: true, prev: view.range });
    }
    return land(view, normalise(view.range.start, day), { prev: view.prev, nodeIds: opts.nodeIds });
  }

  /* Escape during PICK END DAY (spec Appendix B, item 6): back to the range
     before the first click, nothing written, no undo armed. */
  function abort(view) {
    if (!view.pending) return view;
    return assign(view, { range: view.prev, pending: false, prev: null });
  }

  function undo(view, opts) {
    if (!view.undo) return view;
    return assign(view, {
      range: view.undo,
      pending: false,
      prev: null,
      undo: null,
      focus: keepFocus(view, view.undo, opts)
    });
  }

  /* Mockup setPreset: lands (undo against whatever the range was, a pending
     day included) and clears the focus. */
  function preset(view, id, opts) {
    var next = presetRange(id, opts.today, opts.minDay);
    if (!next) return view;
    return assign(land(view, next, { nodeIds: opts.nodeIds }), { focus: null });
  }

  /* Mockup commitDate: parse; a date that will not parse or that falls outside
     [first logged day, today] is null, and the field reverts. A good one
     replaces that endpoint, the pair is put in order, and it lands like any
     other change. Returns the view and the day the calendar should scroll to. */
  function commitTyped(view, which, text, opts) {
    var d = dates.parseUserDate(text, { today: opts.today });
    if (!d) return null;
    var k = dates.dayKey(d);
    if (k < opts.minDay || k > opts.today) return null;
    var a = which === 'start' ? k : view.range.start;
    var b = which === 'end' ? k : view.range.end;
    return { view: land(view, normalise(a, b), { nodeIds: opts.nodeIds }), day: k };
  }

  /* Mockup setDim: the split change always clears the focus, even to the same
     split. */
  function setSplit(view, split) {
    if (SPLITS.indexOf(split) === -1) return view;
    return assign(view, { split: split, focus: null });
  }

  function setSort(view, sort) {
    if (SORTS.indexOf(sort) === -1) return view;
    return assign(view, { sort: sort });
  }

  function toggleFocus(view, id) {
    return assign(view, { focus: view.focus === id ? null : id });
  }

  /* The rail's status: `PICK END DAY` while a pick is open, else `{n} DAYS`. */
  function status(view) {
    if (view.pending) return 'PICK END DAY';
    return dates.daySpan(view.range.start, view.range.end) + ' DAYS';
  }

  /* ↩ UNDO replaces the status while an undo is armed and no pick is open
     (mockup showUndo / showDays are complements). */
  function showUndo(view) {
    return !!view.undo && !view.pending;
  }

  return {
    PRESETS: PRESETS,
    SPLITS: SPLITS,
    SORTS: SORTS,
    UNDO_MS: UNDO_MS,
    bounds: bounds,
    normalise: normalise,
    clamp: clamp,
    presetRange: presetRange,
    activePreset: activePreset,
    defaultRange: defaultRange,
    toStored: toStored,
    fromStored: fromStored,
    emptyView: emptyView,
    land: land,
    pick: pick,
    abort: abort,
    undo: undo,
    preset: preset,
    commitTyped: commitTyped,
    setSplit: setSplit,
    setSort: setSort,
    toggleFocus: toggleFocus,
    status: status,
    showUndo: showUndo
  };
});
