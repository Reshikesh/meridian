/* Meridian UI — the import validation report.

   Spec §10 and QUALITY-BAR §6: rows accepted per sheet, rows rejected with
   sheet, row number and reason, foreign keys checked, unknown columns noted,
   missing sheets reported rather than fatal. Nothing fails silently, and
   nothing is written until the owner says so — the report is what they are
   saying yes to.

   Row numbers are the ones Excel shows: the header is row 1, so the first data
   row is row 2. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var aggregate = window.Meridian.aggregate;

  function plural(n, one, many) {
    return n + ' ' + (n === 1 ? one : many);
  }

  function Summary(props) {
    var r = props.report;
    var counts = r.counts;
    return html`
      <p class="report__line">
        ${plural(counts.entries, 'entry', 'entries')} ·
        ${aggregate.formatHours(r.entryMinutes)} h ·
        ${plural(counts.categories, 'category', 'categories')} ·
        ${plural(counts.goals, 'goal', 'goals')}
      </p>`;
  }

  function ImportReport(props) {
    var r = props.report;

    if (r.fatal) {
      return html`
        <div class="report">
          <h2 class="report__head report__head--warn">Import failed.</h2>
          <p class="report__line">${r.fatal.message}</p>
        </div>`;
    }

    var rejected = r.rejected;
    var accepted = r.accepted;

    return html`
      <div class="report">
        <h2 class="report__head">
          ${plural(accepted, 'row read', 'rows read')}.
          ${rejected ? plural(rejected, 'rejected', 'rejected') + '.' : 'Nothing rejected.'}
        </h2>
        <${Summary} report=${r} />

        <table class="report__table">
          <thead>
            <tr>
              <th class="t-label" scope="col">SHEET</th>
              <th class="t-label report__num" scope="col">READ</th>
              <th class="t-label report__num" scope="col">REJECTED</th>
            </tr>
          </thead>
          <tbody>
            ${r.sheets.map(function (s) {
              return html`
                <tr key=${s.name}>
                  <td>${s.name}${s.present ? '' : ' — missing'}</td>
                  <td class="report__num num">${s.present ? s.accepted : '—'}</td>
                  <td class=${'report__num num' + (s.rejected ? ' report__num--warn' : '')}>
                    ${s.present ? s.rejected : '—'}
                  </td>
                </tr>`;
            })}
          </tbody>
        </table>

        ${r.rejects.length ? html`
          <div class="report__block">
            <div class="t-label">REJECTED ROWS</div>
            <ul class="report__list">
              ${r.rejects.map(function (x, i) {
                return html`
                  <li class="report__reject" key=${x.sheet + ':' + x.row + ':' + i}>
                    <span class="report__where">${x.sheet} · row ${x.row}</span>
                    <span class="report__why">${x.reason}</span>
                  </li>`;
              })}
            </ul>
          </div>` : null}

        ${r.notes.length ? html`
          <div class="report__block">
            <div class="t-label">NOTES</div>
            <ul class="report__list">
              ${r.notes.map(function (n, i) {
                return html`<li class="report__note" key=${i}>${n}</li>`;
              })}
            </ul>
          </div>` : null}
      </div>`;
  }

  ui.ImportReport = ImportReport;
})();
