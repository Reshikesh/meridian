/* Meridian UI — the sheet a dialog sits in.

   QUALITY-BAR §4 in one place: Escape closes, clicking the veil closes, focus
   is trapped inside while open and returns to the opener on close, the first
   field is focused on open, and the page behind cannot scroll.

   Phase 1 had two dialogs of its own — the Data sheet and the import report,
   including the replace-or-keep confirm, which QUALITY-BAR §4 names as a lossy
   action that must confirm inline and never through window.confirm. Phase 2
   adds the sheets proper (entry, category, manage) and, with them, stacking:
   the New category sheet opens over Manage at z-index 41 and closes back to it,
   which is what the mockup's `data-open="back"` encodes. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var useLayoutEffect = preactHooks.useLayoutEffect;
  var useRef = preactHooks.useRef;

  /* Every open sheet, oldest first. Escape belongs to the last one.

     Without this, two sheets both add a capture-phase keydown listener to
     `document`: capture listeners on the SAME node fire in registration order,
     so the outer sheet would hear Escape first, and `stopPropagation` does not
     silence a listener on the node it was called from. One Escape would close
     both. */
  var OPEN = [];

  var FOCUSABLE = [
    'a[href]', 'button:not([disabled])', 'input:not([disabled])',
    'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  function focusable(root) {
    return Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), function (el) {
      return el.offsetWidth > 0 || el.offsetHeight > 0 || el === document.activeElement;
    });
  }

  function Sheet(props) {
    var cardRef = useRef(null);
    /* Whether the gesture that produced a click STARTED on the veil. Without
       it, dragging a text selection out of a field and releasing over the veil
       fires `click` on the veil — the nearest common ancestor of the two — and
       throws the half-typed sheet away. */
    var downOnVeil = useRef(false);
    var onClose = props.onClose;

    /* A layout effect, not an effect: the vendored hooks run `useEffect` after
       the frame is painted, so for one frame the sheet was on screen with no
       Escape handler, no focus trap, no scroll lock and no focused field. On an
       idle machine that frame is invisible; under load it is long enough to
       swallow a real Escape, which is how the perf suite caught it. */
    useLayoutEffect(function () {
      var card = cardRef.current;
      var opener = document.activeElement;
      var body = document.body;
      var token = {};
      OPEN.push(token);

      /* Locking the body would remove the scrollbar and shift the whole page
         left by its width; the gutter is paid back as padding. */
      var gutter = window.innerWidth - document.documentElement.clientWidth;
      var prevOverflow = body.style.overflow;
      var prevPadding = body.style.paddingRight;
      body.style.overflow = 'hidden';
      if (gutter > 0) body.style.paddingRight = gutter + 'px';

      var first = card.querySelector('[data-autofocus]') || focusable(card)[0] || card;
      if (first && first.focus) first.focus();

      function onKeyDown(event) {
        /* Only the topmost sheet answers, so Escape closes the stacked category
           sheet and leaves Manage standing behind it. */
        if (OPEN[OPEN.length - 1] !== token) return;
        if (event.key === 'Escape') {
          /* `stopPropagation` cannot silence another listener on `document`,
             and both this and the Where-it-went screen's pick-abort are capture
             listeners there. Their firing order depends on which effect ran
             last, which is not something either should have to know, so the
             event carries the answer instead: a sheet has taken this Escape.
             Not `stopImmediatePropagation`, which would also silence the row
             menu's own Escape when one is open inside a sheet. */
          event.meridianSheetClosed = true;
          event.stopPropagation();
          onClose();
          return;
        }
        if (event.key !== 'Tab') return;
        var items = focusable(card);
        if (!items.length) return;
        var firstItem = items[0];
        var lastItem = items[items.length - 1];
        if (event.shiftKey && document.activeElement === firstItem) {
          event.preventDefault();
          lastItem.focus();
        } else if (!event.shiftKey && document.activeElement === lastItem) {
          event.preventDefault();
          firstItem.focus();
        } else if (!card.contains(document.activeElement)) {
          event.preventDefault();
          firstItem.focus();
        }
      }

      document.addEventListener('keydown', onKeyDown, true);

      return function () {
        document.removeEventListener('keydown', onKeyDown, true);
        var at = OPEN.indexOf(token);
        if (at !== -1) OPEN.splice(at, 1);
        body.style.overflow = prevOverflow;
        body.style.paddingRight = prevPadding;
        if (opener && opener.focus && document.contains(opener)) opener.focus();
      };
    }, []);

    function onVeilPointerDown(event) {
      downOnVeil.current = event.target === event.currentTarget;
    }

    function onVeilClick(event) {
      if (event.target === event.currentTarget && downOnVeil.current) onClose();
      downOnVeil.current = false;
    }

    /* A real <form> when the sheet has a primary action, so Enter in a field
       saves it — native implicit submission, which also leaves Enter on a
       segmented button doing what it should (picking that option) instead of
       saving the sheet from under it. The body and the footer both go inside,
       because the submit button lives in the footer. */
    var body = html`
      <div class=${'sheet__body' + (props.bodyClass ? ' ' + props.bodyClass : '')}>
        ${props.children}
      </div>`;

    var foot = props.footer ? html`
      <div class=${'sheet__foot' + (props.footClass ? ' ' + props.footClass : '')}>
        ${props.footer}
      </div>` : null;

    function onSubmit(event) {
      event.preventDefault();
      props.onSubmit();
    }

    return html`
      <div class=${'sheet' + (props.wide ? ' sheet--wide' : '') +
          (props.stacked ? ' sheet--stacked' : '')}
        onPointerDown=${onVeilPointerDown} onClick=${onVeilClick}>
        <div class="sheet__card" ref=${cardRef} role="dialog" aria-modal="true"
          aria-label=${props.title}>
          <div class="sheet__head">
            <span class="sheet__title">${props.title}</span>
            <div class="sheet__tools">
              ${props.tools || null}
              <button type="button" class="sheet__close" onClick=${onClose} aria-label="Close">
                <${ui.Glyph} name="close" />
              </button>
            </div>
          </div>
          ${props.onSubmit
            ? html`<form class="sheet__form" onSubmit=${onSubmit}>${[body, foot]}</form>`
            : [body, foot]}
        </div>
      </div>`;
  }

  ui.Sheet = Sheet;

  /* Whether any sheet is open. The Where-it-went screen's Escape (which
     aborts a pick) defers to a sheet's own Escape while one is up. */
  ui.sheetOpen = function () { return OPEN.length > 0; };
})();
