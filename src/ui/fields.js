/* Meridian UI — the form controls the sheets share.

   The mockup draws each of these once, as a static div with a hard-coded
   `data-active`, so none of them has keyboard behaviour, a focus ring or a
   disabled state. They are built here as real controls, once, and reused —
   QUALITY-BAR §1: "if a new pattern is needed it is added once as a component
   and reused."

   Every group here follows the same keyboard contract as a native radio group:
   one stop in the tab order, arrows move between options and select as they go,
   Home and End jump to the ends. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var useRef = preactHooks.useRef;
  var colour = window.Meridian.colour;

  /* The four swatches of the mockup's COLOUR row, in its order. */
  var SWATCHES = ['#2b7d5d', '#2b4a7d', '#a8641d', '#6b4a7d'];

  /* Spec §6, verbatim. The mark is drawn (vendor/README.md: Archivo has no
     glyph for ▲ ▼ at any subset). */
  var DIRECTIONS = [
    { id: 'more', mark: 'up', label: 'More', tone: 'good', note: 'More is better. Can carry goals.' },
    { id: 'less', mark: 'down', label: 'Less', tone: 'warn', note: 'Less is better. Has a weekly cap.' },
    { id: 'upkeep', mark: null, label: 'Upkeep', tone: 'dim', note: 'The cost of running a life. Never scored.' }
  ];

  /* ---------- label + control + message ---------- */

  /* One field: the caps label of the mockup, an optional brand-coloured note
     beside it (the entry sheet's "FILLED FROM THE GOAL"), the control, and the
     validation message underneath.

     The message is `role="alert"` and is tied to the control by id, so it is
     announced and reachable rather than only visible (QUALITY-BAR §4). */
  function Field(props) {
    var errorId = props.id ? props.id + '-error' : null;
    return html`
      <div class=${'field' + (props.className ? ' ' + props.className : '')}>
        ${props.label ? html`
          <div class="field__labelrow">
            <span class="t-label" id=${props.id ? props.id + '-label' : null}>${props.label}</span>
            ${props.note ? html`<span class="field__note">${props.note}</span>` : null}
          </div>` : null}
        ${props.children}
        ${props.error ? html`
          <p class="field__error" id=${errorId} role="alert">${props.error}</p>` : null}
        ${props.hint ? html`<p class="field__hint">${props.hint}</p>` : null}
      </div>`;
  }

  /* ---------- roving-tabindex radio group ----------
     Shared by the segmented controls, the direction cards and the swatches, so
     the three behave identically under the keyboard. `ids` is the option order;
     `render` draws one option. */
  function useRoving(ids, value, onChange) {
    var ref = useRef(null);

    function move(to) {
      if (to < 0) to = ids.length - 1;
      if (to >= ids.length) to = 0;
      onChange(ids[to]);
      var root = ref.current;
      if (!root) return;
      var buttons = root.querySelectorAll('[data-opt]');
      if (buttons[to]) buttons[to].focus();
    }

    function onKeyDown(event) {
      var at = ids.indexOf(value);
      if (at === -1) at = 0;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        move(at + 1);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        move(at - 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        move(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        move(ids.length - 1);
      }
    }

    /* Exactly one option is in the tab order: the selected one, or the first if
       nothing is selected yet. */
    function tabIndex(id, index) {
      var selected = ids.indexOf(value);
      var focusable = selected === -1 ? 0 : selected;
      return index === focusable ? 0 : -1;
    }

    return { ref: ref, onKeyDown: onKeyDown, tabIndex: tabIndex };
  }

  /* ---------- segmented control ----------
     `[data-seg]` in the mockup: HOW LONG, COUNTS TOWARD, and the Where-it-went
     SPLIT / SORT pairs in Phase 3. */
  function Segmented(props) {
    var options = props.options;
    var ids = options.map(function (o) { return o.id; });
    var roving = useRoving(ids, props.value, props.onChange);

    return html`
      <div class="seg" role="radiogroup" ref=${roving.ref}
        aria-labelledby=${props.labelledBy || null} aria-label=${props.label || null}
        onKeyDown=${roving.onKeyDown}>
        ${options.map(function (o, i) {
          var active = props.value === o.id;
          return html`
            <button type="button" class="seg__btn" key=${o.id} data-opt data-seg
              data-active=${active ? '1' : '0'} role="radio" aria-checked=${active}
              tabIndex=${roving.tabIndex(o.id, i)}
              data-autofocus=${props.autofocus && roving.tabIndex(o.id, i) === 0 ? '' : null}
              disabled=${o.disabled || false}
              onClick=${function () { props.onChange(o.id); }}
            >${o.label}</button>`;
        })}
      </div>`;
  }

  /* ---------- direction cards ----------
     `[data-dir]` in the mockup. Copy verbatim from spec §6. */
  function DirectionCards(props) {
    var ids = DIRECTIONS.map(function (d) { return d.id; });
    var roving = useRoving(ids, props.value, props.onChange);

    return html`
      <div class="dirs" role="radiogroup" ref=${roving.ref}
        aria-labelledby=${props.labelledBy || null} aria-label=${props.label || null}
        onKeyDown=${roving.onKeyDown}>
        ${DIRECTIONS.map(function (d, i) {
          var active = props.value === d.id;
          return html`
            <button type="button" class="dir" key=${d.id} data-opt data-dir
              data-active=${active ? '1' : '0'} role="radio" aria-checked=${active}
              tabIndex=${roving.tabIndex(d.id, i)}
              onClick=${function () { props.onChange(d.id); }}>
              <span class=${'dir__title dir__title--' + d.tone}>
                ${d.mark ? html`<${ui.Glyph} name=${d.mark} size=${10} />` : html`
                  <span class="dir__dash" aria-hidden="true">—</span>`}
                ${' '}${d.label}
              </span>
              <span class="dir__note">${d.note}</span>
            </button>`;
        })}
      </div>`;
  }

  /* ---------- colour swatches ----------
     QUALITY-BAR §7: the hexes are fixed and theme-invariant, so a swatch that
     falls under 3:1 against the theme's own background is given a 1px --line
     outline rather than being changed. `src/core/colour.js` decides which. */
  function Swatch(props) {
    var outline = colour.needsOutline(props.hex, props.theme);
    return html`
      <span class=${'swatch' + (props.className ? ' ' + props.className : '')}
        data-outline=${outline ? '1' : '0'}
        style=${'background:' + props.hex} />`;
  }

  function Swatches(props) {
    var roving = useRoving(SWATCHES, props.value, props.onChange);

    return html`
      <div class="swatches" role="radiogroup" ref=${roving.ref}
        aria-labelledby=${props.labelledBy || null} aria-label=${props.label || null}
        onKeyDown=${roving.onKeyDown}>
        ${SWATCHES.map(function (hex, i) {
          var active = String(props.value).toLowerCase() === hex;
          return html`
            <button type="button" class="swatches__btn" key=${hex} data-opt
              data-active=${active ? '1' : '0'} role="radio" aria-checked=${active}
              tabIndex=${roving.tabIndex(hex, i)}
              aria-label=${'Colour ' + (i + 1) + ' of ' + SWATCHES.length}
              onClick=${function () { props.onChange(hex); }}>
              <${Swatch} hex=${hex} theme=${props.theme} />
            </button>`;
        })}
      </div>`;
  }

  /* ---------- dropdown ----------
     A real <select>. The mockup draws a div with a small triangle, which has no
     keyboard, no type-ahead and no accessible name; the box below is styled to
     match it exactly, and the caret is drawn because Archivo has no glyph for
     that triangle at any subset (vendor/README.md).

     The empty option is the placeholder, so a picker with nothing chosen reads
     as "Category" / "Counts toward" rather than as a blank box. */
  function Select(props) {
    return html`
      <div class=${'select' + (props.className ? ' ' + props.className : '')}>
        <select class=${'select__input' + (props.value ? '' : ' select__input--empty')}
          id=${props.id || null}
          value=${props.value || ''}
          disabled=${props.disabled || false}
          aria-label=${props.label || null}
          aria-labelledby=${props.labelledBy || null}
          aria-invalid=${props.invalid ? 'true' : null}
          data-autofocus=${props.autofocus ? '' : null}
          ref=${props.inputRef || null}
          onKeyDown=${props.onKeyDown}
          onChange=${function (e) { props.onChange(e.currentTarget.value || null); }}>
          <option value="">${props.placeholder}</option>
          ${props.options.map(function (o) {
            return html`<option value=${o.id} key=${o.id}>${o.label}</option>`;
          })}
        </select>
        <span class="select__caret" aria-hidden="true">
          <${ui.Glyph} name="caret" size=${10} />
        </span>
      </div>`;
  }

  /* Archived categories leave every picker and stay in the history (§8.11) —
     except the one already on the entry being edited, which stays in the list so
     an old row can be saved without silently changing category. */
  function CategorySelect(props) {
    var options = props.categories
      .filter(function (c) { return !c.archived || c.id === props.value; })
      .map(function (c) {
        return { id: c.id, label: c.name + (c.archived ? ' (archived)' : '') };
      });
    return html`<${Select} ...${props} options=${options}
      placeholder=${props.placeholder || 'Category'} />`;
  }

  /* Goals that can still take hours: not archived, and fed by a category that is
     not archived either. Business rule §8.2 is enforced by the caller — picking
     one fills its category, and moving off that category clears the goal. */
  function GoalSelect(props) {
    var options = (props.goals || [])
      .filter(function (g) {
        if (g.id === props.value) return true;
        if (g.archived) return false;
        for (var i = 0; i < props.categories.length; i++) {
          if (props.categories[i].id === g.category_id) return !props.categories[i].archived;
        }
        return false;
      })
      .map(function (g) { return { id: g.id, label: g.short_name }; });
    return html`<${Select} ...${props} options=${options}
      placeholder=${props.placeholder || 'Counts toward'} />`;
  }

  /* ---------- the mockup's dashed "editable text" ----------
     `[data-fld]` promises editability with no editor behind it (spec §3). This
     is the editor: the same dashed underline, with a real input in it. */
  function TextField(props) {
    return html`
      <input type="text" class=${'fld' + (props.className ? ' ' + props.className : '')}
        id=${props.id || null}
        value=${props.value === null || props.value === undefined ? '' : props.value}
        placeholder=${props.placeholder || ''}
        maxLength=${props.maxLength || 120}
        autocomplete="off" spellcheck=${props.spellcheck === false ? 'false' : 'true'}
        inputMode=${props.inputMode || null}
        aria-label=${props.label || null}
        aria-labelledby=${props.labelledBy || null}
        aria-invalid=${props.invalid ? 'true' : null}
        aria-describedby=${props.describedBy || null}
        disabled=${props.disabled || false}
        data-autofocus=${props.autofocus ? '' : null}
        ref=${props.inputRef || null}
        onKeyDown=${props.onKeyDown}
        onInput=${function (e) { props.onInput(e.currentTarget.value); }} />`;
  }

  ui.fields = {
    SWATCHES: SWATCHES,
    DIRECTIONS: DIRECTIONS,
    Field: Field,
    Select: Select,
    GoalSelect: GoalSelect,
    Segmented: Segmented,
    DirectionCards: DirectionCards,
    Swatch: Swatch,
    Swatches: Swatches,
    CategorySelect: CategorySelect,
    TextField: TextField
  };
})();
