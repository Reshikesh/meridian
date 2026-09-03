/* Meridian core — the lessons wall's rules (decision 25).
   Pure: no DOM. Which cards go on the wall, in what order, and what a search
   matches. The screen measures and trims; it decides nothing.

   Classic <script src> -> window.Meridian.lessons ; CommonJS -> module.exports */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Meridian = root.Meridian || {}).lessons = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* The fill rotates through these, one step per visit, and a click on the
     label steps it too. */
  var MODES = ['newest', 'oldest', 'random'];

  var LABEL = {
    newest: 'SHOWING NEWEST',
    oldest: 'SHOWING OLDEST',
    random: 'SHOWING AT RANDOM'
  };

  function modeForVisit(visit) {
    var n = Number(visit) || 0;
    return MODES[((n % MODES.length) + MODES.length) % MODES.length];
  }

  function nextMode(mode) {
    var i = MODES.indexOf(mode);
    return MODES[(i + 1) % MODES.length];
  }

  /* Newest first: by date, then by id so two written on one day keep a
     stable order. */
  function byNewest(a, b) {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  }

  function live(lessons) {
    return (lessons || []).filter(function (l) { return !l.archived; });
  }

  function archived(lessons) {
    return (lessons || []).filter(function (l) { return !!l.archived; }).sort(byNewest);
  }

  /* Fisher–Yates with the caller's random, so a test can hand in a fixed one. */
  function shuffle(list, random) {
    var out = list.slice();
    var rnd = random || Math.random;
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  /* The wall's order: pinned cards first, newest of those first, then the
     rest in the mode's order. The screen renders from the front and trims
     from the end, so the pinned cards are the last to go — and they never
     go, because the screen stops trimming at `pinnedCount`. */
  function wallOrder(lessons, mode, random) {
    var cards = live(lessons);
    var pinned = cards.filter(function (l) { return l.pinned; }).sort(byNewest);
    var rest = cards.filter(function (l) { return !l.pinned; });
    if (mode === 'oldest') rest = rest.sort(byNewest).reverse();
    else if (mode === 'random') rest = shuffle(rest, random);
    else rest = rest.sort(byNewest);
    return { cards: pinned.concat(rest), pinnedCount: pinned.length };
  }

  function norm(s) {
    return String(s === null || s === undefined ? '' : s).toLowerCase();
  }

  /* Every live card whose title, text or tag NAMES carry the query, newest
     first. `names` maps a tag id to what the owner sees, so a search for
     "python" finds a card tagged goal_py. */
  function search(lessons, query, names) {
    var q = norm(query).trim();
    if (!q) return [];
    var lookup = names || {};
    return live(lessons).filter(function (l) {
      if (norm(l.title).indexOf(q) !== -1) return true;
      if (norm(l.text).indexOf(q) !== -1) return true;
      return (l.tags || []).some(function (t) { return norm(lookup[t] || t).indexOf(q) !== -1; });
    }).sort(byNewest);
  }

  /* "SHOWING NEWEST — 8 OF 30", or the label alone when every card is up. */
  function modeLabel(mode, shown, total) {
    var base = LABEL[mode] || LABEL.newest;
    if (total > shown) return base + ' — ' + shown + ' OF ' + total;
    return base;
  }

  return {
    MODES: MODES,
    LABEL: LABEL,
    modeForVisit: modeForVisit,
    nextMode: nextMode,
    byNewest: byNewest,
    live: live,
    archived: archived,
    shuffle: shuffle,
    wallOrder: wallOrder,
    search: search,
    modeLabel: modeLabel
  };
});
