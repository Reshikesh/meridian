/* Meridian UI — the Data sheet.

   One entry point for everything that moves data in or out: export, import, the
   import report, the decision-15 replace-or-keep confirm, and Start fresh while
   the demo dataset is loaded. Purely presentational — app.js owns the store, so
   nothing here can write. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var version = window.Meridian.version;
  var useState = preactHooks.useState;
  var useEffect = preactHooks.useEffect;

  function Busy() {
    return html`
      <p class="busy" role="status">Working<span class="busy__dots" aria-hidden="true"></span></p>`;
  }

  /* Decision 32: the linked workbook. Hidden entirely where the browser has no
     file picker — in Firefox and Safari this block does not exist and the
     export flow above it is the whole story (DECISION-LOG 261). */
  function Workbook(props) {
    var link = props.link;
    if (!link || link.state === 'unsupported') return null;

    if (link.state === 'unlinked') {
      return html`
        <div class="data__wb">
          <p class="t-label data__wbhead">WORKBOOK</p>
          <p class="data__wbnote">
            Meridian can keep a spreadsheet on your computer up to date as you log.
          </p>
          <div class="data__actions">
            <button type="button" class="btn" data-link-existing onClick=${props.onLink}>
              <${ui.Glyph} name="upload" /> Link workbook
            </button>
            <button type="button" class="btn" data-link-new onClick=${props.onCreate}>
              <${ui.Glyph} name="download" /> Create workbook
            </button>
          </div>
        </div>`;
    }

    return html`
      <div class="data__wb">
        <p class="t-label data__wbhead">WORKBOOK</p>
        <p class="data__wbfile" data-link-file>${ui.format.linkLabel(link.info, props.now)}</p>
        ${link.state === 'needs-grant' ? html`
          <p class="data__wbnote">
            Your browser asks once each time you open Meridian. Click Allow and logging saves straight to the file.
          </p>` : null}
        ${link.state === 'locked' ? html`
          <p class="data__wbnote">
            The last save did not reach the file. Meridian still has everything, and will try again with your next change.
          </p>` : null}
        <button type="button" class="linkbtn" data-link-off onClick=${props.onUnlink}>Unlink</button>
      </div>`;
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

        <${Workbook} link=${props.link} now=${props.now}
          onLink=${props.onLink} onCreate=${props.onCreate} onUnlink=${props.onUnlink} />

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
    var view = props.view;      // idle | busy | report | adopted | conflict | imported
    var pending = props.pending;

    /* The sheet focuses its default when it opens (sheets/sheet.js), but every
       view that carries a decision arrives later — after the busy state — and
       nothing has moved focus since. A choice this consequential should own the
       keyboard rather than leave Enter on the close button. */
    useEffect(function () {
      if (view === 'idle' || view === 'busy') return;
      var el = document.querySelector('.sheet__card [data-autofocus]');
      if (el && el.focus) el.focus();
    }, [view]);

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

    /* Decision 37 B: the workbook had moved on and nothing local was at stake,
       so it was simply opened. This appears only when rows were rejected —
       decision 5 does not bend just because nobody clicked anything. */
    } else if (view === 'adopted' && pending) {
      body = html`
        <div class="data__conflict">
          <p class="data__replace">Your workbook had changed, so Meridian opened what it holds.</p>
          <${ui.ImportReport} report=${pending.report} />
        </div>`;
      footer = html`
        <button type="button" class="btn" onClick=${props.onDismissReport} data-autofocus>Close</button>`;

    /* Decision 37 C: the file changed under us and can be read, so the friend
       chooses. The same two-way decision as an import (15), reusing the same
       report — but the brand button is Keep local here, because nobody asked
       for this and what is in Meridian is what they were typing a moment ago. */
    } else if (view === 'conflict' && pending) {
      /* Two moments, one decision, opposite defaults. An outside edit interrupts
         work that is still in the app, so Keep local leads. Linking a workbook
         is a file the friend went and chose, holding data they can see counted
         in the report below — so Replace local leads there, and the button that
         overwrites it is the quiet one. */
      var fromLink = props.reason === 'link';
      var keepBtn = html`
        <button type="button" class="btn${fromLink ? '' : ' btn--brand'}" data-keep-local
          data-autofocus=${fromLink ? null : ''} onClick=${props.onKeepLocal}>
          Keep local, overwrite the workbook
        </button>`;
      var replaceBtn = html`
        <button type="button" class="btn${fromLink ? ' btn--brand' : ''}" data-replace-local
          data-autofocus=${fromLink ? '' : null} onClick=${props.onApplyImport}>
          Replace local data
        </button>`;

      body = html`
        <div class="data__conflict">
          <p class="data__replace">
            ${fromLink ? 'This workbook already has data in it.' : 'Your workbook changed outside Meridian.'}
          </p>
          <p class="data__wbnote">
            Keep local rewrites the workbook now, with what is in Meridian.
            Replace local loads the workbook and drops what is in this browser.
          </p>
          <${ui.ImportReport} report=${pending.report} />
        </div>`;
      footer = fromLink
        ? html`${keepBtn}${replaceBtn}`
        : html`${replaceBtn}${keepBtn}`;

    /* Nothing local was at stake, so the workbook was simply opened. Meridian
       starting empty while the file holds a fortnight is usually a browser
       clearing site data on close, and the friend cannot be expected to guess
       that — so the way to stop it is named here, at the moment it bites. */
    } else if (view === 'opened' && pending) {
      body = html`
        <div class="data__conflict">
          <p class="data__replace">Your workbook is open.</p>
          <p class="data__wbnote">
            Meridian had nothing in it, so everything here came from the file.
            If Meridian is empty every time you start, your browser is clearing
            its data when it closes. In Edge: Settings → Privacy, search, and
            services → Clear browsing data on close → turn off
            “Cookies and other site data”.
          </p>
          <${ui.ImportReport} report=${pending.report} />
        </div>`;
      footer = html`
        <button type="button" class="btn btn--brand" onClick=${props.onClose} data-autofocus>Done</button>`;

    } else if (view === 'imported') {
      body = html`<${Imported} />`;
      footer = html`<button type="button" class="btn btn--brand" onClick=${props.onClose} data-autofocus>Done</button>`;

    } else {
      body = html`
        <${Idle} exportInfo=${props.exportInfo} now=${props.now} source=${props.source}
          storageError=${props.storageError} message=${props.message} link=${props.link}
          onExport=${props.onExport} onFile=${props.onFile} onStartFresh=${props.onStartFresh}
          onLink=${props.onLink} onCreate=${props.onCreate} onUnlink=${props.onUnlink} />`;
      /* Decision 28: the version, in the footer of the sheet that writes it
         into every export's Meta sheet. The idle view only — during an import
         decision the footer is carrying two buttons and a choice, and a build
         number there is noise. */
      footer = html`
        <span class="t-label sheet__version">${version.DISPLAY}</span>
        <button type="button" class="btn" onClick=${props.onClose}>Done</button>`;
    }

    return html`
      <${ui.Sheet} title="DATA" onClose=${props.onClose} footer=${footer}
        wide=${view === 'report' || view === 'conflict' || view === 'adopted' || view === 'opened'}>
        ${view === 'report' && pending && !pending.report.fatal && !props.firstRun ? html`
          <p class="data__replace">You already have data in Meridian. Importing replaces it.</p>` : null}
        ${body}
      <//>`;
  }

  ui.DataSheet = DataSheet;
})();
