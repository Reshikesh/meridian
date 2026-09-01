/* Meridian core — ids.
   Pure: no DOM, no storage, no randomness.

   Decision 5 makes the workbook hand-editable, so the friend can type
   `e_0005` into a new row in Excel. An id generator that does not look at what
   already exists would eventually reissue that id, and a duplicate id is silent
   data loss. Every generator here is handed the ids already in play.

   Spec §7's own examples mix two styles: semantic slugs for the things a human
   references in another sheet (`cat_learn`, `goal_py`) and counters for the
   things there are hundreds of (`e_0001`, `l_01`). The seed keeps the slugs —
   a friend typing a `category_id` into an Entries row should read `cat_learn`,
   not `cat_0003` — and everything created at runtime gets a counter.

   Nothing anywhere orders by id: categories order by `sort`, entries by
   (date, id). The counter is for uniqueness and legibility, never for sequence.

   Classic <script src> -> window.Meridian.ids ; CommonJS -> module.exports */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Meridian = root.Meridian || {}).ids = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var PREFIX = {
    entry: 'e_',
    category: 'cat_',
    goal: 'goal_',
    lesson: 'l_'
  };

  /* Four digits is the floor, not the ceiling: `e_9999` is followed by
     `e_10000`, not by a collision. */
  var MIN_DIGITS = 4;

  function pad(n, width) {
    var s = String(n);
    while (s.length < width) s = '0' + s;
    return s;
  }

  function toSet(taken) {
    if (taken instanceof Set) return taken;
    var s = new Set();
    if (Array.isArray(taken)) {
      for (var i = 0; i < taken.length; i++) {
        var v = taken[i];
        if (typeof v === 'string') s.add(v);
        else if (v && typeof v.id === 'string') s.add(v.id);
      }
    }
    return s;
  }

  /* The next free id for `prefix`, given everything already taken.

     Non-conforming ids are simply not counted — `mycat` and `e_abc` are left
     alone rather than parsed into NaN — but they are still in the taken set, so
     the result cannot collide with them either. */
  function nextId(prefix, taken) {
    var set = toSet(taken);
    var re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)$');
    var max = 0;
    set.forEach(function (id) {
      var m = re.exec(id);
      if (m) {
        var n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    });
    var candidate;
    do {
      max += 1;
      candidate = prefix + pad(max, MIN_DIGITS);
    } while (set.has(candidate));
    return candidate;
  }

  /* A run of ids that stay unique against each other as well as against the
     store — an import allocating replacements for a hundred rows would
     otherwise hand out the same id a hundred times. */
  function allocator(taken) {
    var set = new Set();
    toSet(taken).forEach(function (id) { set.add(id); });
    return {
      taken: set,
      claim: function (id) {
        if (typeof id === 'string' && id) set.add(id);
        return id;
      },
      has: function (id) { return set.has(id); },
      next: function (prefix) {
        var id = nextId(prefix, set);
        set.add(id);
        return id;
      }
    };
  }

  return {
    PREFIX: PREFIX,
    MIN_DIGITS: MIN_DIGITS,
    nextId: nextId,
    allocator: allocator
  };
});
