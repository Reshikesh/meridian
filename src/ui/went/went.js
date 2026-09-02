/* Meridian UI — the Where it went screen (spec §4a–§4d, §6; deck-02-went.png).

   Header: the coverage donut, "{n} hours logged", the direction split. Body:
   the rail (status, presets, typed dates, calendar) beside the chart panel
   (range caption, coverage note, SPLIT and SORT, "% OF LOGGED", the ribbon).
   Footer: the legend, verbatim.

   The view — range, pending pick, undo, split, sort, focus — lives in app.js,
   where it survives a trip to another screen; every change to it is a
   src/core/range.js transition. What lives here is the moment: which input
   is focused, where the calendar should scroll, and the Escape that aborts a
   pick. Aggregation is aggregate.rangeSummary / chartNodes / heat. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var useState = preactHooks.useState;
  var useEffect = preactHooks.useEffect;
  var aggregate = window.Meridian.aggregate;
  var dates = window.Meridian.dates;
  var fields = ui.fields;

  var SPLITS = [{ id: 'cat', label: 'Category' }, { id: 'goal', label: 'Goal' }];
  var SORTS = [{ id: 'desc', label: 'Descending' }, { id: 'asc', label: 'Ascending' }];

  function Legend() {
    return html`
      <div class="went__legend">
        <span class="legend__item"><span class="legend__swatch legend__swatch--more" />More is better</span>
        <span class="legend__item"><span class="legend__swatch legend__swatch--less" />Less is better</span>
        <span class="legend__item"><span class="legend__swatch legend__swatch--keep" />Upkeep — neither</span>
        <span class="legend__hint">Click any band to shade the days it happened.</span>
      </div>`;
  }

  function Went(props) {
    var state = props.state;
    var view = props.view;
    var actions = props.actions;
    var efieldState = useState(null);
    var efield = efieldState[0], setEfield = efieldState[1];
    var scrollState = useState(null);
    var scrollTo = scrollState[0], setScrollTo = scrollState[1];

    var entries = state.entries || [];
    var summary = aggregate.rangeSummary(entries, state.categories, view.range);
    var nodes = aggregate.chartNodes(summary.entries, state.categories, state.goals, view.split, view.sort);
    var focused = null;
    for (var i = 0; i < nodes.length; i++) if (nodes[i].id === view.focus) focused = nodes[i];
    var heat = null;
    if (focused) {
      var h = aggregate.heat(entries, focused.id, props.today);
      heat = { byDay: h.byDay, max: h.max, direction: focused.direction === 'more' || focused.direction === 'less' ? focused.direction : 'keep' };
    }

    var cov = summary.coverage;
    var totalHours = summary.days * aggregate.HOURS_PER_DAY;
    var fraction = totalHours > 0 ? summary.minutes / (totalHours * 60) : 0;
    var donutLabel = cov.pct + '% of the ' + aggregate.groupHours(totalHours) + ' h in this range are logged';
    var caption = (dates.formatLong(view.range.start) + ' – ' + dates.formatLong(view.range.end)).toUpperCase();
    var note = cov.pct + '% coverage · ' + aggregate.groupHours(cov.unloggedHours) + ' h unlogged';

    /* Escape aborts a pick (spec Appendix B, item 6) — from anywhere on the
       page except inside a sheet, which owns its own Escape (decision-log
       #86), and except the date inputs, which discard their draft instead. */
    useEffect(function () {
      if (!view.pending) return undefined;
      function onKey(event) {
        if (event.key !== 'Escape') return;
        if (ui.sheetOpen && ui.sheetOpen()) return;
        var t = event.target;
        if (t && t.classList && t.classList.contains('rail__input')) return;
        event.preventDefault();
        actions.abort();
      }
      document.addEventListener('keydown', onKey, true);
      return function () { document.removeEventListener('keydown', onKey, true); };
    }, [view.pending, actions]);

    function requestScroll(day) {
      setScrollTo({ day: day, seq: (scrollTo ? scrollTo.seq : 0) + 1 });
    }

    /* A range change made through the rail scrolls the calendar to it. */
    var railActions = {
      pick: actions.pick,
      undo: function () {
        var target = view.undo;
        actions.undo();
        if (target) requestScroll(target.start);
      },
      preset: function (id) {
        actions.preset(id);
        var after = window.Meridian.range.presetRange(id, props.today, props.minDay);
        if (after) requestScroll(after.start);
      },
      typed: actions.typed
    };

    return html`
      <main class=${props.className} data-s="went">
        <div class="went__head">
          <div class="went__title">
            <${ui.Donut} fraction=${fraction} label=${donutLabel} />
            <h1 class="t-h1 went__h1">${aggregate.formatHoursGrouped(summary.minutes)} hours logged</h1>
          </div>
          <${ui.Split} split=${summary.split} />
        </div>

        <div class="went__body">
          <${ui.Rail} view=${view} today=${props.today} minDay=${props.minDay}
            actions=${railActions} heat=${heat}
            efield=${efield} onEfield=${setEfield}
            scrollTo=${scrollTo} onScrollTo=${requestScroll} />

          <div class="went__panel">
            <div class="went__panelhead">
              <div class="went__caption">
                <span class="t-label went__range">${caption}</span>
                <span class="went__note">${note}</span>
              </div>
              <div class="went__ctl">
                <span class="t-label" id="went-split-label">SPLIT</span>
                <${fields.Segmented} className="seg--small" options=${SPLITS} value=${view.split}
                  labelledBy="went-split-label" onChange=${actions.split} />
              </div>
              <div class="went__ctl">
                <span class="t-label" id="went-sort-label">SORT</span>
                <${fields.Segmented} className="seg--small" options=${SORTS} value=${view.sort}
                  labelledBy="went-sort-label" onChange=${actions.sort} />
              </div>
            </div>

            ${nodes.length ? html`
              <div class="went__pctlabel">% OF LOGGED</div>
              <${ui.Ribbon} nodes=${nodes} totalMinutes=${summary.minutes}
                focus=${focused ? focused.id : null} onFocus=${actions.focus} />`
            : html`
              <div class="went__empty">
                <p class="went__emptytitle">Nothing logged in this range.</p>
                <p class="went__emptynote">Pick another range, or log a few days.</p>
              </div>`}
          </div>
        </div>

        <${Legend} />
      </main>`;
  }

  ui.Went = Went;
})();
