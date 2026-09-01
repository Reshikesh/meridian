/* Meridian UI — the sheet a dialog sits in.

   QUALITY-BAR §4 in one place: Escape closes, clicking the veil closes, focus
   is trapped inside while open and returns to the opener on close, the first
   field is focused on open, and the page behind cannot scroll.

   Phase 1 has two dialogs of its own — the Data sheet and the import report,
   including the replace-or-keep confirm, which QUALITY-BAR §4 names as a lossy
   action that must confirm inline and never through window.confirm. Phase 2
   owns the sheets proper (entry, goal, category, manage) and the stacked
   category sheet; nothing here tries to anticipate them. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var useEffect = preactHooks.useEffect;
  var useRef = preactHooks.useRef;

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
    var onClose = props.onClose;

    useEffect(function () {
      var card = cardRef.current;
      var opener = document.activeElement;
      var body = document.body;

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
        if (event.key === 'Escape') {
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
        body.style.overflow = prevOverflow;
        body.style.paddingRight = prevPadding;
        if (opener && opener.focus && document.contains(opener)) opener.focus();
      };
    }, []);

    function onVeilClick(event) {
      if (event.target === event.currentTarget) onClose();
    }

    return html`
      <div class=${'sheet' + (props.wide ? ' sheet--wide' : '')} onClick=${onVeilClick}>
        <div class="sheet__card" ref=${cardRef} role="dialog" aria-modal="true"
          aria-label=${props.title}>
          <div class="sheet__head">
            <span class="sheet__title">${props.title}</span>
            <button type="button" class="sheet__close" onClick=${onClose} aria-label="Close">
              <${ui.Glyph} name="close" />
            </button>
          </div>
          <div class="sheet__body">${props.children}</div>
          ${props.footer ? html`<div class="sheet__foot">${props.footer}</div>` : null}
        </div>
      </div>`;
  }

  ui.Sheet = Sheet;
})();
