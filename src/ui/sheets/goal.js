/* Meridian UI — the New goal sheet (deck-08-sheet-goal.png, spec §6).

   Also the edit sheet: BUILD-PLAN § Phase 4 asks for "edit goal (reuses
   sheet)", and a second dialog differing only in its title would be this file
   twice — the same arrangement the entry sheet already has.

   The sheet enforces nothing of its own. Rule §8.3 (only More categories carry
   goals), the target and the by-date are `src/core/validate.js`; every number
   in IS THAT REACHABLE is `src/core/projection.js`, the module the Goals table
   and the entry sheet's preview also read, so the three cannot disagree. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var useState = preactHooks.useState;
  var useEffect = preactHooks.useEffect;
  var useRef = preactHooks.useRef;

  var dates = window.Meridian.dates;
  var validate = window.Meridian.validate;
  var projection = window.Meridian.projection;
  var fields = ui.fields;

  function errorFor(errors, field) {
    for (var i = 0; i < errors.length; i++) if (errors[i].field === field) return errors[i].message;
    return null;
  }

  function hours(n) {
    return (Math.round(Number(n) * 10) / 10).toFixed(1);
  }

  function plural(n, word) {
    return n + ' ' + word + (n === 1 ? '' : 's');
  }

  /* "a Less category" / "an Upkeep category". */
  function article(direction) {
    return direction === 'upkeep' ? 'an Upkeep' : 'a Less';
  }

  /* ---------- IS THAT REACHABLE (spec §6) ----------

     With history, the mockup's two lines verbatim:

       "You've given Learning 7.0 h a week for 11 weeks. This needs 10.0 h."
       "At 7.0 h it lands 14 Oct. Meridian will keep both dates in view instead
        of just the one you typed."

     Without it, the honest version BUILD-PLAN asks for, which names the gap and
     then the rule that ends it. Either way the panel keeps its frame, so the
     sheet does not change height as the answer arrives. */

  function reachLines(r) {
    if (!r || !r.category) {
      return { wait: 'Pick what feeds it, the hours and the date.' };
    }

    var name = r.category.name;
    var needs = r.required === null ? null : hours(r.required);

    var lead = r.hasHistory
      ? 'You’ve given ' + name + ' ' + hours(r.pace) + ' h a week for ' +
        plural(r.paceBlocks, 'week') + '.'
      : 'Nothing logged to ' + name + ' yet.';

    var tail;
    if (r.done) {
      tail = 'Those hours are already banked.';
    } else if (!r.hasHistory) {
      tail = 'Meridian starts projecting once ' + name + ' has seven logged days.';
    } else if (r.landing) {
      tail = 'At ' + hours(r.pace) + ' h it lands ' + dates.formatDayMonth(r.landing) +
        '. Meridian will keep both dates in view instead of just the one you typed.';
    } else {
      tail = 'Nothing logged to ' + name + ' in the last ' + plural(r.paceBlocks, 'week') +
        ', so there is no pace to project from.';
    }

    return { lead: lead, needs: needs, tail: tail };
  }

  function Reachable(props) {
    var r = props.reach;
    var lines = reachLines(r);

    return html`
      <div class="reach">
        <div class="t-label reach__label">IS THAT REACHABLE</div>
        ${lines.wait
          ? html`<p class="reach__wait">${lines.wait}</p>`
          : html`
            <p class="reach__lead">
              ${lines.lead}
              ${lines.needs ? html`
                ${' '}This needs <span class="reach__needs">${lines.needs} h</span>.` : null}
            </p>
            <p class="reach__tail">${lines.tail}</p>`}
      </div>`;
  }

  /* ---------- the sheet ---------- */

  /* Categories that can carry a goal: More, not archived (rule §8.3) — plus
     whichever one the goal being edited already sits on, so an old goal can be
     saved without silently moving category. */
  function feeders(state, current) {
    return (state.categories || []).filter(function (c) {
      if (c.id === current) return true;
      return c.direction === 'more' && !c.archived;
    }).map(function (c) {
      return { id: c.id, label: c.name + (c.archived ? ' (archived)' : '') };
    });
  }

  function initialDraft(goal) {
    return {
      identity: goal && goal.identity ? goal.identity : '',
      short_name: goal ? goal.short_name : '',
      category_id: goal ? goal.category_id : null,
      target: goal ? String(goal.target_amount) : '',
      /* The typed date is held as text and parsed on every keystroke, so the
         panel answers while it is still being typed. */
      by: goal ? dates.formatLong(goal.by_date) : ''
    };
  }

  function GoalSheet(props) {
    var state = props.state;
    var editing = !!props.goal;

    var draftState = useState(function () { return initialDraft(props.goal); });
    var errorState = useState([]);
    var noteState = useState(null);
    var draft = draftState[0], setDraft = draftState[1];
    var errors = errorState[0], setErrors = errorState[1];
    var note = noteState[0], setNote = noteState[1];
    var selectRef = useRef(null);

    function patch(p) {
      setDraft(function (prev) { return Object.assign({}, prev, p); });
      if (errors.length) setErrors([]);
    }

    var today = dates.logicalDay(props.now);

    /* A bare `30 Sep` in this field can only mean the September ahead, so the
       year is resolved forwards (dates.parseUserDate `future`). */
    function typedDate() {
      var text = String(draft.by).trim();
      if (!text) return null;
      return dates.parseUserDate(text, { today: today, future: true });
    }

    var parsed = typedDate();

    function asInput() {
      var text = String(draft.by).trim();
      return {
        id: editing ? props.goal.id : null,
        short_name: String(draft.short_name).trim(),
        identity: String(draft.identity).trim() || null,
        category_id: draft.category_id,
        target_amount: String(draft.target).trim(),
        /* A date that will not parse is passed through as typed, so
           validate.js says "That is not a date" rather than "Pick a date". */
        by_date: parsed ? dates.dayKey(parsed) : text
      };
    }

    var reach = projection.reachability(state, asInput(), props.now);

    /* Business rule §8.2: a goal lives inside one category, and every hour
       banked to it was banked in that category. Moving the goal afterwards
       would leave those entries in a pairing validate.js refuses — invisible
       until one of them was next opened. So once there are hours, FED BY is
       fixed; before there are any, it is free. */
    var fedByFixed = editing && reach.banked > 0;

    /* ---------- adding a category without leaving the goal ----------
       The picker is a dead end otherwise: a category that does not exist yet
       cannot be chosen, and cancelling out to Manage loses everything typed
       here. `+ New category` stacks the New category sheet over this one — the
       stack keeps this sheet mounted, so the draft below survives untouched —
       and app.js hands the created category back through `pending`.

       Keyed on a token rather than the id, so a category adopted once is not
       re-adopted over a choice the owner then made by hand. */
    var feederList = feeders(state, editing ? props.goal.category_id : null);
    var noFeeders = feederList.length === 0;

    useEffect(function () {
      var handed = props.pending;
      if (!handed) return;
      var c = handed.category;
      if (c.direction === 'more') {
        setNote(null);
        patch({ category_id: c.id });
        /* Focus the picker, not the button that opened the sheet: its value
           just changed under the owner, and that is what they need to see. */
        if (selectRef.current) selectRef.current.focus();
      } else {
        /* Rule §8.3. The category is real work and is kept; it just cannot
           feed this goal, which is said here rather than at submit time. */
        setNote(c.name + ' is ' + article(c.direction) + ' category, so it ' +
          'cannot feed a goal. It is saved, and you can log to it.');
      }
    }, [props.pending && props.pending.token]);

    var fedByHint = fedByFixed
      ? 'A goal lives inside one category, and ' + hours(reach.banked) + ' h are logged to ' +
        (reach.category ? reach.category.name : 'it') + ' under this goal already.'
      : note ? note
      : noFeeders ? 'A goal is fed by one More category. Add one with + New category.'
      : null;

    function submit() {
      var input = asInput();
      var check = validate.validateGoal(input, state, { now: props.now });
      if (!check.ok) {
        setErrors(check.errors);
        return;
      }
      props.onSave({
        short_name: input.short_name,
        identity: input.identity,
        category_id: input.category_id,
        target_amount: Number(input.target_amount),
        by_date: input.by_date
      });
    }

    var footer = html`
      <p class="sheetfoot__note">Date changes take effect next week, not today.</p>
      <div class="sheetfoot__actions">
        <button type="button" class="btn" onClick=${props.onClose}>Cancel</button>
        <button type="submit" class="btn btn--brand">
          ${editing ? 'Save changes' : 'Create goal'}
        </button>
      </div>`;

    return html`
      <${ui.Sheet} title=${editing ? 'EDIT GOAL' : 'NEW GOAL'}
        onClose=${props.onClose} onSubmit=${submit}
        footer=${footer} footClass="sheet__foot--split">

        <div class="goalgrid">
          <${fields.Field} label="SHORT NAME" id="goal-name"
            error=${errorFor(errors, 'short_name')}>
            <${fields.TextField} className="fld--goalname" labelledBy="goal-name-label"
              value=${draft.short_name} placeholder="Learn Python" autofocus
              invalid=${!!errorFor(errors, 'short_name')}
              onInput=${function (v) { patch({ short_name: v }); }} />
          <//>

          <${fields.Field} label="FED BY" id="goal-fedby"
            note=${fedByFixed ? 'FIXED BY ITS HOURS' : null}
            error=${errorFor(errors, 'category_id')}
            hint=${fedByHint}>
            <${fields.Select} className="select--sheet"
              labelledBy="goal-fedby-label"
              placeholder=${noFeeders ? 'No More categories yet' : 'Category'}
              options=${feederList} inputRef=${selectRef}
              value=${draft.category_id} disabled=${fedByFixed}
              invalid=${!!errorFor(errors, 'category_id')}
              onChange=${function (v) { setNote(null); patch({ category_id: v }); }} />
            ${fedByFixed ? null : html`
              <button type="button" class="actbtn actbtn--brand fedby__add"
                onClick=${props.onNewCategory}>+ New category</button>`}
          <//>
        </div>

        <div class="goalgrid">
          <${fields.Field} label="HOURS NEEDED" id="goal-hours"
            error=${errorFor(errors, 'target_amount')}>
            <${fields.TextField} className="fld--goalnum" labelledBy="goal-hours-label"
              value=${draft.target} placeholder="130" inputMode="decimal"
              spellcheck=${false} maxLength=${6}
              invalid=${!!errorFor(errors, 'target_amount')}
              onInput=${function (v) { patch({ target: v }); }} />
          <//>

          <${fields.Field} label="BY" id="goal-by" error=${errorFor(errors, 'by_date')}>
            <${fields.TextField} className="fld--goalnum" labelledBy="goal-by-label"
              value=${draft.by} placeholder="30 Sep 2026"
              spellcheck=${false} maxLength=${20}
              invalid=${!!errorFor(errors, 'by_date')}
              onInput=${function (v) { patch({ by: v }); }} />
          <//>
        </div>

        <${fields.Field} label="WHY IT MATTERS — OPTIONAL" id="goal-identity"
          hint="Shows under the name on the Goals screen. Leave it empty if nothing fits.">
          <${fields.TextField} className="fld--identity" labelledBy="goal-identity-label"
            value=${draft.identity}
            placeholder="Building my own tools, not just using them"
            onInput=${function (v) { patch({ identity: v }); }} />
        <//>

        <${Reachable} reach=${reach} />
      <//>`;
  }

  ui.GoalSheet = GoalSheet;
})();
