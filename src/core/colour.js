/* Meridian core — colour contrast.
   Pure: no DOM, no storage, no clock of its own.

   QUALITY-BAR §7: the category swatches are the fixed hexes of spec §5 and are
   theme-invariant, so on graphite (a dark background) some of them — #2b4a7d
   most of all — sit almost on top of it. The rule is that a swatch under 3:1
   against the theme's own `--bg` is drawn with a 1px `--line` outline, and the
   colour itself is never changed.

   Which means the check has to know each theme's background. The three values
   below are copied from `styles/tokens.css`, and `tests/unit/tokens.test.js`
   parses that file and asserts they still match, so the two cannot drift.

   Classic <script src> -> window.Meridian.colour ; CommonJS -> module.exports */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Meridian = root.Meridian || {}).colour = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* `--bg` per theme, from styles/tokens.css. */
  var THEME_BG = {
    paper: '#fbfaf8',
    graphite: '#16171a',
    blueprint: '#eef1f4'
  };

  /* WCAG 2.1 says a swatch is a non-text graphic, so the threshold is 3:1. */
  var MIN_RATIO = 3;

  function parseHex(hex) {
    if (typeof hex !== 'string') return null;
    var s = hex.trim().replace(/^#/, '');
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
    return [
      parseInt(s.slice(0, 2), 16),
      parseInt(s.slice(2, 4), 16),
      parseInt(s.slice(4, 6), 16)
    ];
  }

  /* WCAG relative luminance. The 0.03928 branch is the sRGB transfer curve's
     linear segment near black; dropping it would overstate the contrast of the
     darkest swatches, which are exactly the ones this check exists for. */
  function channel(v) {
    var c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  function luminance(hex) {
    var rgb = parseHex(hex);
    if (!rgb) return null;
    return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  }

  /* 1..21. Null if either colour is not a hex we can read — the caller then
     leaves the swatch alone rather than outlining it on a guess. */
  function contrastRatio(a, b) {
    var la = luminance(a);
    var lb = luminance(b);
    if (la === null || lb === null) return null;
    var hi = Math.max(la, lb);
    var lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }

  /* The one question the UI asks: does this swatch need its outline in this
     theme? An unknown theme or an unreadable colour answers "no". */
  function needsOutline(hex, theme) {
    var bg = THEME_BG[theme];
    if (!bg) return false;
    var ratio = contrastRatio(hex, bg);
    return ratio !== null && ratio < MIN_RATIO;
  }

  return {
    THEME_BG: THEME_BG,
    MIN_RATIO: MIN_RATIO,
    parseHex: parseHex,
    luminance: luminance,
    contrastRatio: contrastRatio,
    needsOutline: needsOutline
  };
});
