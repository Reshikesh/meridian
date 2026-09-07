/* Meridian UI — the linked workbook itself.

   The only module that touches the File System Access API. Like `io.js` it is
   kept out of src/core deliberately: it needs a window, a picker and IndexedDB.
   What it does NOT hold is the reasoning — `src/core/link.js` decides what each
   outcome means and what the header says, and is unit-tested without a browser.

   Why IndexedDB: a `FileSystemFileHandle` is not a string, so localStorage
   cannot hold it, but it is structured-cloneable and survives a browser restart
   in IndexedDB — measured from file:// in both target browsers (DECISION-LOG
   250). The file's name and the `lastModified` of our last write live in
   localStorage beside the rest of the app's state, because a reload and a
   second window both need them.

   Three rules from the spike shape every write here:
     - never write while the permission is `prompt`: the write would raise the
       browser's own prompt and hang until somebody answered it (255);
     - never let two writes overlap: fired together they all report success and
       an arbitrary one wins the file (256);
     - compare the file's own `lastModified`, recorded after the write, not our
       clock (259). */
(function () {
  'use strict';

  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var core = window.Meridian.link;

  var DB_NAME = 'meridian';
  var DB_STORE = 'handles';
  var HANDLE_KEY = 'workbook';

  /* Decision 32: the controls are hidden where the picker is absent. The check
     names the picker and not `FileSystemFileHandle`, which Firefox has for the
     origin-private file system and would answer yes to (DECISION-LOG 261). */
  function supported(win) {
    return typeof (win || window).showOpenFilePicker === 'function';
  }

  /* ---------- the handle store ---------- */

  function openDb() {
    return new Promise(function (resolve, reject) {
      var req;
      try { req = indexedDB.open(DB_NAME, 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        if (!req.result.objectStoreNames.contains(DB_STORE)) req.result.createObjectStore(DB_STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error || new Error('indexeddb')); };
      req.onblocked = function () { reject(new Error('indexeddb blocked')); };
    });
  }

  /* The value, not the request. `get` on a key that is not there completes
     happily with `result` undefined, so this has to read `result` off the
     request rather than test it for truth — resolving the request object itself
     would look exactly like a linked workbook that answers no question. */
  function withStore(mode, fn) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(DB_STORE, mode);
        var req = fn(tx.objectStore(DB_STORE));
        tx.oncomplete = function () {
          db.close();
          resolve(req && typeof req === 'object' && 'result' in req ? req.result : undefined);
        };
        tx.onerror = function () { db.close(); reject(tx.error); };
        tx.onabort = function () { db.close(); reject(tx.error || new Error('aborted')); };
      });
    });
  }

  function loadHandle() {
    return withStore('readonly', function (s) { return s.get(HANDLE_KEY); }).catch(function () { return null; });
  }

  function saveHandle(handle) {
    return withStore('readwrite', function (s) { return s.put(handle, HANDLE_KEY); });
  }

  function dropHandle() {
    return withStore('readwrite', function (s) { return s.delete(HANDLE_KEY); }).catch(function () { return null; });
  }

  /* ---------- the adapter ---------- */

  /* `opts.encode()` returns the bytes to write — the export encoder, so the
     workbook on disk is byte-for-byte what Export would have handed to the
     browser (decision 32). `opts.win` is for the tests. */
  function createLink(store, opts) {
    opts = opts || {};
    var win = opts.win || window;
    var encode = opts.encode;

    var state = supported(win) ? core.UNLINKED : core.UNSUPPORTED;
    var handle = null;
    var listeners = [];

    /* Decision 33 asks once per session, on the mutation's own click. If it is
       dismissed, the SAVE · n control is the way back — the app does not ask
       again on every keystroke that follows. */
    var askedThisSession = false;

    /* The queue (256). `running` is the write in flight; `again` is a mutation
       that arrived while it ran and will be written from the state as it stands
       when its turn comes. */
    var running = null;
    var again = false;

    function notify() {
      for (var i = 0; i < listeners.length; i++) listeners[i](state);
    }

    function dispatch(event) {
      var next = core.reduce(state, event);
      if (next !== state) { state = next; notify(); }
      return state;
    }

    function record() {
      return store.readLink();
    }

    function permission(mode) {
      if (!handle || !handle.queryPermission) return Promise.resolve('prompt');
      return handle.queryPermission({ mode: mode || 'readwrite' }).catch(function () { return 'prompt'; });
    }

    function request() {
      if (!handle || !handle.requestPermission) return Promise.resolve('prompt');
      return handle.requestPermission({ mode: 'readwrite' }).catch(function () { return 'prompt'; });
    }

    /* The file as it is on disk right now. Reads keep working while another
       program holds the file, so this is safe in every state (258). */
    function stat() {
      if (!handle) return Promise.resolve(null);
      return handle.getFile().then(function (f) {
        return { lastModified: f.lastModified, size: f.size, name: f.name };
      });
    }

    /* `written_at` is epoch milliseconds, not the local ISO string the export
       bookkeeping uses: this one is only ever rendered as "written 2 min ago",
       and a number cannot be misparsed. */
    function remember(name, lastModified, now) {
      store.writeLink({
        name: name,
        lastModified: lastModified,
        written_at: (now || new Date()).getTime()
      });
    }

    /* One write: freshness, encode, atomic replace, then read the file's own
       lastModified back. `force` is Keep local answering the decision-15
       prompt, which is the one case that may write over a newer file. */
    function writeOnce(force) {
      if (!handle) return Promise.resolve({ ok: false, skipped: 'unlinked' });

      return stat().then(function (before) {
        var known = record();
        if (!force && before && known && before.lastModified > known.lastModified) {
          dispatch({ type: 'newer' });
          return { ok: false, skipped: 'newer' };
        }

        var bytes = encode();
        var writable;
        return handle.createWritable()
          .then(function (w) { writable = w; return w.write(bytes); })
          .then(function () { return writable.close(); })
          .then(stat)
          .then(function (after) {
            remember(handle.name, after ? after.lastModified : 0);
            dispatch({ type: 'write-ok' });
            store.markExported(new Date());
            return { ok: true };
          })
          .catch(function (e) {
            /* An aborted stream leaves a swap file behind if it is not closed;
               abort is a no-op on a stream that already failed to open. */
            if (writable) { try { writable.abort(); } catch (e2) { /* already gone */ } }
            dispatch({ type: 'write-fail', name: e && e.name });
            return { ok: false, error: e };
          });
      }).catch(function (e) {
        dispatch({ type: 'write-fail', name: e && e.name });
        return { ok: false, error: e };
      });
    }

    /* Queued, and coalescing: a mutation that arrives mid-write is written once
       the current write lands, from the state as it is then. Every mutation is
       already safe in localStorage before any of this runs. */
    function enqueue(force) {
      if (running) {
        again = true;
        return running;
      }
      running = writeOnce(force).then(function (res) {
        running = null;
        if (again) { again = false; return enqueue(false); }
        return res;
      });
      return running;
    }

    var api = {
      state: function () { return state; },
      handle: function () { return handle; },
      info: function () { return record(); },
      supported: function () { return supported(win); },

      subscribe: function (fn) {
        listeners.push(fn);
        return function () {
          var i = listeners.indexOf(fn);
          if (i !== -1) listeners.splice(i, 1);
        };
      },

      /* On load: is there a handle, and does this session still hold its
         grant? The answer is `prompt` on every fresh browser start (251). */
      start: function () {
        dispatch({ type: 'detect', supported: supported(win) });
        if (!supported(win)) return Promise.resolve(state);
        return loadHandle().then(function (h) {
          if (!h) { store.writeLink(null); return state; }
          handle = h;
          return permission().then(function (p) {
            dispatch({ type: 'linked', permission: p });
            return state;
          });
        });
      },

      /* Decision 32: pick an existing workbook. The caller decides what to do
         about a file that already holds a dataset (decision 37 A) — this only
         hands back the handle and what is in the file. */
      pickExisting: function () {
        return win.showOpenFilePicker({
          types: [{
            description: 'Meridian workbook',
            accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
          }],
          multiple: false,
          startIn: 'documents'
        }).then(function (list) { return list[0]; });
      },

      /* The save picker grants readwrite as it returns, so a workbook created
         here needs no prompt in the session that created it (DECISION-LOG 251). */
      pickNew: function () {
        return win.showSaveFilePicker({
          suggestedName: 'meridian.xlsx',
          startIn: 'documents',
          types: [{
            description: 'Meridian workbook',
            accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] }
          }]
        });
      },

      /* Adopt a handle the caller picked: remember it, and write at once so the
         file is a workbook from the moment it is linked. */
      adopt: function (picked, o) {
        var write = !(o && o.write === false);
        handle = picked;
        return saveHandle(picked)
          .catch(function () { /* a browser that will not keep it still links for this session */ })
          .then(function () { return permission(); })
          .then(function (p) {
            dispatch({ type: 'linked', permission: p });
            if (p !== 'granted') return request().then(function (p2) {
              dispatch({ type: 'permission', value: p2 });
              return p2;
            });
            return p;
          })
          .then(function (p) {
            askedThisSession = true;
            /* Record the file as it is before anything is written, so a
               Replace-local link does not then look like an outside edit. */
            return stat().then(function (now) {
              remember(picked.name, now ? now.lastModified : 0);
              if (!write) return { ok: true };
              if (p !== 'granted') return { ok: false, skipped: 'needs-grant' };
              return enqueue(true);
            });
          });
      },

      unlink: function () {
        handle = null;
        askedThisSession = false;
        store.writeLink(null);
        dispatch({ type: 'unlinked' });
        return dropHandle();
      },

      /* The store's counted-mutation hook. Runs inside the click or the Enter
         that caused the mutation, so decision 33's prompt has its gesture. */
      mirror: function () {
        if (!core.isLinked(state)) return Promise.resolve({ ok: false, skipped: state });

        if (state === core.NEEDS_GRANT) {
          if (askedThisSession) return Promise.resolve({ ok: false, skipped: 'needs-grant' });
          askedThisSession = true;
          return request().then(function (p) {
            dispatch({ type: 'permission', value: p });
            if (p !== 'granted') return { ok: false, skipped: 'dismissed' };
            return enqueue(false);
          });
        }

        if (!core.shouldWrite(state)) return Promise.resolve({ ok: false, skipped: state });
        return enqueue(false);
      },

      /* The header control's click, in the state it is in: ask and flush, or
         retry the write that failed. */
      grantAndFlush: function () {
        askedThisSession = true;
        return request().then(function (p) {
          dispatch({ type: 'permission', value: p });
          if (p !== 'granted') return { ok: false, skipped: 'dismissed' };
          return enqueue(false);
        });
      },

      retry: function () {
        return enqueue(false);
      },

      /* Decision 37: Keep local writes over the file there and then. */
      keepLocal: function () {
        dispatch({ type: 'resolved' });
        return enqueue(true);
      },

      /* Replace local has been applied to the store by the caller; the file and
         the app agree again, so record the file as it stands and write nothing. */
      adoptedFile: function () {
        return stat().then(function (after) {
          if (after) remember(handle ? handle.name : (record() || {}).name, after.lastModified);
          dispatch({ type: 'resolved' });
          return { ok: true };
        });
      },

      /* The bytes on disk, for the two moments the caller has to look at the
         file itself: linking one that may hold data, and answering the
         edited-outside prompt. */
      readBytes: function () {
        if (!handle) return Promise.reject(new Error('unlinked'));
        return handle.getFile().then(function (f) {
          return f.arrayBuffer ? f.arrayBuffer() : ui.io.readFile(f);
        });
      },

      /* Reconnect (decision 37 B): is the file newer than our last write? */
      fileIsNewer: function () {
        var known = record();
        if (!known) return Promise.resolve(false);
        return stat().then(function (now) {
          return !!(now && now.lastModified > known.lastModified);
        }).catch(function () { return false; });
      }
    };

    return api;
  }

  ui.link = {
    supported: supported,
    createLink: createLink,
    DB_NAME: DB_NAME,
    DB_STORE: DB_STORE,
    HANDLE_KEY: HANDLE_KEY
  };
})();
