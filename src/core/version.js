/* Meridian core — the version.
   Pure: no DOM, no storage, no dependencies. Loaded first, before every other
   core module, because `workbook.js` stamps it into every export's Meta sheet
   and the UI reads it at render.

   Decision 28: there is ONE version string in this project and this is it. It
   used to be a literal inside `workbook.js`, invisible to the screens; it is a
   module now so the header, the first-run screen and the Data sheet footer can
   all name the same constant rather than three copies of it drifting apart.

   Three other files carry the same number and are checked against this one by
   `tests/unit/version.test.js`, not by hand:

     package.json          "version"
     dist/CHANGELOG.md     the first `## v` heading
     the release tag       v<VERSION>, cut in Phase 7

   The test is the enforcement. Bump this constant and the suite goes red until
   the other two agree, which is the only way a version stays true in a project
   with no build step to derive it.

   `DISPLAY` is the caps-label form the screens show — the wordmark is set in
   caps everywhere in this app, so `MERIDIAN 1.1.0` is the string, not a
   sentence-case one that CSS would have to shout.

   Classic <script src> -> window.Meridian.version ; CommonJS -> module.exports */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Meridian = root.Meridian || {}).version = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '1.3.0';

  return {
    VERSION: VERSION,
    /* The Data sheet footer and the first-run screen. */
    DISPLAY: 'MERIDIAN ' + VERSION,
    /* The header wordmark's tooltip — sentence case, because a title attribute
       is read by a screen reader and by a tooltip, neither of which is styled. */
    TITLE: 'Meridian ' + VERSION
  };
});
