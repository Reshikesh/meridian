/* Meridian UI — the Data sheet.

   One entry point for everything that moves data in or out: export, import, the
   import report, the decision-15 replace-or-keep confirm, and Start fresh while
   the demo dataset is loaded. Purely presentational — app.js owns the store, so
   nothing here can write. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var useState = preactHooks.useState;

  function Busy() {
    return html`
      <p class="busy" role="status">Working<span class="busy__dots" aria-hidden="true"></span></p>`;
  }

  function Idle(props) {
    var confirmState = useState(false);
    var confirming = confirmState[0], setConfirming = confirmState[1];

    return html`
      <div class="data">
        <p class="data__status">${ui.format.exportLabel(props.exportInfo, props.now)}</p>

        ${props.storageError ? html`
          <p class="field__error" role="alert">${props.storageError.message}</p>` : null}

        ${props.message ? html`
          <p class="field__error" role="alert">${props.message}</p>` : null}

        <div class="data__actions">
          <button type="button" class="btn btn--brand" data-autofocus
            onClick=${props.onExport}>
            <${ui.Glyph} name="download" /> Export workbook
          </button>
          <button type="button" class="btn" onClick=${function () { ui.io.pickFile(props.onFile); }}>
            <${ui.Glyph} name="upload" /> Import workbook
          </button>
        </div>

        <p class="data__note">
          Export before you close. Meridian keeps your data in this browser, and a browser can be cleared.
        </p>

        ${props.source === 'demo' ? html`
          <div class="data__fresh">
            ${confirming ? html`
              <div class="confirm">
                <p class="confirm__text">Start fresh clears the demo data from this browser.</p>
                <div class="confirm__actions">
                  <button type="button" class="btn btn--warn" onClick=${props.onStartFresh}>Clear it</button>
                  <button type="button" class="btn" onClick=${function () { setConfirming(false); }}>Keep it</button>
                </div>
              </div>`
            : html`
              <div class="data__freshrow">
                <span class="chip chip--demo">DEMO DATA</span>
                <button type="button" class="linkbtn" onClick=${function () { setConfirming(true); }}>
                  Start fresh
                </button>
              </div>`}
          </div>` : null}
      </div>`;
  }

  function Imported(props) {
    return html`
      <div class="report">
        <h2 class="report__head">Imported.</h2>
        <p class="report__line">
          Your workbook has replaced what was in this browser.
          Export again when you next make a change.
        </p>
      </div>`;
  }

  function DataSheet(props) {
    var view = props.view;                       // idle | busy | report | imported
    var pending = props.pending;

    var body, footer;

    if (view === 'busy') {
      body = html`<${Busy} />`;
      footer = null;

    } else if (view === 'report' && pending) {
      body = html`<${ui.ImportReport} report=${pending.report} />`;
      footer = pending.report.fatal
        ? html`<button type="button" class="btn" onClick=${props.onDismissReport} data-autofocus>Close</button>`
        : html`
          <button type="button" class="btn" onClick=${props.onDismissReport}>
            ${props.firstRun ? 'Cancel' : 'Keep local, discard import'}
          </button>
          <button type="button" class="btn btn--brand" onClick=${props.onApplyImport} data-autofocus>
            ${props.firstRun ? 'Import' : 'Replace local data'}
          </button>`;

    } else if (view === 'imported') {
      body = html`<${Imported} />`;
      footer = html`<button type="button" class="btn btn--brand" onClick=${props.onClose} data-autofocus>Done</button>`;

    } else {
      body = html`
        <${Idle} exportInfo=${props.exportInfo} now=${props.now} source=${props.source}
          storageError=${props.storageError} message=${props.message}
          onExport=${props.onExport} onFile=${props.onFile} onStartFresh=${props.onStartFresh} />`;
      footer = html`<button type="button" class="btn" onClick=${props.onClose}>Done</button>`;
    }

    return html`
      <${ui.Sheet} title="DATA" onClose=${props.onClose} footer=${footer}
        wide=${view === 'report'}>
        ${view === 'report' && pending && !pending.report.fatal && !props.firstRun ? html`
          <p class="data__replace">You already have data in Meridian. Importing replaces it.</p>` : null}
        ${body}
      <//>`;
  }

  ui.DataSheet = DataSheet;
})();
