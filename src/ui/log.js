/* Meridian UI — the Log screen.

   The day's entries, the quick-add row, the row menu and the week bar strip.
   Layout, type and copy are the mockup's (spec §6, deck-01-log.png), with the
   two changes the decisions require: no VALUE column and no value dots
   (decision 10), and a real quick-add row that commits on Enter (decision 19).
   The denominators are the mockup's own — 24 h a day, 168 h a week — because
   decision 17, as amended, has no sleep setting.

   No business rules live here. Durations are parsed by
   `aggregate.parseDuration`, every entry is checked by `validate.validateEntry`,
   and the store does the writing. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var useState = preactHooks.useState;
  var useRef = preactHooks.useRef;
  var useEffect = preactHooks.useEffect;
  var useLayoutEffect = preactHooks.useLayoutEffect;

  var dates = window.Meridian.dates;
  var aggregate = window.Meridian.aggregate;
  var validate = window.Meridian.validate;
  var fields = ui.fields;

  /* spec §4f: "Bars are hours per day, 18 h scale." */
  var BAR_SCALE_HOURS = 18;

  function findById(list, id) {
    for (var i = 0; i < (list || []).length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* ---------- day header ---------- */

  function DayHead(props) {
    var cov = props.coverage;
    return html`
      <div class="logday">
        <div class="logday__text">
          <div class="t-eyebrow">${dates.formatDayHeading(props.day)}</div>
          <h1 class="t-h1">
            ${cov.loggedHours.toFixed(1)} h accounted for<span
              class="logday__togo">, ${cov.unloggedHours.toFixed(1)} to go</span>
          </h1>
        </div>
        <div class="logday__actions">
          <button type="button" class="btn btn--quiet" onClick=${props.onManage}>
            Manage categories
          </button>
          <div class="logday__paging">
            <button type="button" class="btn btn--icon" aria-label="Previous day"
              onClick=${function () { props.onDay(-1); }}>
              <${ui.Glyph} name="arrowleft" />
            </button>
            <button type="button" class="btn btn--icon" aria-label="Next day"
              disabled=${props.day >= props.today}
              onClick=${function () { props.onDay(1); }}>
              <${ui.Glyph} name="arrow" />
            </button>
          </div>
        </div>
      </div>`;
  }

  /* ---------- quick-add row ----------
     Decision 19, as amended: the inline row commits on Enter and carries the
     goal picker too, so a goal-linked entry never has to open a dialog.

     `+` adds the entry when the row already says everything an entry needs, and
     opens the full sheet when it does not — carrying whatever is typed, so the
     two paths are one flow rather than two forms. A dialog that only repeats
     what is already on screen is a dialog worth not opening.

     The row's five columns are the table's five columns, so every control sits
     under its own header.

     The draft itself lives in app.js: an entry saved through the sheet has to
     clear this row too, and only the level that owns both can do that. */

  var DURATION_HINT = 'Use a time like 1.5, 1.5h or 90m.';

  function QuickAdd(props) {
    var errorState = useState(null);
    var error = errorState[0], setError = errorState[1];
    var durationRef = useRef(null);

    var draft = props.draft;
    var categories = aggregate.activeCategories(props.state.categories);
    var disabled = categories.length === 0;

    function patch(p) {
      props.onDraft(Object.assign({}, draft, p));
      if (error) setError(null);
    }

    /* Business rule §8.2, both ways round: a goal lives inside one category, so
       picking a goal fills that category, and moving the category off it clears
       the goal rather than saving a pairing validate.js would refuse. */
    function chooseGoal(id) {
      var goal = id ? findById(props.state.goals, id) : null;
      patch(goal
        ? { goal_id: goal.id, category_id: goal.category_id }
        : { goal_id: null });
    }

    function chooseCategory(id) {
      var goal = draft.goal_id ? findById(props.state.goals, draft.goal_id) : null;
      patch({ category_id: id, goal_id: goal && goal.category_id === id ? goal.id : null });
    }

    function commit() {
      var text = String(draft.duration).trim();
      var minutes = text === '' ? null : aggregate.parseDuration(text);

      /* A blank field and an unreadable one are different mistakes, and the
         second one deserves to be told what a readable value looks like. */
      if (text !== '' && minutes === null) {
        setError({ field: 'duration', message: DURATION_HINT });
        return;
      }

      var input = {
        date: props.day,
        duration_min: minutes,
        activity: String(draft.activity).trim() || null,
        category_id: draft.category_id,
        goal_id: draft.goal_id || null
      };

      var check = validate.validateEntry(input, props.state, { now: props.now });
      if (!check.ok) {
        setError({ field: check.errors[0].field, message: check.errors[0].message });
        return;
      }

      /* The row is cleared by app.js, which owns the draft — an entry saved
         through the sheet has to clear it too. QUALITY-BAR §4: focus goes back
         to the duration field, so consecutive entries take no mouse. */
      props.onAdd(input);
      setError(null);
      if (durationRef.current) durationRef.current.focus();
    }

    /* Enter commits from any field in the row. */
    function onKeyDown(event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      commit();
    }

    /* Everything an entry has to have: a duration that can be read, and a
       category. Activity is optional (spec §6) and a goal is a choice. */
    function complete() {
      var text = String(draft.duration).trim();
      return text !== '' && aggregate.parseDuration(text) !== null && !!draft.category_id;
    }

    /* `+` finishes the job if the row can, and otherwise opens the place where
       it can be finished. A duration with a typo in it takes the message rather
       than the dialog: the owner was typing a duration, not asking for a form. */
    function addOrOpen() {
      var text = String(draft.duration).trim();
      if (text !== '' && aggregate.parseDuration(text) === null) {
        setError({ field: 'duration', message: DURATION_HINT });
        return;
      }
      if (complete()) commit();
      else props.onOpenSheet(draft);
    }

    var durationError = error && (error.field === 'duration' || error.field === 'duration_min');
    var categoryError = error && error.field === 'category_id';
    var goalError = error && error.field === 'goal_id';

    return html`
      <div class="quickadd">
        <div class="quickadd__row logrow">
          <${fields.TextField}
            className="fld--duration" label="How long"
            value=${draft.duration} placeholder="1.5 h" inputMode="text"
            spellcheck=${false} maxLength=${12} disabled=${disabled}
            invalid=${!!durationError} describedBy=${error ? 'quickadd-error' : null}
            inputRef=${durationRef}
            onInput=${function (v) { patch({ duration: v }); }}
            onKeyDown=${onKeyDown} />

          <${fields.TextField}
            className="fld--activity" label="What did you do?"
            value=${draft.activity} placeholder="What did you do?" disabled=${disabled}
            onInput=${function (v) { patch({ activity: v }); }}
            onKeyDown=${onKeyDown} />

          <${fields.CategorySelect} className="select--cat"
            categories=${props.state.categories} value=${draft.category_id}
            label="Category" disabled=${disabled} invalid=${!!categoryError}
            onChange=${chooseCategory}
            onKeyDown=${onKeyDown} />

          <${fields.GoalSelect} className="select--goal"
            goals=${props.state.goals} categories=${props.state.categories}
            value=${draft.goal_id}
            label="Counts toward" disabled=${disabled} invalid=${!!goalError}
            onChange=${chooseGoal}
            onKeyDown=${onKeyDown} />

          <button type="button" class="btn btn--brand quickadd__open"
            aria-label=${complete() ? 'Add this entry' : 'Open the full entry sheet'}
            onClick=${addOrOpen}>+</button>
        </div>

        ${error ? html`
          <p class="field__error quickadd__error" id="quickadd-error" role="alert">
            ${error.message}
          </p>` : null}

        ${disabled ? html`
          <p class="quickadd__note">
            No categories yet. Add one from Manage categories to start logging.
          </p>` : null}
      </div>`;
  }
  /* ---------- row menu ----------
     Spec §3 lists the `…` menu as visual only. It is edit and delete, and
     delete confirms inline in the sheets' own confirm language rather than
     through window.confirm (QUALITY-BAR §4).

     The panel is `position: fixed` and placed against the button by hand,
     rather than absolutely positioned inside the row. The table scrolls
     horizontally below the design width, and a box with `overflow-x: auto`
     ALWAYS clips vertically too — CSS resolves the other axis to `auto`, there
     is no `overflow-x: auto; overflow-y: visible`. So an absolutely positioned
     menu on the last row was cut off by the scroller and grew it a vertical
     scrollbar of its own, which then closed the menu when it was dragged.
     Fixed positioning is the only thing that escapes an ancestor's clip. */

  var MENU_GAP = 6;      // between the button and the panel
  var MENU_EDGE = 8;     // smallest gap the panel keeps from a viewport edge

  function RowMenu(props) {
    var openState = useState(false);
    var confirmState = useState(false);
    var posState = useState(null);
    var open = openState[0], setOpen = openState[1];
    var confirming = confirmState[0], setConfirming = confirmState[1];
    var pos = posState[0], setPos = posState[1];
    var rootRef = useRef(null);
    var btnRef = useRef(null);
    var panelRef = useRef(null);

    function close() {
      setOpen(false);
      setConfirming(false);
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
       the panel swaps to the delete confirm, which is a different height. */
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
                <p class="confirm__text">Delete this entry?</p>
                <div class="confirm__actions">
                  <button type="button" class="btn btn--warn"
                    onClick=${function () { close(); props.onDelete(); }}>Delete</button>
                  <button type="button" class="btn"
                    onClick=${function () { setConfirming(false); }}>Keep</button>
                </div>
              </div>`
            : html`
              <button type="button" class="rowmenu__item" role="menuitem"
                onClick=${function () { close(); props.onEdit(); }}>Edit</button>
              <button type="button" class="rowmenu__item rowmenu__item--warn" role="menuitem"
                onClick=${function () { setConfirming(true); }}>Delete</button>`}
          </div>` : null}
      </div>`;
  }

  /* ---------- entries table ---------- */

  function EntryRow(props) {
    var e = props.entry;
    /* Archived categories stay in the history (§8.11), so the lookup is over
       every category rather than the active ones. */
    var category = findById(props.state.categories, e.category_id);
    var goal = e.goal_id ? findById(props.state.goals, e.goal_id) : null;
    var name = e.activity || (category ? category.name : 'Entry');

    return html`
      <div class="logrow logrow--entry">
        <div class="t-figure">${aggregate.formatHours(e.duration_min)} h</div>
        <div class="logrow__activity">
          <button type="button" class="logrow__edit" aria-label=${'Edit ' + name}
            onClick=${function () { props.onEdit(e); }}>
            ${e.activity || html`<span class="logrow__noactivity">—</span>`}
          </button>
        </div>
        <div>
          ${category ? html`
            <span class=${'catchip' + (category.direction === 'less' ? ' catchip--less' : '')}
              >${category.name}</span>` : null}
        </div>
        <div class=${'logrow__goal' + (goal ? '' : ' logrow__goal--none')}>
          ${goal ? goal.short_name : html`<span aria-hidden="true">—</span>`}
          ${goal ? null : html`<span class="sr-only">No goal</span>`}
        </div>
        <${RowMenu} name=${name}
          onEdit=${function () { props.onEdit(e); }}
          onDelete=${function () { props.onDelete(e.id); }} />
      </div>`;
  }

  /* ---------- week bar strip (spec §4f) ---------- */

  function WeekStrip(props) {
    var minutes = aggregate.weekMinutes(props.state.entries, props.day);
    var monday = dates.weekStart(props.day);
    var total = minutes.reduce(function (n, m) { return n + m; }, 0);
    var weekHours = aggregate.HOURS_PER_WEEK;

    return html`
      <div class="weekstrip">
        <div class="weekstrip__bars">
          ${minutes.map(function (m, i) {
            var dayKey = dates.dayKey(dates.addDays(monday, i));
            var hours = aggregate.hours(m);
            /* Spec §4f leaves a day over the 18 h scale unhandled. It is
               clamped, and the number above it stays honest. */
            var pct = Math.min(100, hours / BAR_SCALE_HOURS * 100);
            var isToday = dayKey === props.day;
            return html`
              <div class="weekstrip__day" key=${dayKey}>
                <div class=${'weekstrip__num' + (isToday ? ' weekstrip__num--today' : '')}>
                  ${hours.toFixed(1)}
                </div>
                <div class="weekstrip__track">
                  <div class=${'weekstrip__bar' + (isToday ? ' weekstrip__bar--today' : '')}
                    style=${'height:' + pct.toFixed(1) + '%'} />
                </div>
                <div class="weekstrip__label">${dates.WEEKDAYS[i]}</div>
              </div>`;
          })}
        </div>
        <div class="weekstrip__stat">
          <div class="t-label">LOGGED THIS WEEK</div>
          <div class="weekstrip__total">
            ${aggregate.formatHours(total)}<span class="weekstrip__of">/${weekHours} h</span>
          </div>
          <p class="weekstrip__caption">Bars are hours per day, 18 h scale.</p>
        </div>
      </div>`;
  }

  /* ---------- the screen ---------- */

  function Log(props) {
    var state = props.state;
    var day = props.day;

    var entries = (state.entries || []).filter(function (e) { return e.date === day; });
    var coverage = aggregate.dayCoverage(state.entries || [], day);

    return html`
      <main class=${props.className} data-s="log">
        <${DayHead} day=${day} today=${props.today} coverage=${coverage}
          onDay=${props.onStepDay} onManage=${props.onManage} />

        <div class="logtable">
          <div class="logtable__scroll">
            <${QuickAdd} state=${state} day=${day} now=${props.now}
              draft=${props.draft} onDraft=${props.onDraft}
              onAdd=${props.onAddEntry} onOpenSheet=${props.onOpenEntrySheet} />

            <div class="logrow logtable__head t-label">
              <div>HOURS</div><div>ACTIVITY</div><div>CATEGORY</div>
              <div>COUNTS TOWARD</div><div></div>
            </div>

            ${entries.length ? html`
              <div class="logtable__rows">
                ${entries.map(function (e) {
                  return html`
                    <${EntryRow} key=${e.id} entry=${e} state=${state}
                      onEdit=${props.onEditEntry} onDelete=${props.onDeleteEntry} />`;
                })}
              </div>`
            : html`
              <p class="logtable__empty">Nothing logged on this day yet.</p>`}
          </div>
        </div>

        <${WeekStrip} state=${state} day=${day} />
      </main>`;
  }

  ui.EMPTY_ENTRY_DRAFT = { duration: '', activity: '', category_id: null, goal_id: null };
  ui.Log = Log;
})();
