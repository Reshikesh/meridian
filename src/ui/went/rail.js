/* Meridian UI — the left rail: status or ↩ UNDO, the four presets, the two
   typed dates, and the calendar under them (spec §3, §4d; deck-02-went.png).

   The rail draws and asks; every decision is core's. A day click goes to
   range.pick through app.js, a preset to range.preset, a typed date to
   range.commitTyped — which answers null for anything it will not take, and
   the field reverts to what it showed before with a short --warnbg hold so
   the revert is seen (QUALITY-BAR §4). The hold is a timed class, not an
   animation, so it survives prefers-reduced-motion.

   Typed-date behaviour is the mockup's: focus selects the text, scrolls the
   calendar to that endpoint and rings it; Enter commits and blurs; Escape
   discards the draft and blurs; blur commits. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var useState = preactHooks.useState;
  var useRef = preactHooks.useRef;
  var useEffect = preactHooks.useEffect;
  var dates = window.Meridian.dates;
  var range = window.Meridian.range;

  var PRESETS = [
    { id: '30', label: '30D' },
    { id: '90', label: '90D' },
    { id: 'ytd', label: 'YTD' },
    { id: 'all', label: 'ALL' }
  ];

  /* QUALITY-BAR §3: no motion over 200ms. */
  var FLASH_MS = 200;

  function DateInput(props) {
    var draftState = useState(null);
    var draft = draftState[0], setDraft = draftState[1];
    var flashState = useState(false);
    var flashing = flashState[0], setFlashing = flashState[1];
    var flashTimer = useRef(null);
    var committed = useRef(false);

    useEffect(function () {
      return function () { clearTimeout(flashTimer.current); };
    }, []);

    function flash() {
      clearTimeout(flashTimer.current);
      setFlashing(true);
      flashTimer.current = setTimeout(function () { setFlashing(false); }, FLASH_MS);
    }

    /* Mockup commitDate. A draft that was never typed just drops the focus
       ring; one that will not parse or is out of bounds reverts, visibly. */
    function commit() {
      if (draft === null) { props.onEfield(null); return; }
      var day = props.onCommit(draft);
      setDraft(null);
      props.onEfield(null);
      if (day === null) flash();
      else props.onScrollTo(day);
    }

    function onKeyDown(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        committed.current = true;
        commit();
        event.currentTarget.blur();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        committed.current = true;
        setDraft(null);
        props.onEfield(null);
        event.currentTarget.blur();
      }
    }

    /* Enter and Escape blur the field themselves; the blur that follows must
       not commit a second time (it would land the same range again and clear
       the undo the first landing armed). */
    function onBlur() {
      if (committed.current) { committed.current = false; return; }
      commit();
    }

    function onFocus(event) {
      committed.current = false;
      props.onEfield(props.which);
      event.currentTarget.select();
      props.onScrollTo(props.day);
    }

    return html`
      <label class="sr-only" for=${props.id}>${props.label}</label>
      <input id=${props.id} type="text" spellcheck="false" autocomplete="off"
        class=${'input rail__input' + (flashing ? ' rail__input--reverted' : '')}
        value=${draft === null ? dates.formatLong(props.day) : draft}
        aria-invalid=${flashing ? 'true' : null}
        onInput=${function (e) { setDraft(e.currentTarget.value); }}
        onFocus=${onFocus} onBlur=${onBlur} onKeyDown=${onKeyDown} />`;
  }

  function Rail(props) {
    var view = props.view;
    var active = range.activePreset(view.range, props.today, props.minDay);
    var undo = range.showUndo(view);

    return html`
      <aside class="rail">
        <div class="rail__top">
          <div class="rail__status">
            ${undo ? html`
              <button type="button" class="rail__undo" onClick=${props.actions.undo}>
                <${ui.Glyph} name="undo" size=${10} weight=${1.8} />${' '}UNDO
              </button>`
            : html`<span class="rail__days">${range.status(view)}</span>`}
            <span class="rail__spacer" />
            <div class="presets" role="group" aria-label="Range presets">
              ${PRESETS.map(function (p) {
                var on = active === p.id;
                return html`
                  <button type="button" class="preset" key=${p.id} data-preset=${p.id}
                    data-active=${on ? '1' : '0'} aria-pressed=${on ? 'true' : 'false'}
                    onClick=${function () { props.actions.preset(p.id); }}>${p.label}</button>`;
              })}
            </div>
          </div>
          <div class="rail__dates">
            <${DateInput} id="rangeStart" which="start" label="Start date" day=${view.range.start}
              onCommit=${function (text) { return props.actions.typed('start', text); }}
              onEfield=${props.onEfield} onScrollTo=${props.onScrollTo} />
            <span class="rail__dash" aria-hidden="true">–</span>
            <${DateInput} id="rangeEnd" which="end" label="End date" day=${view.range.end}
              onCommit=${function (text) { return props.actions.typed('end', text); }}
              onEfield=${props.onEfield} onScrollTo=${props.onScrollTo} />
          </div>
        </div>
        <${ui.Calendar}
          range=${view.range} minDay=${props.minDay} today=${props.today}
          heat=${props.heat} efield=${props.efield} scrollTo=${props.scrollTo}
          onPick=${props.actions.pick} />
      </aside>`;
  }

  ui.Rail = Rail;
})();
