/* Meridian UI — the Manage categories sheet (deck-10-sheet-manage.png, spec §6).

   Business rules §8.10 and §8.11 in one screen: archive keeps every hour and
   every historical range, delete only clears a category nobody has lived, and an
   archived category leaves the pickers but never the history.

   The denominator is the mockup's own 168 h: decision 17, as amended, has no
   sleep setting, so a week is the 168 hours a week has and sleep is an ordinary
   category for anyone who wants to log it. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var useState = preactHooks.useState;
  var useEffect = preactHooks.useEffect;
  var useRef = preactHooks.useRef;

  var dates = window.Meridian.dates;
  var aggregate = window.Meridian.aggregate;
  var validate = window.Meridian.validate;
  var fields = ui.fields;

  var DIRECTION_LABEL = {
    more: { text: 'MORE', mark: 'up', tone: 'good' },
    less: { text: 'LESS', mark: 'down', tone: 'warn' },
    upkeep: { text: 'UPKEEP', mark: null, tone: 'dim' }
  };

  function errorFor(errors, field) {
    for (var i = 0; i < errors.length; i++) if (errors[i].field === field) return errors[i].message;
    return null;
  }

  function DirectionTag(props) {
    var d = DIRECTION_LABEL[props.direction] || DIRECTION_LABEL.upkeep;
    return html`
      <span class=${'dirtag dirtag--' + d.tone}>
        ${d.mark ? html`<${ui.Glyph} name=${d.mark} size=${9} />` : null}${' '}${d.text}
      </span>`;
  }

  /* ---------- the row editor ----------
     BUILD-PLAN § Phase 2: "edit (rename in place, colour, direction, planned
     hours)". The name is edited where it sits; the other three open on a strip
     underneath, so the row keeps its columns and the sheet keeps one level. */
  function RowEditor(props) {
    return html`
      <div class="manage__editor">
        <${fields.Field} label="COLOUR" id=${'edit-colour-' + props.id}>
          <${fields.Swatches} labelledBy=${'edit-colour-' + props.id + '-label'}
            theme=${props.theme} value=${props.draft.colour}
            onChange=${function (v) { props.onPatch({ colour: v }); }} />
        <//>

        <${fields.Field} label="DIRECTION" id=${'edit-dir-' + props.id}
          error=${errorFor(props.errors, 'direction')}>
          <${fields.DirectionCards} labelledBy=${'edit-dir-' + props.id + '-label'}
            value=${props.draft.direction}
            onChange=${function (v) { props.onPatch({ direction: v }); }} />
        <//>

        <${fields.Field} label="PLANNED HOURS A WEEK" id=${'edit-plan-' + props.id}
          error=${errorFor(props.errors, 'weekly_plan_hours')}>
          <${fields.TextField} className="fld--plan"
            labelledBy=${'edit-plan-' + props.id + '-label'}
            value=${props.draft.weekly_plan_hours} placeholder="0"
            spellcheck=${false} maxLength=${5} inputMode="decimal"
            invalid=${!!errorFor(props.errors, 'weekly_plan_hours')}
            onInput=${function (v) { props.onPatch({ weekly_plan_hours: v }); }} />
        <//>

        <div class="manage__editoractions">
          <button type="button" class="btn" onClick=${props.onCancel}>Cancel</button>
          <button type="submit" class="btn btn--brand">Save</button>
        </div>
      </div>`;
  }

  /* ---------- one row ---------- */

  function Row(props) {
    var c = props.category;
    var editing = props.editing;
    var nameRef = useRef(null);

    /* `data-autofocus` is the sheet frame's contract, and it only runs when the
       sheet itself mounts. This editor opens inside a sheet that is already
       standing, so the row does its own focusing — otherwise "rename in place"
       would still need a click on the field it just opened. */
    useEffect(function () {
      if (editing && nameRef.current) nameRef.current.focus();
    }, [editing]);
    var weekHours = aggregate.hours(props.weekMinutes);
    /* Decision 26: the cap is the planned hours, read here (decision 13). */
    var overCap = aggregate.overCapHours(c, props.weekMinutes);
    var share = props.weekDenominator > 0
      ? Math.min(100, weekHours / props.weekDenominator * 100) : 0;
    var swatchColour = editing ? props.draft.colour : (c.colour || null);
    var nameError = editing ? errorFor(props.errors, 'name') : null;

    /* Three different rows, and the difference is what the category IS, not how
       it is styled: archived, never used, or in play. */
    var archived = !!c.archived;
    /* "Never used" has to mean never used by anything. A category with no hours
       but a goal fed by it is not safe to delete: the goal would be left naming
       an id that no longer exists (validate.canDeleteCategory). */
    var fedGoals = props.fedGoals || [];
    var untouched = !archived && props.totalMinutes === 0 && fedGoals.length === 0;
    var feeds = !archived && props.totalMinutes === 0 && fedGoals.length > 0;

    /* Every row is a <form>, so Enter saves from the name field as well as from
       the editor strip below it — "rename in place" puts the name in the row and
       the other three fields under it, and both have to be inside the same form.
       A row that is not being edited has no submit button and no fields, so its
       form is inert. The Manage sheet itself passes no `onSubmit` (its footer
       button is Done, which closes), so there is no outer form to nest inside. */
    return html`
      <form class=${'manage__rowwrap' + (editing ? ' manage__rowwrap--editing' : '')}
        onSubmit=${function (e) { e.preventDefault(); if (editing) props.onSave(); }}>
        <div class=${'managerow' + (archived ? ' managerow--archived' : '')}>
          <div class="managerow__name">
            ${swatchColour ? html`
              <${fields.Swatch} className="swatch--row" hex=${swatchColour} theme=${props.theme} />`
              : html`<span class="swatch swatch--row swatch--none" />`}
            ${editing ? html`
              <${fields.TextField} className="fld--name fld--rowname"
                label="Category name" value=${props.draft.name}
                invalid=${!!nameError} inputRef=${nameRef}
                onInput=${function (v) { props.onPatch({ name: v }); }} />`
            : archived
              ? html`<span class="managerow__label">${c.name}</span>`
              : html`
                <button type="button" class="managerow__label managerow__label--edit"
                  onClick=${function () { props.onEdit(c); }}
                >${c.name}</button>`}
          </div>

          <div>
            ${archived
              ? html`<span class="dirtag dirtag--dim">ARCHIVED</span>`
              : html`<${DirectionTag} direction=${editing ? props.draft.direction : c.direction} />`}
          </div>

          ${archived ? html`
            <div class="managerow__kept">
              ${aggregate.formatHours(props.totalMinutes)} h kept<br />
              to ${dates.formatDayMonth(c.archived_on) || 'today'}
            </div>`
          : html`
            <div class=${'managerow__hours' + (c.direction === 'less' ? ' managerow__hours--warn' : '') +
                (untouched ? ' managerow__hours--dim' : '')}>
              ${weekHours.toFixed(1)} h
              ${overCap > 0 ? html`
                <span class="managerow__over">${overCap.toFixed(1)} h over cap</span>` : null}
            </div>`}

          ${archived ? html`
            <p class="managerow__note">Out of the plan, still in the history</p>`
          : untouched ? html`
            <p class="managerow__note">Never used — safe to delete</p>`
          : feeds ? html`
            <p class="managerow__note">
              No hours yet, and ${fedGoals.length === 1 ? fedGoals[0] + ' is' : fedGoals.length + ' goals are'} fed by it
            </p>`
          : html`
            <div class="sharebar">
              <div class="sharebar__fill"
                style=${'width:' + share.toFixed(1) + '%;background:' + (c.colour || 'var(--axis)')} />
            </div>`}

          <div class="managerow__actions">
            ${editing ? null
            : archived ? html`
              <button type="button" class="actbtn actbtn--brand"
                onClick=${function () { props.onRestore(c.id); }}>restore</button>`
            : untouched ? html`
              <span class="managerow__acts">
                <button type="button" class="actbtn"
                  onClick=${function () { props.onEdit(c); }}>edit</button>
                <span class="managerow__dot" aria-hidden="true">·</span>
                <button type="button" class="actbtn actbtn--warn"
                  onClick=${function () { props.onConfirm({ kind: 'delete', id: c.id }); }}
                >delete</button>
              </span>`
            : html`
              <span class="managerow__acts">
                <button type="button" class="actbtn"
                  onClick=${function () { props.onEdit(c); }}>edit</button>
                <span class="managerow__dot" aria-hidden="true">·</span>
                <button type="button" class="actbtn"
                  onClick=${function () { props.onConfirm({ kind: 'archive', id: c.id }); }}
                >archive</button>
              </span>`}
          </div>
        </div>

        ${nameError ? html`
          <p class="field__error manage__rowerror" role="alert">${nameError}</p>` : null}

        ${editing ? html`
          <${RowEditor} id=${c.id} theme=${props.theme} draft=${props.draft}
            errors=${props.errors} onPatch=${props.onPatch}
            onCancel=${props.onCancelEdit} />` : null}

        ${props.confirm ? html`
          <div class="confirm confirm--row">
            <p class="confirm__text">${props.confirm.text}</p>
            <div class="confirm__actions">
              <button type="button" class="btn btn--warn" onClick=${props.confirm.onYes}>
                ${props.confirm.yes}
              </button>
              <button type="button" class="btn" onClick=${props.confirm.onNo}>Keep it</button>
            </div>
          </div>` : null}
      </form>`;
  }

  /* ---------- the sheet ---------- */

  function ManageSheet(props) {
    var state = props.state;
    var editState = useState(null);          // { id, draft }
    var errorState = useState([]);
    var confirmState = useState(null);       // { kind, id }
    var edit = editState[0], setEdit = editState[1];
    var errors = errorState[0], setErrors = errorState[1];
    var confirm = confirmState[0], setConfirm = confirmState[1];

    var settings = state.settings;
    var weekDenominator = aggregate.HOURS_PER_WEEK;
    var today = dates.dayKey(dates.logicalDay(props.now));
    var monday = dates.weekStart(today);
    var weekEntries = aggregate.inRange(state.entries || [],
      dates.dayKey(monday), dates.dayKey(dates.weekEnd(today)));

    /* This week and all time, per category: the first is the row's bar, the
       second is what "38 h kept" counts and what makes delete legal. */
    var week = Object.create(null);
    weekEntries.forEach(function (e) {
      week[e.category_id] = (week[e.category_id] || 0) + (Number(e.duration_min) || 0);
    });
    var total = Object.create(null);
    (state.entries || []).forEach(function (e) {
      total[e.category_id] = (total[e.category_id] || 0) + (Number(e.duration_min) || 0);
    });
    var weekTotal = aggregate.sumMinutes(weekEntries);

    /* Canonical order is (sort, id); archived rows fall to the end, as they do
       in the mockup, so the list you can act on stays together. */
    var rows = (state.categories || []).slice().sort(function (a, b) {
      if (!!a.archived !== !!b.archived) return a.archived ? 1 : -1;
      return 0;
    });

    function startEdit(c) {
      setConfirm(null);
      setErrors([]);
      setEdit({
        id: c.id,
        draft: {
          name: c.name,
          colour: c.colour || fields.SWATCHES[0],
          direction: c.direction,
          weekly_plan_hours: String(c.weekly_plan_hours === null ||
            c.weekly_plan_hours === undefined ? '' : c.weekly_plan_hours)
        }
      });
    }

    function patchEdit(p) {
      setEdit(function (prev) {
        return prev ? { id: prev.id, draft: Object.assign({}, prev.draft, p) } : prev;
      });
      if (errors.length) setErrors([]);
    }

    function saveEdit() {
      if (!edit) return;
      var draft = edit.draft;
      var planText = String(draft.weekly_plan_hours).trim();
      var input = {
        name: draft.name,
        colour: draft.colour,
        direction: draft.direction,
        weekly_plan_hours: planText === '' ? 0 : Number(planText)
      };
      if (planText !== '' && !isFinite(input.weekly_plan_hours)) {
        setErrors([{ field: 'weekly_plan_hours', message: 'Use a number of hours.' }]);
        return;
      }
      var check = validate.validateCategory(input, state, { excludeId: edit.id });
      if (!check.ok) {
        setErrors(check.errors);
        return;
      }
      props.onUpdate(edit.id, input);
      setEdit(null);
      setErrors([]);
    }

    function confirmFor(c) {
      if (!confirm || confirm.id !== c.id) return null;
      if (confirm.kind === 'archive') {
        return {
          text: 'Archiving keeps the ' + aggregate.formatHours(total[c.id] || 0) +
            ' h. It leaves the pickers, not the history.',
          yes: 'Archive',
          onYes: function () { setConfirm(null); props.onArchive(c.id); },
          onNo: function () { setConfirm(null); }
        };
      }
      return {
        text: 'Delete ' + c.name + '? Nothing has ever been logged to it.',
        yes: 'Delete',
        onYes: function () { setConfirm(null); props.onDelete(c.id); },
        onNo: function () { setConfirm(null); }
      };
    }

    var footer = html`
      <div class="manage__foot">
        <p class="manage__footnote">
          Delete only clears categories with no hours. Anything you’ve lived gets
          archived, so past weeks keep adding up to ${weekDenominator}.
        </p>
        <button type="button" class="btn btn--brand" onClick=${props.onClose}>Done</button>
      </div>`;

    var tools = html`
      <button type="button" class="btn btn--brand btn--small" onClick=${props.onNew}>+ New</button>`;

    return html`
      <${ui.Sheet} wide bodyClass="manage" footClass="sheet__foot--strip"
        title=${'CATEGORIES — ' + aggregate.formatHours(weekTotal) + ' H THIS WEEK'}
        tools=${tools} footer=${footer} onClose=${props.onClose}>

        <div class="managerow manage__head t-label">
          <div>CATEGORY</div>
          <div>DIRECTION</div>
          <div class="manage__right">THIS WEEK</div>
          <div>SHARE OF ${weekDenominator} H</div>
          <div class="manage__right">ACTIONS</div>
        </div>

        ${rows.length ? rows.map(function (c) {
          return html`
            <${Row} key=${c.id} category=${c} theme=${props.theme}
              weekMinutes=${week[c.id] || 0} totalMinutes=${total[c.id] || 0}
              fedGoals=${validate.canDeleteCategory(state, c.id).goals}
              weekDenominator=${weekDenominator}
              editing=${!!edit && edit.id === c.id}
              draft=${edit && edit.id === c.id ? edit.draft : null}
              errors=${edit && edit.id === c.id ? errors : []}
              confirm=${confirmFor(c)}
              onEdit=${startEdit} onPatch=${patchEdit} onSave=${saveEdit}
              onCancelEdit=${function () { setEdit(null); setErrors([]); }}
              onConfirm=${function (c2) { setEdit(null); setConfirm(c2); }}
              onRestore=${props.onRestore} onDelete=${props.onDelete} />`;
        }) : html`
          <p class="manage__empty">
            No categories yet. Add one with + New, or import a workbook.
          </p>`}
      <//>`;
  }

  ui.ManageSheet = ManageSheet;
})();
