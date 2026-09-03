/* Meridian UI — first run.

   Spec §10 lists this as a gap the mockup does not cover, and it is the one
   screen that must exist before anything else renders: with no data there is no
   Log to page through and no range to analyse. So it takes the whole page, over
   a header stripped back to the wordmark, the theme toggle and the date — the
   three header things that still mean something before there is any data.

   The whole screen is a drop target, not just the button. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var useState = preactHooks.useState;

  var OPTIONS = [
    {
      id: 'import',
      title: 'Import workbook',
      sub: 'An .xlsx exported from Meridian, or one you have edited in Excel.'
    },
    {
      id: 'demo',
      title: 'Start with demo data',
      sub: 'Two made-up weeks, so every screen has something in it. You can clear it whenever you like.'
    },
    {
      id: 'empty',
      title: 'Start empty',
      sub: 'Eight categories to begin from. No entries, no goals.'
    }
  ];

  function FirstRun(props) {
    var dragState = useState(false);
    var dragging = dragState[0], setDragging = dragState[1];

    function onDragOver(event) {
      if (props.busy) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      if (!dragging) setDragging(true);
    }

    function onDragLeave(event) {
      /* relatedTarget is null when the pointer leaves the window entirely, and
         a descendant while it moves around inside — only the first ends a drag. */
      if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget)) return;
      setDragging(false);
    }

    function onDrop(event) {
      event.preventDefault();
      setDragging(false);
      if (props.busy) return;
      var file = event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) props.onFile(file);
    }

    function choose(id) {
      if (props.busy) return;
      if (id === 'import') ui.io.pickFile(props.onFile);
      if (id === 'demo') props.onDemo();
      if (id === 'empty') props.onEmpty();
    }

    return html`
      <main class="screen firstrun" data-s="firstrun"
        onDragOver=${onDragOver} onDragLeave=${onDragLeave} onDrop=${onDrop}>
        <div class="empty__head">
          <div class="t-eyebrow empty__eyebrow">MERIDIAN</div>
          <h1 class="t-h1">Start with what you have.</h1>
          <p class="firstrun__note">
            Your data stays in this browser and in a workbook you export. Nothing leaves this machine.
          </p>
        </div>

        <div class="firstrun__panel">
          ${props.busy ? html`
            <p class="busy" role="status">Working<span class="busy__dots" aria-hidden="true"></span></p>
          ` : null}

          ${props.message ? html`
            <p class="field__error" role="alert">${props.message}</p>` : null}
          ${/* Saved data that could not be read, or a browser that will not let
                Meridian save at all. It was only visible inside the Data sheet,
                which nobody opens before they have started — so the friend
                would have picked a path and lost the lot without being told. */
            props.error ? html`
            <p class="field__error firstrun__error" role="alert">${props.error.message}</p>` : null}

          <div class="firstrun__options">
            ${OPTIONS.map(function (o) {
              return html`
                <button type="button" class="option" key=${o.id} data-option=${o.id}
                  disabled=${!!props.busy}
                  onClick=${function () { choose(o.id); }}>
                  <span class="option__title">${o.title}</span>
                  <span class="option__sub">${o.sub}</span>
                </button>`;
            })}
          </div>

          <p class="firstrun__drop">
            ${dragging ? 'Drop the workbook to import it.' : 'You can also drop a workbook anywhere on this page.'}
          </p>
        </div>

        ${dragging ? html`<div class="dropveil" aria-hidden="true"></div>` : null}
      </main>`;
  }

  ui.FirstRun = FirstRun;
})();
