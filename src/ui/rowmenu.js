/* Meridian UI — the `…` row menu.

   Spec §3 lists the `…` menu as visual only. It is the row's actions, and a
   lossy one confirms inline in the sheets' own confirm language rather than
   through window.confirm (QUALITY-BAR §4).

   Written once and shared: the Log's rows offer Edit and Delete, the Goals
   table's offer Edit and Archive (QUALITY-BAR §1 — "if a new pattern is needed
   it is added once as a component and reused").

   The panel is `position: fixed` and placed against the button by hand, rather
   than absolutely positioned inside the row. Tables scroll horizontally below
   the design width, and a box with `overflow-x: auto` ALWAYS clips vertically
   too — CSS resolves the other axis to `auto`, there is no `overflow-x: auto;
   overflow-y: visible`. So an absolutely positioned menu on the last row was
   cut off by the scroller and grew it a vertical scrollbar of its own, which
   then closed the menu when it was dragged. Fixed positioning is the only
   thing that escapes an ancestor's clip. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var useState = preactHooks.useState;
  var useRef = preactHooks.useRef;
  var useEffect = preactHooks.useEffect;
  var useLayoutEffect = preactHooks.useLayoutEffect;

  var MENU_GAP = 6;      // between the button and the panel
  var MENU_EDGE = 8;     // smallest gap the panel keeps from a viewport edge

  /* `items`: { label, tone, confirm, onSelect }. An item with a `confirm`
     swaps the panel for that question instead of acting; everything else acts
     and closes. */
  function RowMenu(props) {
    var openState = useState(false);
    var confirmState = useState(null);
    var posState = useState(null);
    var open = openState[0], setOpen = openState[1];
    var confirming = confirmState[0], setConfirming = confirmState[1];
    var pos = posState[0], setPos = posState[1];
    var rootRef = useRef(null);
    var btnRef = useRef(null);
    var panelRef = useRef(null);

    var items = props.items || [];

    function close() {
      setOpen(false);
      setConfirming(null);
      setPos(null);
    }

    /* Under the button, or above it when there is not enough room below, and
       never past a viewport edge. */
    function place() {
      var btn = btnRef.current;
      var panel = panelRef.current;
      if (!btn || !panel) return;

      var b = btn.getBoundingClientRect();
      var w = panel.offsetWidth;
      var h = panel.offsetHeight;

      var top = b.bottom + MENU_GAP;
      if (top + h > window.innerHeight - MENU_EDGE) {
        var above = b.top - MENU_GAP - h;
        top = above >= MENU_EDGE ? above : Math.max(MENU_EDGE, window.innerHeight - MENU_EDGE - h);
      }

      var left = b.right - w;
      if (left + w > window.innerWidth - MENU_EDGE) left = window.innerWidth - MENU_EDGE - w;
      if (left < MENU_EDGE) left = MENU_EDGE;

      setPos(function (prev) {
        if (prev && prev.top === top && prev.left === left) return prev;
        return { top: top, left: left };
      });
    }

    /* Before paint, so the panel is never seen at the wrong place. Re-runs when
       the panel swaps to a confirm, which is a different height. */
    useLayoutEffect(function () {
      if (open) place();
    }, [open, confirming]);

    useEffect(function () {
      if (!open) return undefined;

      function onDocKey(event) {
        if (event.key !== 'Escape') return;
        /* Stop the key here so a menu open inside a sheet closes the menu and
           leaves the sheet standing. */
        event.stopPropagation();
        close();
        if (btnRef.current) btnRef.current.focus();
      }

      /* A pointerdown on a scrollbar lands on the scrolling element but outside
         its content box. It is not a click on the page, and closing the menu on
         it would mean the menu vanished the moment anything was scrolled. */
      function onScrollbar(event) {
        var t = event.target;
        if (!t || t.nodeType !== 1) return false;
        return event.offsetX > t.clientWidth || event.offsetY > t.clientHeight;
      }

      function onDocPointer(event) {
        if (onScrollbar(event)) return;
        if (rootRef.current && !rootRef.current.contains(event.target)) close();
      }

      document.addEventListener('keydown', onDocKey, true);
      document.addEventListener('pointerdown', onDocPointer, true);
      /* Capture, so a scroll of ANY ancestor keeps the panel on its button. */
      window.addEventListener('scroll', place, true);
      window.addEventListener('resize', place);
      return function () {
        document.removeEventListener('keydown', onDocKey, true);
        document.removeEventListener('pointerdown', onDocPointer, true);
        window.removeEventListener('scroll', place, true);
        window.removeEventListener('resize', place);
      };
    }, [open]);

    function choose(item) {
      if (item.confirm) {
        setConfirming(item);
        return;
      }
      close();
      item.onSelect();
    }

    return html`
      <div class="rowmenu" ref=${rootRef}>
        <button type="button" class="rowmenu__btn" data-menu-btn ref=${btnRef}
          aria-haspopup="menu" aria-expanded=${open ? 'true' : 'false'}
          aria-label=${'Actions for ' + props.name}
          onClick=${function () { open ? close() : setOpen(true); }}>…</button>

        ${open ? html`
          <div class="rowmenu__panel" data-overlay ref=${panelRef}
            role=${confirming ? 'group' : 'menu'}
            style=${pos ? 'top:' + pos.top + 'px;left:' + pos.left + 'px'
              : 'visibility:hidden'}>
            ${confirming ? html`
              <div class="confirm confirm--menu">
                <p class="confirm__text">${confirming.confirm.text}</p>
                <div class="confirm__actions">
                  <button type="button" class="btn btn--warn"
                    onClick=${function () { close(); confirming.onSelect(); }}
                  >${confirming.confirm.yes}</button>
                  <button type="button" class="btn"
                    onClick=${function () { setConfirming(null); }}
                  >${confirming.confirm.no || 'Keep'}</button>
                </div>
              </div>`
            : items.map(function (item, i) {
              return html`
                <button type="button" key=${i} role="menuitem"
                  class=${'rowmenu__item' + (item.tone === 'warn' ? ' rowmenu__item--warn' : '')}
                  onClick=${function () { choose(item); }}
                >${item.label}</button>`;
            })}
          </div>` : null}
      </div>`;
  }

  ui.RowMenu = RowMenu;
})();
