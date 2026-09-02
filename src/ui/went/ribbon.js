/* Meridian UI — the category / goal ribbon chart (spec §4c).

   Every number comes from src/core/ribbon.js geometry(); this file only puts
   SVG elements where it says. Colour is by direction — More --good, Less
   --warn, Upkeep --axis — through classes, so a theme switch re-renders the
   chart with no reload (QUALITY-BAR §7). Opacities are the mockup's: ribbon
   .42, focused .72, the others .08 while one is focused; right bar 1 or .18;
   trunk bar .85 or .18; text .4 and the leader .3 when dimmed. They are set
   inline and transitioned over 160ms.

   The width is measured from the panel and the label columns are fixed, so
   the text stays at true size at any width and only the ribbon span
   stretches; below ribbon.MIN_WIDTH the panel scrolls sideways inside itself.
   A name longer than its column is shortened with an ellipsis (ribbon.fitText
   against a canvas measurer) and its full text goes in the band's accessible
   name and a <title>, because SVG text has no text-overflow.

   Each band is focusable and toggles on click, Enter or Space (mockup: click). */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var useState = preactHooks.useState;
  var useRef = preactHooks.useRef;
  var useEffect = preactHooks.useEffect;
  var useLayoutEffect = preactHooks.useLayoutEffect;
  var useMemo = preactHooks.useMemo;
  var ribbon = window.Meridian.ribbon;
  var aggregate = window.Meridian.aggregate;

  var OPACITY = {
    flow: { on: 0.72, off: 0.42, dim: 0.08 },
    bar: { on: 1, off: 1, dim: 0.18 },
    trunk: { on: 0.85, off: 0.85, dim: 0.18 },
    text: { on: 1, off: 1, dim: 0.4 },
    leader: { on: 1, off: 1, dim: 0.3 }
  };

  /* The type of each label, as the mockup sets it on the <text> nodes. */
  var FONT = {
    name: '600 14.5px',
    sub: '400 11px',
    pct: '700 20px',
    pctUnit: '600 11.5px',
    hours: '500 12px'
  };

  function fontFamily() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--font');
    return (v && v.trim()) || 'system-ui, sans-serif';
  }

  /* A canvas is the one way to measure text without laying it out. One
     context, one font family, re-used for every label. */
  function makeMeasurer() {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext && canvas.getContext('2d');
    var family = fontFamily();
    if (!ctx) {
      /* No canvas (a locked-down browser): estimate at 0.55em per character,
         which over-measures slightly and so errs towards shortening. */
      return function (text, font) {
        var px = parseFloat(font.split(' ')[1]) || 14;
        return String(text).length * px * 0.55;
      };
    }
    return function (text, font) {
      ctx.font = font + ' ' + family;
      return ctx.measureText(String(text)).width;
    };
  }

  function opacity(kind, focus, id) {
    if (!focus) return OPACITY[kind].off;
    return focus === id ? OPACITY[kind].on : OPACITY[kind].dim;
  }

  function Ribbon(props) {
    var hostRef = useRef(null);
    var widthState = useState(null);
    var width = widthState[0], setWidth = widthState[1];
    var fontsState = useState(0);
    var fontsReady = fontsState[0], setFontsReady = fontsState[1];

    /* Measure before paint, then follow the panel as it resizes. */
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

    /* Names are measured in whatever face is loaded; re-measure once the
       real one is in. */
    useEffect(function () {
      var alive = true;
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { if (alive) setFontsReady(1); });
      }
      return function () { alive = false; };
    }, []);

    var measure = useMemo(makeMeasurer, [fontsReady]);

    var nodes = props.nodes;
    var focus = props.focus;
    var geom = ribbon.geometry(nodes.map(function (n) {
      return { id: n.id, value: n.minutes, sub: n.sub };
    }), { width: width || ribbon.DEFAULT_WIDTH, total: props.totalMinutes });

    function toggle(id) {
      props.onFocus(id);
    }

    var bands = nodes.map(function (n, i) {
      var row = geom.rows[i];
      var dir = n.direction === 'more' || n.direction === 'less' ? n.direction : 'keep';
      var hoursText = aggregate.formatHoursGrouped(n.minutes) + ' h';
      var pctWidth = measure(row.pctText, FONT.pct) + measure('%', FONT.pctUnit);
      var name = ribbon.fitText(n.name, ribbon.labelBudget(geom, pctWidth), function (s) { return measure(s, FONT.name); });
      var sub = n.sub ? ribbon.fitText(n.sub, ribbon.labelBudget(geom, measure(hoursText, FONT.hours)),
        function (s) { return measure(s, FONT.sub); }) : null;
      var shortened = name !== n.name || (sub !== null && sub !== n.sub);
      var label = n.name + (n.sub ? ', ' + n.sub : '') + ', ' + row.pctText + '%, ' + hoursText;
      var on = focus === n.id;

      return html`
        <g class=${'ribbon__band' + (on ? ' ribbon__band--on' : '') + (focus && !on ? ' ribbon__band--dim' : '')}
          key=${n.id} data-node=${n.id} data-direction=${dir}
          tabindex="0" role="button" aria-pressed=${on ? 'true' : 'false'} aria-label=${label}
          onClick=${function () { toggle(n.id); }}
          onKeyDown=${function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(n.id); }
          }}>
          ${shortened ? html`<title>${n.name}${n.sub ? ' — ' + n.sub : ''}</title>` : null}
          <path class=${'ribbon__flow ribbon__flow--' + dir} d=${row.path}
            style=${'fill-opacity:' + opacity('flow', focus, n.id)} />
          <rect class=${'ribbon__bar ribbon__bar--' + dir} x=${geom.xR} y=${row.right.y0}
            width=${geom.bw} height=${Math.max(1, row.right.y1 - row.right.y0)}
            style=${'fill-opacity:' + opacity('bar', focus, n.id)} />
          <rect class=${'ribbon__trunk ribbon__trunk--' + dir} x=${geom.xL - geom.bw} y=${row.trunk.y0}
            width=${geom.bw} height=${Math.max(1, row.trunk.y1 - row.trunk.y0)}
            style=${'fill-opacity:' + opacity('trunk', focus, n.id)} />
          <line class="ribbon__leader" x1=${row.leader.x1} x2=${row.leader.x2} y1=${row.leader.y} y2=${row.leader.y}
            style=${'stroke-opacity:' + opacity('leader', focus, n.id)} />
          <text class="ribbon__name" x=${geom.nameX} y=${row.nameY}
            style=${'fill-opacity:' + opacity('text', focus, n.id)}>${name}</text>
          ${sub !== null ? html`
            <text class="ribbon__sub" x=${geom.nameX} y=${row.subY}
              style=${'fill-opacity:' + opacity('text', focus, n.id)}>${sub}</text>` : null}
          <text class="ribbon__pct" x=${geom.W} y=${row.pctY} text-anchor="end"
            style=${'fill-opacity:' + opacity('text', focus, n.id)}>
            <tspan class="ribbon__pctval">${row.pctText}</tspan><tspan class="ribbon__pctunit">%</tspan>
          </text>
          <text class="ribbon__hours" x=${geom.W} y=${row.hoursY} text-anchor="end"
            style=${'fill-opacity:' + opacity('text', focus, n.id)}>${hoursText}</text>
        </g>`;
    });

    return html`
      <div class="ribbon" ref=${hostRef}>
        <svg class="ribbon__svg" width=${geom.W} height=${geom.H} viewBox=${'0 0 ' + geom.W + ' ' + geom.H}
          role="group" aria-label="Where the logged hours went">
          <g class="ribbon__label" text-anchor="end">
            <text class="ribbon__labeltitle" x=${geom.label.x} y=${geom.label.titleY}>LOGGED HOURS</text>
            <text class="ribbon__labeltotal" x=${geom.label.x} y=${geom.label.totalY}>
              ${aggregate.formatHoursGrouped(props.totalMinutes)}
            </text>
          </g>
          <g class="ribbon__bands">${bands}</g>
        </svg>
      </div>`;
  }

  ui.Ribbon = Ribbon;
})();
