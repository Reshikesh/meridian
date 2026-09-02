/* Meridian UI — the direction split bar (spec §4b).

   Three segments, More / Less / Upkeep, at the mockup's three-decimal
   percentage widths, with the rounded percentages inside them and the
   "{up} h more · {down} h less · {keep} h upkeep" caption under. The figures
   come from aggregate.directionSplit, which already makes the three
   percentages total 100 and the three hour figures total the whole.

   Spec §4b flags two things the mockup leaves ungraceful: a label clipped
   mid-glyph inside a segment too narrow to hold it, and a blank bar when
   nothing is logged. Each segment is a size container and its label hides
   below the width that label needs (styles/components.css); with nothing
   logged no labels are rendered at all, and the caption carries the zeros. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var aggregate = window.Meridian.aggregate;

  function Segment(props) {
    var text = props.pct + '%';
    return html`
      <div class=${'split__seg split__seg--' + props.kind} style=${'width:' + props.width}>
        ${props.kind === 'keep' ? html`<span class="split__veil" aria-hidden="true" />` : null}
        ${props.show ? html`
          <span class=${'split__pct split__pct--' + props.kind} data-len=${text.length}>${text}</span>` : null}
      </div>`;
  }

  function Split(props) {
    var s = props.split;
    var any = s.totalMinutes > 0;
    var caption = aggregate.groupHours(s.upHours) + ' h more · ' +
      aggregate.groupHours(s.downHours) + ' h less · ' +
      aggregate.groupHours(s.keepHours) + ' h upkeep';

    return html`
      <div class="split">
        <div class="t-label split__label">OF LOGGED TIME</div>
        <div class="split__bar" role="img" aria-label=${caption}>
          <${Segment} kind="more" width=${s.upWidth} pct=${s.upPct} show=${any} />
          <${Segment} kind="less" width=${s.downWidth} pct=${s.downPct} show=${any} />
          <${Segment} kind="keep" width=${s.keepWidth} pct=${s.keepPct} show=${any} />
        </div>
        <div class="split__caption">${caption}</div>
      </div>`;
  }

  ui.Split = Split;
})();
