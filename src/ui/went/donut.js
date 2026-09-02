/* Meridian UI — the coverage donut (spec §4a).

   The mockup's stroke trick, verbatim: a --pale disc, an --ink arc drawn as a
   19px stroke on a circle of radius 9.5 so it fills to the centre, dasharray
   `{pct/100 × 59.69} 59.69` (59.69 = 2π × 9.5), rotated −90° so the fill
   starts at twelve o'clock, and a 1px --line rim. Nothing here is a rule: the
   percentage comes in from aggregate.rangeSummary. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};

  var CIRCUMFERENCE = 59.69;

  /* `fraction` is logged / total, unrounded, so the arc is exact; `label` is
     the spec §6 title "{n}% of the {n} h in this range are logged". The arc
     is clamped to a full circle; the label is not, because an over-logged
     range is a true thing to say (aggregate.coverage). */
  function Donut(props) {
    var f = Math.max(0, Math.min(1, Number(props.fraction) || 0));
    var arc = (f * CIRCUMFERENCE).toFixed(2) + ' ' + CIRCUMFERENCE;

    return html`
      <span class="donut" title=${props.label}>
        <svg class="donut__svg" width="38" height="38" role="img" aria-label=${props.label}>
          <circle class="donut__disc" cx="19" cy="19" r="19" />
          <circle class="donut__arc" cx="19" cy="19" r="9.5" stroke-dasharray=${arc} />
          <circle class="donut__rim" cx="19" cy="19" r="18.5" />
        </svg>
      </span>`;
  }

  ui.Donut = Donut;
})();
