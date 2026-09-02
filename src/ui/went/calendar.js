/* Meridian UI — the range calendar with focus heat (spec §4d).

   Month bands from the month of the first logged day to the month of today
   (BUILD-PLAN Phase 3), Monday first (decision 18), 17px cells in a DOM grid
   exactly as the mockup builds them. Cell states, in the mockup's order of
   precedence: unavailable (after today, or before the first logged day —
   rule §8.15) is transparent with a dashed --line2 border; in range while a
   band is focused is that band's colour at opacity 0.10 + 0.90 × (the day's
   hours ÷ the node's busiest day); in range is --axis; any other past day is
   --pale; the hovered cell is --brand over everything. Hovering shows the day
   numerals on the hovered row and the rows either side, within the band.
   The start and end cells carry 3px brand corner marks, a date chip (start
   above, end below) and, while that endpoint's input is focused, a 1.5px
   ring.

   Nothing here is a rule: which days are selectable, what the click does and
   what the heat is come from src/core (range.js, aggregate.heat). The cells
   are buttons out of the tab order — the typed dates and the presets are the
   keyboard path, as in the mockup — and unavailable days are aria-disabled
   rather than disabled so they still show the hover numerals.

   Two small departures from the mockup's pixels, both so a chip is never cut
   off (QUALITY-BAR §2): the band list is padded top and bottom so a chip on
   a first or last row has room, and chips on Monday and Tuesday anchor to the
   cell's left edge, Saturday and Sunday to its right, rather than centring
   over it. The month scrolled to sits 44px from the top rather than the
   mockup's 34: at 34 a start chip on a month's first row is three pixels
   under the sticky weekday header. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var useState = preactHooks.useState;
  var useRef = preactHooks.useRef;
  var useEffect = preactHooks.useEffect;
  var useLayoutEffect = preactHooks.useLayoutEffect;
  var dates = window.Meridian.dates;

  /* Decision 18: M T W T F S S. */
  var DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  var SCROLL_OFFSET = 44;

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function monthKey(dayKey) { return dayKey.slice(0, 7); }

  /* The bands: every month from the first logged day's to today's. */
  function monthsBetween(minDay, today) {
    var out = [];
    var y = +minDay.slice(0, 4), m = +minDay.slice(5, 7);
    var ty = +today.slice(0, 4), tm = +today.slice(5, 7);
    while (y < ty || (y === ty && m <= tm)) {
      out.push({ y: y, m: m });
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    return out;
  }

  function daysInMonth(y, m) {
    return new Date(y, m, 0).getDate();
  }

  /* Mockup nbr(): the hovered day's row and the rows either side, within the
     same band. Rows are counted from the band's first cell, blanks included. */
  function nearRow(hovIndex, index) {
    if (hovIndex === null) return false;
    return Math.abs(Math.floor(hovIndex / 7) - Math.floor(index / 7)) <= 1;
  }

  /* Which edge a chip hugs. Cells are ~27px wide and a chip ~70px, so a
     centred chip on the first or last two columns would leave the rail. */
  function chipAnchor(weekday) {
    if (weekday <= 1) return 'left';
    if (weekday >= 5) return 'right';
    return 'centre';
  }

  function scrollToDay(scroller, dayKey) {
    if (!scroller || !dayKey) return false;
    var el = scroller.querySelector('[data-mon="' + monthKey(dayKey) + '"]');
    if (!el) return false;
    var r = el.getBoundingClientRect(), sr = scroller.getBoundingClientRect();
    scroller.scrollTop = Math.max(0, scroller.scrollTop + (r.top - sr.top) - SCROLL_OFFSET);
    return true;
  }

  function Cell(props) {
    var fill = 'cal__fill';
    var style = null;
    if (props.hovered) fill += ' cal__fill--hover';
    else if (!props.available) fill += ' cal__fill--off';
    else if (props.inRange && props.heat) {
      fill += ' cal__fill--heat cal__fill--heat-' + props.heat.direction;
      var m = props.heat.byDay[props.dayKey] || 0;
      var op = props.heat.max > 0 ? 0.10 + 0.90 * Math.min(1, m / props.heat.max) : 0.2;
      style = 'opacity:' + op.toFixed(3);
    } else if (props.inRange) fill += ' cal__fill--in';
    else fill += ' cal__fill--pale';

    var label = dates.formatLong(props.dayKey);

    return html`
      <button type="button" class="cal__cell" tabindex="-1"
        aria-label=${label} aria-disabled=${props.available ? null : 'true'}
        aria-pressed=${props.isStart || props.isEnd ? 'true' : null}
        onClick=${props.available ? props.onPick : null}
        onMouseEnter=${props.onHover}>
        <span class=${fill} style=${style} />
        ${props.numeral ? html`
          <span class=${'cal__num' + (props.hovered ? ' cal__num--hover' : '')}>${props.day}</span>` : null}
        ${props.isStart || props.isEnd ? html`
          <span class=${'cal__mark cal__mark--' + (props.isStart ? 'start' : 'end')} aria-hidden="true" />
          ${props.ringed ? html`<span class="cal__ring" aria-hidden="true" />` : null}
          <span class=${'cal__chip cal__chip--' + (props.isStart ? 'start' : 'end') +
              ' cal__chip--' + props.anchor + (props.dimChip ? ' cal__chip--dim' : '')}
            aria-hidden="true">${label}</span>` : null}
      </button>`;
  }

  function Calendar(props) {
    var hovState = useState(null);
    var hov = hovState[0], setHov = hovState[1];
    var scrollRef = useRef(null);

    var range = props.range;
    var minDay = props.minDay, today = props.today;
    var efield = props.efield;

    /* Scroll to the month asked for. */
    var request = props.scrollTo;
    useLayoutEffect(function () {
      if (request && request.day) scrollToDay(scrollRef.current, request.day);
    }, [request]);

    /* On mount, the range start — before the first paint, so a long history
       never shows its first month and then jumps (QUALITY-BAR §3). */
    useLayoutEffect(function () {
      scrollToDay(scrollRef.current, range.start);
    }, []);

    /* And again once the fonts are in, because the swap can move every band. */
    useEffect(function () {
      var alive = true;
      var start = range.start;
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () {
          if (alive) scrollToDay(scrollRef.current, start);
        });
      }
      return function () { alive = false; };
    }, []);

    var bands = monthsBetween(minDay, today).map(function (mo, k) {
      var firstKey = mo.y + '-' + pad2(mo.m) + '-01';
      var fdow = dates.weekdayIndex(firstKey);
      var dim = daysInMonth(mo.y, mo.m);
      var monKey = firstKey.slice(0, 7);
      var hovIndex = hov && hov.month === monKey ? fdow + hov.day - 1 : null;

      var cells = [];
      for (var b = 0; b < fdow; b++) cells.push(html`<span class="cal__blank" key=${'b' + b} />`);
      for (var d = 1; d <= dim; d++) {
        var key = monKey + '-' + pad2(d);
        var index = fdow + d - 1;
        var available = key >= minDay && key <= today;
        var isStart = key === range.start, isEnd = key === range.end;
        cells.push(html`
          <${Cell} key=${key} dayKey=${key} day=${d}
            available=${available}
            inRange=${key >= range.start && key <= range.end}
            heat=${props.heat}
            hovered=${hovIndex === index}
            numeral=${nearRow(hovIndex, index)}
            isStart=${isStart} isEnd=${isEnd}
            ringed=${(efield === 'start' && isStart) || (efield === 'end' && isEnd)}
            dimChip=${!!efield && !((efield === 'start' && isStart) || (efield === 'end' && isEnd))}
            anchor=${chipAnchor(index % 7)}
            onPick=${function (k) { return function () { props.onPick(k); }; }(key)}
            onHover=${function (m, day) { return function () { setHov({ month: m, day: day }); }; }(monKey, d)} />`);
      }

      /* The two-digit year only on January and on the first band (mockup). */
      var label = dates.MONTHS[mo.m - 1] + (mo.m === 1 || k === 0 ? ' ' + String(mo.y).slice(2) : '');
      return html`
        <div class="cal__band" data-mon=${monKey} key=${monKey}>
          <div class="cal__mon">${label}</div>
          <div class="cal__grid">${cells}</div>
        </div>`;
    });

    return html`
      <div class="cal__scroll" ref=${scrollRef}>
        <div class="cal" onMouseLeave=${function () { setHov(null); }}>
          <div class="cal__head" aria-hidden="true">
            <span />
            <div class="cal__dow">
              ${DOW.map(function (d, i) { return html`<span key=${i}>${d}</span>`; })}
            </div>
          </div>
          <div class="cal__list">${bands}</div>
        </div>
      </div>`;
  }

  ui.Calendar = Calendar;
  ui.calendarScrollToDay = scrollToDay;
})();
