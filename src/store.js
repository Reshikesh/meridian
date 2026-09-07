/* Meridian — the store.
   The single place data lives. Not core: it is allowed to touch localStorage.
   It is still allowed no DOM beyond the `beforeunload` guard, which takes its
   window as a parameter.

   QUALITY-BAR §6: every mutation reaches localStorage synchronously, in the same
   event, so a reload at any moment shows the same state. Nothing here is
   debounced, batched or deferred; if a write fails the failure is surfaced, not
   swallowed — "nothing may be lost" is the whole point of the phase.

   Classic <script src> -> window.Meridian.createStore ; CommonJS -> module.exports */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(
    isNode ? require('./core/dates.js') : root.Meridian.dates,
    isNode ? require('./core/ids.js') : root.Meridian.ids,
    isNode ? require('./core/validate.js') : root.Meridian.validate,
    isNode ? require('./core/workbook.js') : root.Meridian.workbook
  );
  if (isNode) module.exports = api;
  else {
    root.Meridian = root.Meridian || {};
    root.Meridian.createStore = api.createStore;
    root.Meridian.storeKeys = api.KEYS;
    root.Meridian.safeStorage = api.safeStorage;
    root.Meridian.installUnloadGuard = api.installUnloadGuard;
    root.Meridian.installStorageWatch = api.installStorageWatch;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (dates, ids, validate, workbook) {
  'use strict';

  var KEYS = {
    data: 'meridian:data',
    theme: 'meridian:theme',      // its own raw string: the pre-paint script in
    range: 'meridian:range',      // index.html must never JSON.parse
    lessons: 'meridian:lessons',  // the wall's visit count (decision 25)
    link: 'meridian:link'         // the linked workbook's name and last mirror
  };

  /* localStorage has three distinct ways of not being there, and two of them
     survive a `typeof` guard: the property can be null (storage disabled), the
     getter itself can throw SecurityError (blocked origin), and a write can
     throw QuotaExceededError at around 5 MB. All three land here. */
  function safeStorage(win) {
    var ls = null;
    try { ls = win.localStorage || null; } catch (e) { ls = null; }
    return {
      available: !!ls,
      getItem: function (k) {
        try { return ls ? ls.getItem(k) : null; } catch (e) { return null; }
      },
      setItem: function (k, v) {
        if (!ls) return { ok: false, reason: 'unavailable' };
        try { ls.setItem(k, v); return { ok: true }; } catch (e) {
          return { ok: false, reason: e && e.name === 'QuotaExceededError' ? 'full' : 'blocked' };
        }
      },
      removeItem: function (k) {
        try { if (ls) ls.removeItem(k); return { ok: true }; } catch (e) { return { ok: false, reason: 'blocked' }; }
      }
    };
  }

  function memoryStorage() {
    var map = Object.create(null);
    return {
      available: true,
      getItem: function (k) { return k in map ? map[k] : null; },
      setItem: function (k, v) { map[k] = String(v); return { ok: true }; },
      removeItem: function (k) { delete map[k]; return { ok: true }; }
    };
  }

  var WRITE_MESSAGE = {
    full: 'This browser has run out of room to save. Export your workbook now — the change you just made is on screen but not saved.',
    blocked: 'This browser is not letting Meridian save. Export your workbook now — the change you just made is on screen but not saved.',
    unavailable: 'This browser has saving switched off. Meridian will work until you close the tab, but nothing is being saved. Export before you go.'
  };

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function createStore(opts) {
    opts = opts || {};
    var storage = opts.storage || memoryStorage();
    var clock = opts.now || function () { return new Date(); };

    var state = null;
    var error = null;
    var listeners = [];

    /* Set by `onCounted`. One hook, not a list: there is exactly one linked
       workbook, and a second subscriber would mean a second writer. */
    var counted = null;

    function notify() {
      for (var i = 0; i < listeners.length; i++) listeners[i](state);
    }

    /* What this store last read or wrote. A `storage` event carrying exactly
       this is our own echo in some browsers and is ignored. */
    var lastSeen = null;

    function persist() {
      if (state === null) {
        storage.removeItem(KEYS.data);
        lastSeen = null;
        return true;
      }
      var json = JSON.stringify(state);
      var res = storage.setItem(KEYS.data, json);
      if (!res.ok) {
        error = { code: res.reason, message: WRITE_MESSAGE[res.reason] || WRITE_MESSAGE.blocked };
        return false;
      }
      lastSeen = json;
      error = null;
      return true;
    }

    /* Every mutation goes through here: reduce, then write, then tell the UI.
       `changes` is how much the unexported counter moves — 1 for a normal edit,
       0 for loading demo data (a regenerable dataset is not an unsaved change),
       and 1 for a completed import (one deliberate act, not one per row). */
    function commit(next, changes) {
      state = next;
      if (state && changes) {
        state.exportInfo = state.exportInfo || { unexported: 0, exported_at: null };
        state.exportInfo.unexported += changes;
      }
      persist();
      notify();
      /* Decision 32: the linked workbook is written after every mutation that
         moves the counter, and after nothing else — a theme change or the demo
         dataset must not rewrite the friend's file. Called last, and only when
         localStorage took the change, so the live copy is safe before anything
         touches the disk. Synchronous, inside the same click or Enter, because
         the permission prompt decision 33 raises needs that user gesture. */
      if (counted && changes && !error) {
        try { counted(state); } catch (e) { /* a mirror must never lose an entry */ }
      }
      return { ok: !error, error: error };
    }

    function load() {
      var raw = storage.getItem(KEYS.data);
      if (!raw) {
        if (!storage.available) error = { code: 'unavailable', message: WRITE_MESSAGE.unavailable };
        return null;
      }
      try {
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.categories)) return null;
        parsed.settings = Object.assign(workbook.defaultSettings(), parsed.settings || {});
        parsed.goals = parsed.goals || [];
        parsed.entries = parsed.entries || [];
        parsed.plan = parsed.plan || [];
        parsed.lessons = parsed.lessons || [];
        parsed.exportInfo = parsed.exportInfo || { unexported: 0, exported_at: null };
        state = parsed;
        lastSeen = raw;
        return state;
      } catch (e) {
        /* Unreadable saved data is not silently discarded — the key is left
           alone so an export of the previous session is still recoverable by
           hand, and the app opens on first run. */
        error = { code: 'corrupt', message: 'The data saved in this browser could not be read. Meridian has started fresh; your last export is still on disk.' };
        return null;
      }
    }

    function allocator() {
      var taken = [];
      ['categories', 'goals', 'entries', 'lessons'].forEach(function (k) {
        (state[k] || []).forEach(function (r) { taken.push(r.id); });
      });
      return ids.allocator(taken);
    }

    function next() {
      return workbook.canonical(clone(state));
    }

    function indexOfId(list, id) {
      for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
      return -1;
    }

    /* Another window of the same file:// origin wrote the shared key. Take it:
       both windows are the same person and the same dataset, and the only
       alternative on a blind whole-blob write is that whichever window is
       touched last silently overwrites the other's day.

       Returns true when the state actually moved, so the caller can tell the
       UI. A value identical to what we last read or wrote is our own echo. */
    function adoptExternal(raw) {
      if (raw === lastSeen) return false;
      if (raw === null || raw === undefined) {
        /* The other window cleared everything (Start fresh). Follow it rather
           than writing our stale copy back over the emptiness. */
        state = null;
        lastSeen = null;
        notify();
        return true;
      }
      try {
        var parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.categories)) return false;
      } catch (e) {
        return false;
      }
      /* load() re-applies the settings defaults and the missing-array repairs,
         so an externally written blob is normalised exactly like a fresh open. */
      load();
      notify();
      return true;
    }

    /* ---------- lifecycle ---------- */

    var api = {
      KEYS: KEYS,
      load: load,
      adoptExternal: adoptExternal,
      getState: function () { return state; },
      hasData: function () { return state !== null; },
      getError: function () { return error; },
      clearError: function () { error = null; notify(); },
      storageAvailable: function () { return storage.available; },

      subscribe: function (fn) {
        listeners.push(fn);
        return function () {
          var i = listeners.indexOf(fn);
          if (i !== -1) listeners.splice(i, 1);
        };
      },

      /* The linked workbook's hook (decision 32). `subscribe` fires for every
         notify, including theme changes and the demo dataset; this fires only
         for the mutations that move the unexported counter, which is exactly
         the set the workbook has to carry. */
      onCounted: function (fn) {
        counted = fn || null;
        return function () { counted = null; };
      },

      /* First run and import both land here. `source` drives the demo badge and
         the counter: demo data is regenerable, so it opens at zero unexported
         changes rather than shouting about eighty-five. */
      replaceAll: function (nextState, source) {
        var s = workbook.canonical(clone(nextState));
        s.source = source || nextState.source || 'import';
        s.exportInfo = { unexported: source === 'import' ? 1 : 0, exported_at: null };
        return commit(s, 0);
      },

      startFresh: function () {
        return commit(null, 0);
      },

      markExported: function (at) {
        if (!state) return { ok: false };
        var s = next();
        s.exportInfo = { unexported: 0, exported_at: dates.isoDateTime(at || clock()) };
        return commit(s, 0);
      },

      /* ---------- entries ---------- */

      addEntry: function (input) {
        var s = next();
        var alloc = allocator();
        var entry = {
          id: input.id || alloc.next(ids.PREFIX.entry),
          date: input.date,
          duration_min: input.duration_min,
          activity: input.activity || null,
          category_id: input.category_id,
          goal_id: input.goal_id || null,
          value: null,                                  // decision 10
          created_at: dates.isoDateTime(clock())
        };
        s.entries.push(entry);
        var res = commit(workbook.canonical(s), 1);
        res.entry = entry;
        return res;
      },

      /* `created_at` is never rewritten: it records when the row was first
         written, and the Log lets you edit a day from the past. */
      updateEntry: function (id, patch) {
        var s = next();
        var i = indexOfId(s.entries, id);
        if (i === -1) return { ok: false, error: { code: 'missing' } };
        var e = s.entries[i];
        ['date', 'duration_min', 'activity', 'category_id', 'goal_id'].forEach(function (k) {
          if (Object.prototype.hasOwnProperty.call(patch, k)) e[k] = patch[k] === undefined ? null : patch[k];
        });
        if (!e.activity) e.activity = null;
        if (!e.goal_id) e.goal_id = null;
        var res = commit(workbook.canonical(s), 1);
        res.entry = e;
        return res;
      },

      deleteEntry: function (id) {
        var s = next();
        var i = indexOfId(s.entries, id);
        if (i === -1) return { ok: false, error: { code: 'missing' } };
        s.entries.splice(i, 1);
        return commit(s, 1);
      },

      /* ---------- categories ---------- */

      addCategory: function (input) {
        var s = next();
        var alloc = allocator();
        var maxSort = s.categories.reduce(function (n, c) { return Math.max(n, Number(c.sort) || 0); }, 0);
        var category = {
          id: input.id || alloc.next(ids.PREFIX.category),
          name: String(input.name).trim(),
          colour: input.colour || null,
          direction: input.direction,
          weekly_plan_hours: Number(input.weekly_plan_hours) || 0,
          weekly_cap_hours: input.weekly_cap_hours === undefined ? null : input.weekly_cap_hours,
          sort: maxSort + 1,
          archived: false,
          archived_on: null
        };
        s.categories.push(category);
        var res = commit(workbook.canonical(s), 1);
        res.category = category;
        return res;
      },

      updateCategory: function (id, patch) {
        var s = next();
        var i = indexOfId(s.categories, id);
        if (i === -1) return { ok: false, error: { code: 'missing' } };
        var c = s.categories[i];
        ['name', 'colour', 'direction', 'weekly_plan_hours', 'weekly_cap_hours', 'sort'].forEach(function (k) {
          if (Object.prototype.hasOwnProperty.call(patch, k)) c[k] = patch[k];
        });
        if (typeof c.name === 'string') c.name = c.name.trim();
        c.weekly_plan_hours = Number(c.weekly_plan_hours) || 0;
        var res = commit(workbook.canonical(s), 1);
        res.category = c;
        return res;
      },

      /* Business rules §8.10 and §8.11: archiving keeps every hour and every
         historical range; it is only the pickers and the plan that the category
         leaves. `archived_on` is the "38 h kept to 26 Apr" date. */
      archiveCategory: function (id, at) {
        var s = next();
        var i = indexOfId(s.categories, id);
        if (i === -1) return { ok: false, error: { code: 'missing' } };
        s.categories[i].archived = true;
        s.categories[i].archived_on = dates.dayKey(dates.logicalDay(at || clock()));
        return commit(s, 1);
      },

      restoreCategory: function (id) {
        var s = next();
        var i = indexOfId(s.categories, id);
        if (i === -1) return { ok: false, error: { code: 'missing' } };
        s.categories[i].archived = false;
        s.categories[i].archived_on = null;
        return commit(s, 1);
      },

      /* Business rule §8.10: delete only clears categories with no hours. The
         guard lives here, not in the sheet, so no screen can route around it. */
      deleteCategory: function (id) {
        var check = validate.canDeleteCategory(state, id);
        if (!check.ok) return { ok: false, error: { code: 'has_hours', minutes: check.minutes } };
        var s = next();
        var i = indexOfId(s.categories, id);
        if (i === -1) return { ok: false, error: { code: 'missing' } };
        s.categories.splice(i, 1);
        s.plan = s.plan.filter(function (p) { return p.category_id !== id; });
        return commit(s, 1);
      },

      /* ---------- goals ---------- */

      addGoal: function (input) {
        var s = next();
        var alloc = allocator();
        var goal = {
          id: input.id || alloc.next(ids.PREFIX.goal),
          short_name: String(input.short_name).trim(),
          identity: input.identity ? String(input.identity).trim() : null,
          category_id: input.category_id,
          target_amount: Number(input.target_amount),
          target_unit: 'h',                             // decision 14
          by_date: input.by_date,
          archived: false
        };
        s.goals.push(goal);
        var res = commit(workbook.canonical(s), 1);
        res.goal = goal;
        return res;
      },

      updateGoal: function (id, patch) {
        var s = next();
        var i = indexOfId(s.goals, id);
        if (i === -1) return { ok: false, error: { code: 'missing' } };
        var g = s.goals[i];
        ['short_name', 'identity', 'category_id', 'target_amount', 'by_date'].forEach(function (k) {
          if (Object.prototype.hasOwnProperty.call(patch, k)) g[k] = patch[k];
        });
        if (!g.identity) g.identity = null;
        g.target_amount = Number(g.target_amount);
        var res = commit(workbook.canonical(s), 1);
        res.goal = g;
        return res;
      },

      /* "Archived goals keep their hours. Nothing is deleted." (spec §6) — the
         entries keep pointing at it, so past ranges still attribute them. */
      archiveGoal: function (id) {
        var s = next();
        var i = indexOfId(s.goals, id);
        if (i === -1) return { ok: false, error: { code: 'missing' } };
        s.goals[i].archived = true;
        return commit(s, 1);
      },

      restoreGoal: function (id) {
        var s = next();
        var i = indexOfId(s.goals, id);
        if (i === -1) return { ok: false, error: { code: 'missing' } };
        s.goals[i].archived = false;
        return commit(s, 1);
      },

      /* ---------- lessons (decision 25) ----------
         A journal: written whenever, with or without a title, pinned or not.
         Archive takes a card off the wall and keeps it; delete is for good,
         and is the one permanent removal in the app — the owner asked for
         it on the card and again from the archive, both behind a confirm. */

      addLesson: function (input) {
        var s = next();
        var alloc = allocator();
        var day = input.date || dates.dayKey(dates.logicalDay(clock()));
        var lesson = {
          id: input.id || alloc.next(ids.PREFIX.lesson),
          iso_week: dates.weekKey(dates.toDate(day)),
          date: day,
          title: input.title ? String(input.title).trim() || null : null,
          text: String(input.text || '').trim(),
          tags: (input.tags || []).slice(),
          pinned: !!input.pinned,
          archived: false
        };
        s.lessons.push(lesson);
        var res = commit(workbook.canonical(s), 1);
        res.lesson = lesson;
        return res;
      },

      /* The date and week are when it was written and stay so. */
      updateLesson: function (id, patch) {
        var s = next();
        var i = indexOfId(s.lessons, id);
        if (i === -1) return { ok: false, error: { code: 'missing' } };
        var l = s.lessons[i];
        if (Object.prototype.hasOwnProperty.call(patch, 'title')) {
          l.title = patch.title ? String(patch.title).trim() || null : null;
        }
        if (Object.prototype.hasOwnProperty.call(patch, 'text')) l.text = String(patch.text || '').trim();
        if (Object.prototype.hasOwnProperty.call(patch, 'tags')) l.tags = (patch.tags || []).slice();
        var res = commit(workbook.canonical(s), 1);
        res.lesson = l;
        return res;
      },

      pinLesson: function (id, pinned) {
        var s = next();
        var i = indexOfId(s.lessons, id);
        if (i === -1) return { ok: false, error: { code: 'missing' } };
        s.lessons[i].pinned = pinned === undefined ? !s.lessons[i].pinned : !!pinned;
        return commit(s, 1);
      },

      /* Off the wall entirely — nothing faded — and back with restore. A
         pinned card that is archived is unpinned, so restoring it puts it
         back among the rest rather than at the front. */
      archiveLesson: function (id) {
        var s = next();
        var i = indexOfId(s.lessons, id);
        if (i === -1) return { ok: false, error: { code: 'missing' } };
        s.lessons[i].archived = true;
        s.lessons[i].pinned = false;
        return commit(s, 1);
      },

      restoreLesson: function (id) {
        var s = next();
        var i = indexOfId(s.lessons, id);
        if (i === -1) return { ok: false, error: { code: 'missing' } };
        s.lessons[i].archived = false;
        return commit(s, 1);
      },

      deleteLesson: function (id) {
        var s = next();
        var i = indexOfId(s.lessons, id);
        if (i === -1) return { ok: false, error: { code: 'missing' } };
        s.lessons.splice(i, 1);
        return commit(s, 1);
      },

      /* ---------- the analysis range (spec §1) ----------
         Its own key, outside the dataset: it is a view preference, not data,
         so it is not an unexported change and is not in the workbook. The
         shape is the caller’s (src/core/range.js toStored); a failed write
         is not data loss, so it is reported and not treated as an error. */

      readRange: function () {
        var raw = storage.getItem(KEYS.range);
        if (!raw) return null;
        try {
          var o = JSON.parse(raw);
          return o && typeof o === 'object' ? o : null;
        } catch (e) {
          return null;
        }
      },

      writeRange: function (stored) {
        if (!stored) return storage.removeItem(KEYS.range);
        return storage.setItem(KEYS.range, JSON.stringify(stored));
      },

      /* ---------- the linked workbook (decisions 32-37) ----------
         The handle itself cannot live here: it is not JSON, and localStorage
         only holds strings — `src/ui/link.js` keeps it in IndexedDB. What
         belongs here is what a reload and a second window both need to know:
         which file, and the `lastModified` the file had after our last write.

         That figure is the file's own, read back from the file after the write
         closed, never our clock: the spike measured our clock landing 3 ms
         early on one run and 94 ms late on another, and either would make the
         app mistake its own write for someone else's edit (DECISION-LOG 259). */

      readLink: function () {
        var raw = storage.getItem(KEYS.link);
        if (!raw) return null;
        try {
          var o = JSON.parse(raw);
          return o && typeof o === 'object' && o.name ? o : null;
        } catch (e) {
          return null;
        }
      },

      writeLink: function (rec) {
        if (!rec) return storage.removeItem(KEYS.link);
        return storage.setItem(KEYS.link, JSON.stringify({
          name: String(rec.name || ''),
          lastModified: Number(rec.lastModified) || 0,
          written_at: rec.written_at || null
        }));
      },

      /* ---------- the lessons wall's visit count (decision 25) ----------
         The fill rotates newest → oldest → random "from one visit to the
         next", which is only true if the count survives a reload. Like the
         range: a view preference, its own key, not an unexported change. */

      readLessonsVisit: function () {
        var raw = storage.getItem(KEYS.lessons);
        var n = raw === null ? 0 : parseInt(raw, 10);
        return isFinite(n) && n >= 0 ? n : 0;
      },

      writeLessonsVisit: function (n) {
        return storage.setItem(KEYS.lessons, String(Math.max(0, Math.floor(Number(n) || 0))));
      },

      /* ---------- settings ---------- */

      setSettings: function (patch, opts2) {
        var s = next();
        s.settings = Object.assign({}, s.settings, patch);
        return commit(s, (opts2 && opts2.silent) ? 0 : 1);
      }
    };

    return api;
  }

  /* QUALITY-BAR §5: closing the tab with unexported changes triggers the
     browser's own leave warning. Only while there is something to lose. */
  function installUnloadGuard(store, win) {
    var handler = function (event) {
      var s = store.getState();
      if (!s || !s.exportInfo || !s.exportInfo.unexported) return undefined;
      event.preventDefault();
      event.returnValue = '';
      return '';
    };
    win.addEventListener('beforeunload', handler);
    return function () { win.removeEventListener('beforeunload', handler); };
  }

  /* Every copy of index.html on this machine shares one localStorage origin, so
     a second window is not an edge case — it is what happens when the friend
     double-clicks index.html again the next day. `persist` writes the whole
     blob blind, so without this the window touched last would overwrite
     everything the other one logged, which is precisely the loss CLAUDE.md's
     "nothing may be lost" forbids.

     A `storage` event fires only in the OTHER documents of the origin, never in
     the one that wrote, so there is no loop. */
  function installStorageWatch(store, win) {
    var handler = function (event) {
      if (event.key !== null && event.key !== KEYS.data) return;
      store.adoptExternal(event.key === null ? null : event.newValue);
    };
    win.addEventListener('storage', handler);
    return function () { win.removeEventListener('storage', handler); };
  }

  return {
    KEYS: KEYS,
    createStore: createStore,
    safeStorage: safeStorage,
    memoryStorage: memoryStorage,
    installUnloadGuard: installUnloadGuard,
    installStorageWatch: installStorageWatch
  };
});
