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

  function exportLabel(exportInfo, now) {
    var info = exportInfo || {};
    var n = info.unexported || 0;
    if (n > 0) return n + (n === 1 ? ' unexported change' : ' unexported changes');
    var at = parseLocal(info.exported_at);
    if (at) return 'Exported ' + ago(at, now || new Date());
    return 'Nothing exported yet';
  }

  ui.format = {
    parseLocal: parseLocal,
    ago: ago,
    exportLabel: exportLabel
  };
})();
