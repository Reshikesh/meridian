/* Meridian UI — the Log screen.

   The day's entries, the quick-add row, the row menu and the week bar strip.
   Layout, type and copy are the mockup's (spec §6, deck-01-log.png), with the
   three changes the decisions require: no VALUE column and no value dots
   (decision 10), waking-hours denominators rather than 24 h and 168 h
   (decision 17), and a real quick-add row that commits on Enter (decision 19).

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
     Decision 19: the inline row commits on Enter with duration, activity and
     category; `+` opens the full sheet for a goal-linked or "Other" duration,
     carrying whatever is already typed so the two paths are one flow. */

  var EMPTY_DRAFT = { duration: '', activity: '', category_id: null };

  function QuickAdd(props) {
    var draftState = useState(EMPTY_DRAFT);
    var errorState = useState(null);
    var draft = draftState[0], setDraft = draftState[1];
    var error = errorState[0], setError = errorState[1];
    var durationRef = useRef(null);

    var categories = aggregate.activeCategories(props.state.categories);
    var disabled = categories.length === 0;

    function patch(p) {
      setDraft(function (prev) { return Object.assign({}, prev, p); });
      if (error) setError(null);
    }

    function commit() {
      var text = String(draft.duration).trim();
      var minutes = text === '' ? null : aggregate.parseDuration(text);

      /* A blank field and an unreadable one are different mistakes, and the
         second one deserves to be told what a readable value looks like. */
      if (text !== '' && minutes === null) {
        setError({ field: 'duration', message: 'Use a time like 1.5, 1.5h or 90m.' });
        return;
      }

      var input = {
        date: props.day,
        duration_min: minutes,
        activity: String(draft.activity).trim() || null,
        category_id: draft.category_id,
        goal_id: null
      };

      var check = validate.validateEntry(input, props.state, { now: props.now });
      if (!check.ok) {
        setError({ field: check.errors[0].field, message: check.errors[0].message });
        return;
      }

      props.onAdd(input);
      setDraft(EMPTY_DRAFT);
      setError(null);
      /* QUALITY-BAR §4: the row clears and the duration field regains focus, so
         consecutive entries take no mouse. */
      if (durationRef.current) durationRef.current.focus();
    }

    /* Enter commits from any field in the row. */
    function onKeyDown(event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      commit();
    }

    var durationError = error && (error.field === 'duration' || error.field === 'duration_min');
    var categoryError = error && error.field === 'category_id';

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

          <${fields.CategorySelect}
            categories=${props.state.categories} value=${draft.category_id}
            label="Category" disabled=${disabled} invalid=${!!categoryError}
            onChange=${function (v) { patch({ category_id: v }); }}
            onKeyDown=${onKeyDown} />

          <button type="button" class="btn btn--brand quickadd__open"
            aria-label="New entry, with a goal or another duration"
            onClick=${function () { props.onOpenSheet(draft); }}>+</button>

          <div></div>
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
     through window.confirm (QUALITY-BAR §4). */

  function RowMenu(props) {
    var openState = useState(false);
    var confirmState = useState(false);
    var open = openState[0], setOpen = openState[1];
    var confirming = confirmState[0], setConfirming = confirmState[1];
    var rootRef = useRef(null);

    function close() {
      setOpen(false);
      setConfirming(false);
    }

    useEffect(function () {
      if (!open) return undefined;

      function onDocKey(event) {
        if (event.key !== 'Escape') return;
        /* Stop the key here so a menu open inside a sheet closes the menu and
           leaves the sheet standing. */
        event.stopPropagation();
        close();
        var button = rootRef.current && rootRef.current.querySelector('[data-menu-btn]');
        if (button) button.focus();
      }

      function onDocPointer(event) {
        if (rootRef.current && !rootRef.current.contains(event.target)) close();
      }

      document.addEventListener('keydown', onDocKey, true);
      document.addEventListener('pointerdown', onDocPointer, true);
      return function () {
        document.removeEventListener('keydown', onDocKey, true);
        document.removeEventListener('pointerdown', onDocPointer, true);
      };
    }, [open]);

    return html`
      <div class="rowmenu" ref=${rootRef}>
        <button type="button" class="rowmenu__btn" data-menu-btn
          aria-haspopup="menu" aria-expanded=${open ? 'true' : 'false'}
          aria-label=${'Actions for ' + props.name}
          onClick=${function () { open ? close() : setOpen(true); }}>…</button>

        ${open ? html`
          <div class="rowmenu__panel" role=${confirming ? 'group' : 'menu'}>
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
    var weekHours = aggregate.wakingHoursPerWeek(props.state.settings);

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
    var coverage = aggregate.dayCoverage(state.entries || [], day, state.settings);

    return html`
      <main class=${props.className} data-s="log">
        <${DayHead} day=${day} today=${props.today} coverage=${coverage}
          onDay=${props.onStepDay} onManage=${props.onManage} />

        <div class="logtable">
          <div class="logtable__scroll">
            <${QuickAdd} state=${state} day=${day} now=${props.now}
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

  ui.Log = Log;
})();
