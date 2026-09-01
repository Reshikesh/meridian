/* Meridian UI — the handful of marks that are not letters.

   Archivo carries no glyph for ✓, ✕, ▲, ▼ or ↩, and the vendored subsets strip
   →. Typing one puts a single character of a different font, at different
   metrics, in the middle of a line — so every mark the app draws is drawn, in
   SVG, in currentColor, and inherits the text colour it sits in. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};

  /* Each path is authored on a 12x12 box so the marks share a weight. */
  var PATHS = {
    close: 'M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5',
    check: 'M2.5 6.4 L5 8.9 L9.5 3.2',
    cross: 'M2.5 2.5 L9.5 9.5 M9.5 2.5 L2.5 9.5',
    arrow: 'M2 6 H9.5 M6.5 3 L9.5 6 L6.5 9',
    download: 'M6 2 V8 M3.2 5.4 L6 8.2 L8.8 5.4 M2.2 10 H9.8',
    upload: 'M6 8.4 V2.4 M3.2 5 L6 2.2 L8.8 5 M2.2 10 H9.8'
  };

  function Glyph(props) {
    var d = PATHS[props.name];
    if (!d) return null;
    var size = props.size || 12;
    return html`
      <svg class="glyph" width=${size} height=${size} viewBox="0 0 12 12"
        aria-hidden="true" focusable="false">
        <path d=${d} fill="none" stroke="currentColor" stroke-width=${props.weight || 1.6}
          stroke-linecap="round" stroke-linejoin="round" />
      </svg>`;
  }

  ui.Glyph = Glyph;
})();
