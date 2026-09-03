/* Meridian UI — the Progress screen (deck-03-progress.png, spec §4e, decision 27).

   The chart is the screen. Every live goal is a line on it, in its category's
   colour — a second goal in the same category dashed — with the banked history
   solid to today, the projection on to its landing, the target marked, and
   the warn band when the landing falls past the date. The vertical axis is
   percent of target, so a 60-hour and a 130-hour goal aim at the same line.

   Beside it, the list the mockup called ALL GOALS: each goal's colour, its
   figures, and the switch that takes it off the chart and puts it back.
   The mockup's single-goal hero, its four stat blocks and its LEVERS panel
   fold into that list or go (decision 27).

   Not one number is computed here. Every figure is `projection.series()` —
   the same `project()` the Goals table and both sheets read — and every
   pixel is `timeline.layout()`. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var useState = preactHooks.useState;
  var useRef = preactHooks.useRef;
  var useEffect = preactHooks.useEffect;
  var useLayoutEffect = preactHooks.useLayoutEffect;
  var useMemo = preactHooks.useMemo;

  var dates = window.Meridian.dates;
  var projection = window.Meridian.projection;
  var timeline = window.Meridian.timeline;
  var colour = window.Meridian.colour;

  var EXPLAINER = 'Projected from logged hours, not from your plan.';

  /* The ribbon's own dim treatment, for a line while another is under the
     pointer or focused in the list. */
  var DIM = 0.18;

  function plural(n, word) {
    return n + ' ' + word + (n === 1 ? '' : 's');
  }

  function hours(n) {
    return (Math.round(Number(n) * 10) / 10).toFixed(1);
  }

  function fontFamily() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--font');
    return (v && v.trim()) || 'system-ui, sans-serif';
  }

  /* One canvas context, re-used for every label (as the ribbon does). */
  function makeMeasurer() {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext && canvas.getContext('2d');
    var family = fontFamily();
    if (!ctx) return timeline.estimate;
    return function (text, font) {
      ctx.font = font + ' ' + family;
      return ctx.measureText(String(text)).width;
    };
  }

  /* Colour is the category's; a second goal on the same category is dashed
     (BUILD-PLAN § Phase 6). Live goals only, in the state's own order. */
  function lineStyles(state) {
    var seen = Object.create(null);
    var out = Object.create(null);
    (state.goals || []).forEach(function (g) {
      if (g.archived) return;
      var cat = null;
      (state.categories || []).forEach(function (c) { if (c.id === g.category_id) cat = c; });
      var hex = cat && cat.colour ? cat.colour : null;
      out[g.id] = { colour: hex, dashed: !!seen[g.category_id], category: cat };
      seen[g.category_id] = 1;
    });
    return out;
  }

  /* What the list says under a goal's name: the same words the Goals table
     uses, so the two screens cannot disagree about a date. */
  function landsLine(row) {
    if (row.done) return { text: 'Reached', tone: 'good' };
    if (row.mode === 'none') {
      return { text: row.loggedDays === 0 ? 'Nothing logged yet' : 'One day logged — a date needs two', tone: 'dim' };
    }
    if (!row.landing) return { text: 'No landing date yet', tone: 'dim' };
    var slip = row.slippageDays;
    var late = slip !== null && slip > 0;
    var note = slip === null ? ''
      : slip > 0 ? ' · +' + plural(slip, 'day')
      : slip < 0 ? ' · −' + plural(-slip, 'day')
      : ' · on time';
    return { text: 'Lands ' + dates.formatDayMonth(row.landing) + note, tone: late ? 'warn' : 'ink' };
  }

  /* The chart's accessible name: one clause per line on it. */
  function describe(lines) {
    if (!lines.length) return 'Progress chart with no goals on it';
    return 'Progress chart: ' + lines.map(function (s) {
      var l = landsLine(s.row);
      return s.goal.short_name + ', ' + hours(s.row.banked) + ' of ' + hours(s.target) + ' hours, ' + l.text.toLowerCase();
    }).join('; ');
  }

  /* ---------- the chart ---------- */

  function Chart(props) {
    var hostRef = useRef(null);
    var widthState = useState(null);
    var width = widthState[0], setWidth = widthState[1];
    var fontsState = useState(0);
    var fontsReady = fontsState[0], setFontsReady = fontsState[1];

    useLayoutEffect(function () {
      var host = hostRef.current;
      if (!host) return undefined;
      function measure() {
        var w = host.clientWidth;
        setWidth(function (prev) { return prev === w ? prev : w; });
      }
      measure();
      var ro = null;
      if (typeof ResizeObserver === 'function') {
        ro = new ResizeObserver(measure);
        ro.observe(host);
      } else {
        window.addEventListener('resize', measure);
      }
      return function () {
        if (ro) ro.disconnect();
        else window.removeEventListener('resize', measure);
      };
    }, []);

    useEffect(function () {
      var alive = true;
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { if (alive) setFontsReady(1); });
      }
      return function () { alive = false; };
    }, []);

    var measure = useMemo(makeMeasurer, [fontsReady]);
    var geom = timeline.layout(props.lines, {
      today: props.today,
      width: width || timeline.DEFAULT_WIDTH,
      measure: measure
    });
    var focus = props.focus;

    function dim(id) {
      return focus && focus !== id ? DIM : 1;
    }

    var groups = geom.goals.map(function (g) {
      var stroke = g.colour || 'var(--axis)';
      var dash = g.dashed ? '9 6' : null;
      /* QUALITY-BAR §7: a swatch under 3:1 on the theme's ground gets a 1px
         --line outline rather than a changed colour. For a line that is a
         wider line beneath it. */
      var halo = g.colour && colour.needsOutline(g.colour, props.theme);
      return html`
        <g class="pchart__goal" key=${g.id} data-goal=${g.id}
          style=${'opacity:' + dim(g.id)}>
          ${g.band ? html`
            <rect class="pchart__band" x=${g.band.x} y=${geom.top} width=${g.band.width}
              height=${geom.y0 - geom.top} />` : null}
          ${g.target ? html`
            <line class="pchart__target" x1=${g.target.x} x2=${g.target.x}
              y1=${g.target.top} y2=${geom.y0} style=${'stroke:' + stroke} />` : null}
          ${g.landing ? html`
            <line class="pchart__landing" x1=${g.landing.x} x2=${g.landing.x}
              y1=${g.landing.top} y2=${geom.y0} style=${'stroke:' + stroke} />` : null}
          ${g.historyPath && halo ? html`
            <path class="pchart__halo" d=${g.historyPath} />` : null}
          ${g.historyPath ? html`
            <path class="pchart__history" d=${g.historyPath}
              style=${'stroke:' + stroke} stroke-dasharray=${dash} />` : null}
          ${g.projection ? html`
            <path class="pchart__projection"
              d=${'M' + g.projection.from.x.toFixed(1) + ',' + g.projection.from.y.toFixed(1) +
                  ' L' + g.projection.to.x.toFixed(1) + ',' + g.projection.to.y.toFixed(1)}
              style=${'stroke:' + stroke} stroke-dasharray=${dash} />` : null}
          ${g.now ? html`
            <circle class="pchart__dot" cx=${g.now.x} cy=${g.now.y} r="4" style=${'fill:' + stroke} />` : null}
          ${g.landing && !g.projection.clipped ? html`
            <circle class="pchart__dot" cx=${g.landing.x} cy=${g.landing.y} r="4" style=${'fill:' + stroke} />` : null}
        </g>`;
    });

    var labels = geom.labels.map(function (l) {
      return html`
        <text class=${'pchart__mark pchart__mark--' + l.tone} key=${l.id + ':' + l.kind}
          x=${l.anchor === 'end' ? l.x - 5 : l.x + 5} y=${l.y} text-anchor=${l.anchor}
          style=${'opacity:' + dim(l.id)}>
          ${l.clipped ? html`<title>Off the chart: lands ${l.text.toLowerCase()}</title>` : null}
          ${l.text}${l.clipped ? ' →' : ''}
        </text>`;
    });

    return html`
      <div class="pchart" ref=${hostRef}>
        <svg class="pchart__svg" width=${geom.W} height=${geom.H} viewBox=${'0 0 ' + geom.W + ' ' + geom.H}
          role="img" aria-label=${describe(props.lines)}>
          <g class="pchart__grid">
            ${geom.grid.map(function (g) {
              return html`<line key=${g.pct} x1=${geom.xL} x2=${geom.xR} y1=${g.y} y2=${g.y} />`;
            })}
          </g>
          <line class="pchart__ceiling" x1=${geom.xL} x2=${geom.xR} y1=${geom.yTop} y2=${geom.yTop} />
          <line class="pchart__axis" x1=${geom.xL} x2=${geom.xR} y1=${geom.y0} y2=${geom.y0} />
          <line class="pchart__today" x1=${geom.todayX} x2=${geom.todayX} y1=${geom.yTop} y2=${geom.y0} />
          <g class="pchart__ylabels" text-anchor="end">
            ${geom.yTicks.map(function (k) {
              return html`<text key=${k.pct} x=${geom.xL - 10} y=${k.y + 6}>${k.label}</text>`;
            })}
          </g>
          <g class="pchart__xlabels" text-anchor="middle">
            ${geom.xTicks.map(function (k) {
              return html`<text key=${k.label + k.x} x=${k.x} y=${k.y}>${k.label}</text>`;
            })}
          </g>
          <g class="pchart__goals">${groups}</g>
          <g class="pchart__marks">${labels}</g>
        </svg>
      </div>`;
  }

  /* ---------- the list beside it ---------- */

  function GoalItem(props) {
    var s = props.series;
    var row = s.row;
    var on = props.on;
    var lands = landsLine(row);
    var early = projection.earlyLabel(row);
    var swatch = s.colour || 'var(--axis)';
    var dashStyle = s.dashed
      ? 'background:repeating-linear-gradient(90deg,' + swatch + ' 0 6px,transparent 6px 10px)'
      : 'background:' + swatch;

    return html`
      <li class=${'pgoal' + (on ? '' : ' pgoal--off')}
        onMouseEnter=${function () { props.onFocus(s.goal.id); }}
        onMouseLeave=${function () { props.onFocus(null); }}>
        <button type="button" class="pgoal__switch" role="switch" aria-checked=${on ? 'true' : 'false'}
          aria-label=${(on ? 'Take ' : 'Put ') + s.goal.short_name + (on ? ' off the chart' : ' on the chart')}
          onClick=${function () { props.onToggle(s.goal.id); }}
          onFocus=${function () { props.onFocus(s.goal.id); }}
          onBlur=${function () { props.onFocus(null); }}>
          <span class="pgoal__line" style=${on ? dashStyle : null} aria-hidden="true"></span>
        </button>
        <div class="pgoal__main">
          <div class="pgoal__name">${s.goal.short_name}</div>
          <div class="pgoal__figs">
            <span class="pgoal__banked">${hours(row.banked)}</span>
            <span class="pgoal__of">/${hours(row.target)} h</span>
            ${row.pace > 0 ? html`
              <span class="pgoal__sep" aria-hidden="true">·</span>
              <span class="pgoal__pace">${hours(row.pace)} h/wk</span>` : null}
          </div>
          <div class=${'pgoal__lands pgoal__lands--' + lands.tone}>${lands.text}</div>
          ${early ? html`<div class="pgoal__early">${early}</div>` : null}
        </div>
      </li>`;
  }

  /* ---------- the screen ---------- */

  function Progress(props) {
    var state = props.state;
    var offState = useState(function () { return Object.create(null); });
    var off = offState[0], setOff = offState[1];
    var focusState = useState(null);
    var focus = focusState[0], setFocus = focusState[1];

    var counts = projection.goalCounts(state, props.now);
    var head = ui.goalHeadline(counts);
    var styles = lineStyles(state);
    var todayKey = dates.dayKey(dates.logicalDay(props.now));

    var series = (state.goals || []).filter(function (g) { return !g.archived; })
      .map(function (g) {
        var s = projection.series(state, g.id, props.now);
        s.colour = styles[g.id].colour;
        s.dashed = styles[g.id].dashed;
        return s;
      });

    function toggle(id) {
      setOff(function (prev) {
        var next = Object.assign(Object.create(null), prev);
        if (next[id]) delete next[id]; else next[id] = true;
        return next;
      });
    }

    var shown = series.filter(function (s) { return !off[s.goal.id]; });

    if (!series.length) {
      return html`
        <main class=${props.className} data-s="progress" inert=${props.inert ? true : null}>
          <div class="progress__head">
            <div class="t-eyebrow">PROGRESS</div>
            <h1 class="t-h1">${head.lead}</h1>
          </div>
          <div class="progress__none">
            <p class="progress__noneline">
              Nothing to project. A goal turns logged hours into a landing date, and it starts on Goals.
            </p>
            <button type="button" class="btn" onClick=${props.onGoals}>Open Goals</button>
          </div>
        </main>`;
    }

    return html`
      <main class=${props.className} data-s="progress" inert=${props.inert ? true : null}>
        <div class="progress__head">
          <div class="t-eyebrow">PROGRESS</div>
          <h1 class="t-h1">
            ${head.lead}
            ${head.warn ? html`${' '}<span class="goals__slipping">${head.warn}</span>` : null}
          </h1>
        </div>

        <div class="progress__body">
          <div class="progress__panel">
            <div class="progress__panelhead">
              <div class="t-label">BANKED — PROJECTED, AS % OF TARGET</div>
              <div class="chartlegend" aria-hidden="true">
                <span class="chartlegend__item"><span class="chartlegend__logged"></span>logged</span>
                <span class="chartlegend__item"><span class="chartlegend__projected"></span>projected</span>
              </div>
            </div>
            <${Chart} lines=${shown} today=${todayKey} theme=${props.theme} focus=${focus} />
            <p class="progress__explainer">${EXPLAINER}</p>
          </div>

          <div class="progress__list">
            <div class="t-label progress__listlabel">GOALS</div>
            <ul class="pgoals">
              ${series.map(function (s) {
                return html`
                  <${GoalItem} key=${s.goal.id} series=${s} on=${!off[s.goal.id]}
                    onToggle=${toggle} onFocus=${setFocus} />`;
              })}
            </ul>
          </div>
        </div>
      </main>`;
  }

  ui.Progress = Progress;
  ui.progressLandsLine = landsLine;
})();
