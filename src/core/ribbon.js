/* Meridian core — the ribbon chart's geometry (spec §4c).
   Pure: no DOM. The UI maps what comes out of here straight onto SVG elements
   and adds nothing of its own to the maths.

   Ported from the mockup's `layout()` and `chart()`. The one change: the two
   label columns are fixed pixel widths and only the ribbon span between them
   absorbs the measured width. The mockup scales its whole 900-unit viewBox to
   fit, which at real widths shrinks the labels with it; here the text stays at
   true size, and at the design width the two agree within 2 %.

   Classic <script src> -> window.Meridian.ribbon ; CommonJS -> module.exports */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else (root.Meridian = root.Meridian || {}).ribbon = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* The mockup's constants, verbatim. */
  var PAD = 24;
  var GAP = 9;
  var MINH = 34;
  var BW = 26;
  var XL = 176;             // the trunk's right edge; the LOGGED HOURS column sits left of it
  var ROW = 56;             // per-node height allowance before the 420 floor
  var MIN_H = 420;
  var DEFAULT_WIDTH = 900;  // the mockup's viewBox width
  var RIGHT = 272;          // 900 - 628: bar, leader, name and figures

  /* Below this the ribbon span would be under 126 px. The UI lets the panel
     scroll horizontally rather than squeeze further. */
  var MIN_WIDTH = 600;

  /* Clear air between the end of a name and the start of its figure. */
  var LABEL_GAP = 8;

  var ELLIPSIS = '\u2026';

  /* spec §4c layout(): rows are value-proportional shares of `space`; rows that
     would be under `minH` are pinned to it and the remainder is redistributed
     pro-rata among the rest. Zero total: equal heights. */
  function layout(vals, space, minH) {
    var sum = 0;
    vals.forEach(function (v) { sum += v; });
    if (sum <= 0) return vals.map(function () { return space / vals.length; });
    var hs = vals.map(function (v) { return v / sum * space; });
    var fixed = 0, free = 0;
    hs.forEach(function (h) { if (h < minH) fixed += minH; else free += h; });
    if (fixed > 0 && free > 0) {
      var rem = Math.max(0, space - fixed);
      hs = hs.map(function (h) { return h < minH ? minH : h / free * rem; });
    }
    return hs;
  }

  /* "1 decimal under 10 %" (spec §4c). */
  function pctText(pct) {
    var p = Number(pct) || 0;
    return p.toFixed(p < 10 ? 1 : 0);
  }

  /* Everything the SVG needs, in pixels. `nodes` carry `value` (any unit —
     only proportions matter) and optionally `sub`. `opts.width` is the measured
     panel width; `opts.total` is the trunk figure when it is not the sum of
     the nodes. */
  function geometry(nodes, opts) {
    var W = Math.max(MIN_WIDTH, (opts && opts.width) || DEFAULT_WIDTH);
    var n = nodes.length;
    var xL = XL;
    var xR = W - RIGHT;
    var mid = (xL + xR) / 2;
    var nameX = xR + BW + 16;
    var H = Math.max(MIN_H, n * ROW + PAD * 2);
    var avail = H - PAD * 2;
    var space = avail - GAP * Math.max(0, n - 1);

    var vals = nodes.map(function (d) { return Math.max(0, Number(d.value) || 0); });
    var sum = 0;
    vals.forEach(function (v) { sum += v; });
    var total = (opts && opts.total !== undefined && opts.total !== null) ? Number(opts.total) : sum;
    var hs = layout(vals, space, MINH);

    /* Left trunk: a contiguous stack, vertically centred. Right: the same
       heights with GAP between them, from PAD down. */
    var ty = (H - space) / 2;
    var ry = PAD;
    var rows = nodes.map(function (d, i) {
      var h = hs[i];
      var a = { y0: ty, y1: ty + h };
      ty += h;
      var b = { y0: ry, y1: ry + h };
      ry += h + GAP;
      var lc = (b.y0 + b.y1) / 2;
      var pct = total > 0 ? vals[i] / total * 100 : 0;
      return {
        id: d.id,
        trunk: a,
        right: b,
        height: h,
        centre: lc,
        /* A cubic Bézier pair with both control points at the midpoint x. */
        path: 'M ' + xL + ',' + a.y0 +
          ' C ' + mid + ',' + a.y0 + ' ' + mid + ',' + b.y0 + ' ' + xR + ',' + b.y0 +
          ' L ' + xR + ',' + b.y1 +
          ' C ' + mid + ',' + b.y1 + ' ' + mid + ',' + a.y1 + ' ' + xL + ',' + a.y1 + ' Z',
        leader: { x1: xR + BW + 3, x2: nameX - 8, y: lc },
        nameY: d.sub ? lc - 4 : lc + 3,
        subY: lc + 12,
        pctY: lc - 1,
        hoursY: lc + 15,
        pct: pct,
        pctText: pctText(pct)
      };
    });

    var tc = (H - space) / 2 + space / 2;
    return {
      W: W, H: H, xL: xL, xR: xR, bw: BW, mid: mid, nameX: nameX, space: space, total: total,
      label: { x: xL - BW - 14, titleY: tc - 12, totalY: tc + 14 },
      rows: rows
    };
  }

  /* How wide a name may be once its figure (right-anchored at W) is on the
     same line. */
  function labelBudget(geom, figureWidth) {
    return geom.W - geom.nameX - (Number(figureWidth) || 0) - LABEL_GAP;
  }

  /* SVG text has no text-overflow, so a name that would cross its figure is
     shortened here. `measure(string) -> px` is supplied by the caller: a canvas
     in the app, a fake in the tests. The full text stays available to the
     caller for a <title>. */
  function fitText(text, maxWidth, measure) {
    var s = String(text === null || text === undefined ? '' : text);
    if (!s) return '';
    if (!(maxWidth > 0)) return ELLIPSIS;
    if (measure(s) <= maxWidth) return s;
    for (var i = s.length - 1; i > 0; i--) {
      var cut = s.slice(0, i).replace(/\s+$/, '') + ELLIPSIS;
      if (measure(cut) <= maxWidth) return cut;
    }
    return ELLIPSIS;
  }

  return {
    PAD: PAD,
    GAP: GAP,
    MINH: MINH,
    BW: BW,
    XL: XL,
    RIGHT: RIGHT,
    ROW: ROW,
    MIN_H: MIN_H,
    DEFAULT_WIDTH: DEFAULT_WIDTH,
    MIN_WIDTH: MIN_WIDTH,
    LABEL_GAP: LABEL_GAP,
    ELLIPSIS: ELLIPSIS,
    layout: layout,
    pctText: pctText,
    geometry: geometry,
    labelBudget: labelBudget,
    fitText: fitText
  };
});
