/* Meridian core — the linked workbook's state machine.
   Pure: no DOM, no storage, no File System Access API. `src/ui/link.js` owns
   the handle and the writes and reports what happened; this module decides what
   that means and what the header says about it.

   The states are the six the friend can actually be in (decisions 32-35):

     unsupported     the browser has no file picker — Firefox, Safari
     unlinked        no workbook chosen; the export flow is the save path
     needs-grant     a workbook is linked, but this browser session has not been
                     given permission to write it yet (decision 33)
     auto            linked, granted, and everything is on disk
     edited-outside  the file changed under us, so nothing was written (34/37 C)
     locked          the last write failed for any other reason (35)

   Two of those are the spike's corrections rather than the original decisions:
   a write is not attempted while the permission is `prompt`, because the write
   itself would raise the browser's prompt and hang until someone answered it
   (DECISION-LOG 255); and `locked` is keyed to any failure rather than to one
   error name, because the name Chromium actually produces is `InvalidStateError`
   and Excel — the case decision 35 was written around — does not hold the file
   at all (258, 257).

   Classic <script src> -> window.Meridian.link ; CommonJS -> module.exports */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Meridian = root.Meridian || {}).link = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var UNSUPPORTED = 'unsupported';
  var UNLINKED = 'unlinked';
  var NEEDS_GRANT = 'needs-grant';
  var AUTO = 'auto';
  var EDITED_OUTSIDE = 'edited-outside';
  var LOCKED = 'locked';

  var STATES = [UNSUPPORTED, UNLINKED, NEEDS_GRANT, AUTO, EDITED_OUTSIDE, LOCKED];

  /* A grant that is gone is not a broken workbook: it is decision 33's
     SAVE · n, one click from being fixed. Every other rejection is 35. */
  var GRANT_LOST = 'NotAllowedError';

  function isLinked(state) {
    return state === NEEDS_GRANT || state === AUTO || state === EDITED_OUTSIDE || state === LOCKED;
  }

  /* The reducer. Unknown events and impossible transitions return the state
     unchanged rather than throwing: this runs inside a mutation, and a store
     that throws here would lose the entry the friend just typed. */
  function reduce(state, event) {
    var type = event && event.type;

    if (type === 'detect') return event.supported ? (isLinked(state) ? state : UNLINKED) : UNSUPPORTED;

    /* Nothing but `detect` brings a browser without a picker back into play. */
    if (state === UNSUPPORTED) return UNSUPPORTED;

    switch (type) {
      case 'linked':
        /* The adapter reports the permission it found along with the handle, so
           a session that still holds its grant goes straight to auto. */
        return event.permission === 'granted' ? AUTO : NEEDS_GRANT;

      case 'unlinked':
        return UNLINKED;

      case 'permission':
        if (!isLinked(state)) return state;
        if (event.value === 'granted') return state === NEEDS_GRANT ? AUTO : state;
        return NEEDS_GRANT;

      case 'write-ok':
        return isLinked(state) ? AUTO : state;

      case 'write-fail':
        if (!isLinked(state)) return state;
        return event.name === GRANT_LOST ? NEEDS_GRANT : LOCKED;

      /* The file on disk is newer than the mirror we recorded. Decision 37 C:
         nothing is written and the friend decides. */
      case 'newer':
        return isLinked(state) ? EDITED_OUTSIDE : state;

      /* Keep local or Replace local has been answered; the write that follows
         reports its own result. */
      case 'resolved':
        return isLinked(state) ? AUTO : state;

      default:
        return state;
    }
  }

  /* What the header's data control says. One label, in one order of precedence:
     a browser that has stopped saving outranks everything (DECISION-LOG 185),
     then the two warn states, then the pending grant, then the linked calm, and
     at the bottom the unlinked labels this app has always shown. */
  function label(state, opts) {
    var o = opts || {};
    var unexported = o.unexported || 0;

    if (o.error) return { text: 'NOT SAVING', tone: 'error' };

    switch (state) {
      case LOCKED:
        return { text: 'WORKBOOK LOCKED', tone: 'warn' };

      case EDITED_OUTSIDE:
        return { text: 'EDITED OUTSIDE', tone: 'warn' };

      case NEEDS_GRANT:
        /* No pending change means the file is already right, whatever this
           session has been permitted: there is nothing to shout about. */
        return unexported > 0
          ? { text: 'SAVE · ' + unexported, tone: 'live' }
          : { text: 'SAVED · AUTO', tone: null };

      case AUTO:
        return { text: 'SAVED · AUTO', tone: null };

      default:
        /* unlinked and unsupported: the export label, unchanged. */
        return { text: o.exportLabel || '', tone: unexported > 0 ? 'live' : null };
    }
  }

  /* What a click on that control does. Everything else opens the Data sheet,
     which is what it has always done. */
  function action(state) {
    if (state === NEEDS_GRANT) return 'grant';
    if (state === EDITED_OUTSIDE) return 'resolve';
    if (state === LOCKED) return 'retry';
    return 'open-data';
  }

  /* Whether a mutation should try to write at all. `prompt` never writes: the
     write would raise the browser's own prompt and stay pending until someone
     answered it (DECISION-LOG 255). */
  function shouldWrite(state) {
    return state === AUTO || state === LOCKED;
  }

  return {
    UNSUPPORTED: UNSUPPORTED,
    UNLINKED: UNLINKED,
    NEEDS_GRANT: NEEDS_GRANT,
    AUTO: AUTO,
    EDITED_OUTSIDE: EDITED_OUTSIDE,
    LOCKED: LOCKED,
    STATES: STATES,
    GRANT_LOST: GRANT_LOST,
    isLinked: isLinked,
    reduce: reduce,
    label: label,
    action: action,
    shouldWrite: shouldWrite
  };
});
