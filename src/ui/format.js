/* Meridian UI — the strings two places have to agree on.

   QUALITY-BAR §5 asks for one persistent indicator that reads "3 unexported
   changes" and then "Exported 2 min ago". The header and the Data sheet both
   show it, so it is written once. The header uppercases it in CSS rather than
   in the string, so there is a single sentence to change. */
(function () {
  'use strict';

  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};

  function parseLocal(iso) {
    if (!iso) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(iso);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  }

  function ago(then, now) {
    var minutes = Math.floor((now - then) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return minutes + ' min ago';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago');
    var days = Math.floor(hours / 24);
    return days + (days === 1 ? ' day ago' : ' days ago');
  }

  /* The last thing that happened to the data, in its own words: a download is
     `Exported 5 hours ago`, a write to the linked workbook is `Saved just now`.
     Both clear the counter, so whichever is newer is the one to name — and with
     no workbook linked `saved_at` is never set and this reads as it always has. */
  function exportLabel(exportInfo, now) {
    var info = exportInfo || {};
    var n = info.unexported || 0;
    if (n > 0) return n + (n === 1 ? ' unexported change' : ' unexported changes');

    var exported = parseLocal(info.exported_at);
    var saved = parseLocal(info.saved_at);
    var latest = !saved || (exported && exported >= saved)
      ? { at: exported, verb: 'Exported ' }
      : { at: saved, verb: 'Saved ' };

    if (latest.at) return latest.verb + ago(latest.at, now || new Date());
    return 'Nothing exported yet';
  }

  /* The linked workbook, as the Data sheet names it: which file, and when the
     app last wrote it (decision 32). The header says something shorter — see
     core/link.js label(). */
  function linkLabel(info, now) {
    if (!info || !info.name) return '';
    if (!info.written_at) return info.name + ' · not written yet';
    return info.name + ' · written ' + ago(new Date(info.written_at), now || new Date());
  }

  ui.format = {
    parseLocal: parseLocal,
    ago: ago,
    exportLabel: exportLabel,
    linkLabel: linkLabel
  };
})();
