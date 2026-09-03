/* Meridian core — the Progress chart's geometry (spec §4e, decision 27).
   Pure: no DOM. The UI maps what comes out of here straight onto SVG elements
   and adds nothing of its own to the maths.

   The mockup's chart is one goal, hard-coded, in an 880×330 viewBox. Decision
   27 makes it computed and puts every live goal on it, so this is a port of
   its proportions rather than its numbers: the same gutters, the same axis
   placement, the same 24px band above the plot for the date labels — with
   as many bands as the labels need, and a vertical axis in PERCENT OF TARGET
   so a 60-hour and a 130-hour goal aim at the same line. As in ribbon.js, the
   width is measured and the text stays at true size.

   Classic <script src> -> window.Meridian.timeline ; CommonJS -> module.exports */
(function (root, factory) {
  var isNode = typeof module === 'object' && module.exports;
  var api = factory(isNode ? require('./dates.js') : root.Meridian.dates);
  if (isNode) module.exports = api;
  else (root.Meridian = root.Meridian || {}).timeline = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (dates) {
  'use strict';

  /* The mockup's constants: x from 56 to 856 of 880, the 100 % line at y=43
     under a 24px band, the axis at 290 of 330 with the week labels 18 below. */
  var PAD_L = 56;
  var PAD_R = 24;
  var TOP = 24;              // the first label band
  var LANE_H = 19;           // each further band of labels
  var HEAD = 19;             // from the last band to the 100 % line
  var FOOT = 40;             // from the axis to the bottom edge
  var DEFAULT_HEIGHT = 330;  // at one band, so the mockup's proportions hold
  var DEFAULT_WIDTH = 880;
  var MIN_WIDTH = 320;
  var MIN_PLOT_DAYS = 14;    // a chart never spans less than a fortnight
  var MAX_WEEKS_AHEAD = 104; // a landing beyond two years is drawn to the edge
  var LABEL_GAP = 10;        // clear air between two labels in one band
  var LABEL_OFF = 5;         // from a marker line to its label
  var TICK_LABEL_Y = 18;     // week labels sit this far under the axis
  var RIGHT_PAD = 0.08;      // air past the last marker, as a share of the span
  var RIGHT_PAD_DAYS = 3;    // and never less than this

  /* Week steps a reader can count in: the mockup's six, and its neighbours. */
  var WEEK_STEPS = [1, 2, 3, 4, 6, 8, 12, 13, 26, 52, 104];

  /* The fonts the labels are set in, for the width estimate. */
  var FONT = { mark: '600 13px', axis: '400 16px' };

  /* Without a measurer (the tests, a browser with no canvas) a label is
     estimated at 0.62 em a character, which over-measures caps slightly and so
     errs towards a new band rather than an overlap. */
  function estimate(text, font) {
    var px = parseFloat(String(font).split(' ')[1]) || 13;
    return String(text).length * px * 0.62;
  }

  function maxTicks(width) {
    return width >= 700 ? 5 : width >= 480 ? 4 : 3;
  }

  /* Percent of target, unclamped: the figure stays honest past 100. */
  function pct(hours, target) {
    return target > 0 ? hours / target * 100 : 0;
  }

  /* The label above a marker: `30 SEP`, or `30 SEP 2027` once the date is
     outside the next twelve months, since a bare day-month would then read
     as the wrong year. */
  function markText(dayKey, todayKey) {
    var d = dates.toDate(dayKey);
    if (!d) return '';
    var far = Math.abs(dates.diffDays(todayKey, dayKey)) > 365;
    return (far ? dates.formatLong(d) : dates.formatDayMonth(d)).toUpperCase();
  }

  /* Week ticks on Mondays from the first Monday in view, at the smallest
     step that keeps the count within what the width can carry. */
  function weekTicks(e0, e1, width) {
    var spanWeeks = Math.ceil((e1 - e0) / 7);
    var step = WEEK_STEPS[WEEK_STEPS.length - 1];
    for (var i = 0; i < WEEK_STEPS.length; i++) {
      if (spanWeeks / WEEK_STEPS[i] <= maxTicks(width)) { step = WEEK_STEPS[i]; break; }
    }
    var first = dates.epochDay(dates.weekStart(dates.fromEpochDay(e0)));
    if (first < e0) first += 7;
    var out = [];
    for (var e = first; e <= e1; e += step * 7) {
      out.push({ epoch: e, label: 'W' + dates.isoWeek(dates.fromEpochDay(e)) });
    }
    return { ticks: out, stepWeeks: step };
  }

  /* Labels in one band cannot touch; a label that would is moved to the next
     band down. Sorted by x first, so the bands fill left to right and the
     result does not depend on the order the goals came in. */
  function assignLanes(labels) {
    var sorted = labels.slice().sort(function (a, b) { return a.left - b.left || a.right - b.right; });
    var lanes = [];
    sorted.forEach(function (l) {
      for (var i = 0; ; i++) {
        if (lanes[i] === undefined) { lanes[i] = l.right; l.lane = i; break; }
        if (lanes[i] + LABEL_GAP <= l.left) { lanes[i] = l.right; l.lane = i; break; }
      }
    });
    return Math.max(1, lanes.length);
  }

  /* `lines` are projection.series() results, one per goal switched on, each
     with `colour` and `dashed` added by the caller. `opts`: today (day key),
     width (measured px), measure(text, font) -> px. */
  function layout(lines, opts) {
    var todayKey = opts.today;
    var W = Math.max(MIN_WIDTH, opts.width || DEFAULT_WIDTH);
    var measure = opts.measure || estimate;
    var today = dates.epochDay(todayKey);
    var capEpoch = today + MAX_WEEKS_AHEAD * 7;

    /* ---- the x domain: the earliest history to the latest date in view ---- */
    var e0 = today - 1;
    var e1 = today + 1;
    var yMax = 100;
    lines.forEach(function (s) {
      if (s.points.length) e0 = Math.min(e0, dates.epochDay(s.points[0].day));
      if (s.byDate) e1 = Math.max(e1, dates.epochDay(s.byDate));
      if (s.landing) e1 = Math.max(e1, Math.min(capEpoch, dates.epochDay(s.landing)));
      s.points.forEach(function (p) { yMax = Math.max(yMax, pct(p.hours, s.target)); });
    });
    e1 += Math.max(RIGHT_PAD_DAYS, Math.round((e1 - e0) * RIGHT_PAD));
    if (e1 - e0 < MIN_PLOT_DAYS) e1 = e0 + MIN_PLOT_DAYS;
    yMax = Math.ceil(yMax / 10) * 10;

    var xL = PAD_L;
    var xR = W - PAD_R;
    function x(epoch) { return xL + (epoch - e0) / (e1 - e0) * (xR - xL); }
    function xDay(dayKey) { return x(dates.epochDay(dayKey)); }

    /* ---- the marker labels, and how many bands they need ---- */
    var labels = [];
    lines.forEach(function (s) {
      if (s.byDate) {
        var tx = xDay(s.byDate);
        var tt = markText(s.byDate, todayKey);
        var tw = measure(tt, FONT.mark);
        /* Left of its line, as the mockup's TARGET label sits; flipped when
           that would run into the axis labels. */
        var tEnd = tx - LABEL_OFF - tw >= xL;
        labels.push({ id: s.goal.id, kind: 'target', x: tx, text: tt, width: tw,
          anchor: tEnd ? 'end' : 'start', tone: 'ink',
          left: tEnd ? tx - LABEL_OFF - tw : tx + LABEL_OFF,
          right: tEnd ? tx - LABEL_OFF : tx + LABEL_OFF + tw });
      }
      if (s.landing) {
        var le = dates.epochDay(s.landing);
        var clipped = le > capEpoch;
        var lx = x(Math.min(le, capEpoch));
        var lt = markText(s.landing, todayKey);
        var lw = measure(lt, FONT.mark);
        var lStart = lx + LABEL_OFF + lw <= xR + PAD_R;
        labels.push({ id: s.goal.id, kind: 'landing', x: lx, text: lt, width: lw,
          anchor: lStart ? 'start' : 'end', tone: s.late ? 'warn' : 'ink2', clipped: clipped,
          left: lStart ? lx + LABEL_OFF : lx - LABEL_OFF - lw,
          right: lStart ? lx + LABEL_OFF + lw : lx - LABEL_OFF });
      }
    });
    var lanes = assignLanes(labels);

    /* ---- the y scale ---- */
    var yTop = TOP + (lanes - 1) * LANE_H + HEAD;   // where 100 % sits when yMax is 100
    var H = DEFAULT_HEIGHT + (lanes - 1) * LANE_H;
    var y0 = H - FOOT;
    function y(p) { return y0 - p / yMax * (y0 - yTop); }

    labels.forEach(function (l) { l.y = TOP + l.lane * LANE_H + 12; });

    /* A marker line rises to the top of its own label's band, as the mockup's
       TARGET line does — unless a label in a band below crosses its x, in
       which case it stops under the bands rather than run through the text. */
    var bandBottom = TOP + lanes * LANE_H - 4;
    function lineTop(label) {
      if (!label) return bandBottom;
      for (var i = 0; i < labels.length; i++) {
        var o = labels[i];
        if (o === label || o.lane <= label.lane) continue;
        if (o.left - 2 <= label.x && label.x <= o.right + 2) return bandBottom;
      }
      return TOP + label.lane * LANE_H;
    }
    function labelFor(id, kind) {
      for (var i = 0; i < labels.length; i++) {
        if (labels[i].id === id && labels[i].kind === kind) return labels[i];
      }
      return null;
    }

    /* ---- per goal ---- */
    var goals = lines.map(function (s) {
      var history = s.points.map(function (p) {
        return { x: xDay(p.day), y: y(pct(p.hours, s.target)) };
      });
      var projection = null;
      if (s.projection) {
        var le = dates.epochDay(s.projection.to.day);
        var from = { x: xDay(s.projection.from.day), y: y(pct(s.projection.from.hours, s.target)) };
        var full = { x: x(le), y: y(pct(s.projection.to.hours, s.target)) };
        var to = full;
        if (le > capEpoch) {
          /* Drawn to the edge, at the height the line has reached there. */
          var t = (capEpoch - dates.epochDay(s.projection.from.day)) / (le - dates.epochDay(s.projection.from.day));
          to = { x: x(capEpoch), y: from.y + (full.y - from.y) * t };
        }
        projection = { from: from, to: to, clipped: le > capEpoch };
      }
      var band = null;
      if (s.late && s.byDate && s.landing) {
        var b0 = xDay(s.byDate);
        var b1 = x(Math.min(capEpoch, dates.epochDay(s.landing)));
        band = { x: b0, width: Math.max(0, b1 - b0) };
      }
      var lastPoint = history.length ? history[history.length - 1] : null;
      return {
        id: s.goal.id,
        colour: s.colour || null,
        dashed: !!s.dashed,
        history: history,
        historyPath: history.length
          ? history.map(function (p, i) { return (i ? 'L' : 'M') + p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ')
          : null,
        now: lastPoint,
        projection: projection,
        target: s.byDate ? { x: xDay(s.byDate), top: lineTop(labelFor(s.goal.id, 'target')) } : null,
        landing: s.landing ? {
          x: x(Math.min(capEpoch, dates.epochDay(s.landing))),
          y: projection ? projection.to.y : null,
          top: lineTop(labelFor(s.goal.id, 'landing'))
        } : null,
        band: band,
        done: !!s.done,
        late: !!s.late
      };
    });

    /* ---- axes ---- */
    var wt = weekTicks(e0, e1, W);
    var xTicks = wt.ticks.map(function (t) { return { x: x(t.epoch), label: t.label, y: y0 + TICK_LABEL_Y }; });
    var yTicks = [0, 50, 100].map(function (p) { return { pct: p, y: y(p), label: p + '%' }; });
    if (yMax > 100) yTicks.push({ pct: yMax, y: y(yMax), label: yMax + '%' });
    var grid = [25, 50, 75].map(function (p) { return { pct: p, y: y(p) }; });

    return {
      W: W, H: H, xL: xL, xR: xR, y0: y0, yTop: y(100), yMax: yMax, top: TOP,
      lanes: lanes,
      domain: { start: dates.dayKey(dates.fromEpochDay(e0)), end: dates.dayKey(dates.fromEpochDay(e1)) },
      todayX: x(today),
      xTicks: xTicks,
      stepWeeks: wt.stepWeeks,
      yTicks: yTicks,
      grid: grid,
      labels: labels,
      goals: goals
    };
  }

  return {
    PAD_L: PAD_L,
    PAD_R: PAD_R,
    TOP: TOP,
    LANE_H: LANE_H,
    DEFAULT_WIDTH: DEFAULT_WIDTH,
    DEFAULT_HEIGHT: DEFAULT_HEIGHT,
    MIN_WIDTH: MIN_WIDTH,
    MAX_WEEKS_AHEAD: MAX_WEEKS_AHEAD,
    FONT: FONT,
    estimate: estimate,
    pct: pct,
    markText: markText,
    weekTicks: weekTicks,
    assignLanes: assignLanes,
    layout: layout
  };
});
