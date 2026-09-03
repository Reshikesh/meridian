/* Meridian UI — the New entry sheet (deck-07-sheet-entry.png, spec §6).

   Also the edit sheet: the mockup has no edit affordance at all (spec §10 lists
   "editing and deleting entries" as a gap), and a second dialog that differed
   only in its title would be the same file twice.

   The one rule this sheet enforces in its own right is business rule §8.2 — a
   goal lives inside one category, so picking a goal fills and locks that
   category. Everything else it asks `src/core/validate.js`. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var useState = preactHooks.useState;

  var dates = window.Meridian.dates;
  var aggregate = window.Meridian.aggregate;
  var validate = window.Meridian.validate;
  var projection = window.Meridian.projection;
  var fields = ui.fields;

  /* HOW LONG, verbatim (spec §6). "Other" is the numeric input spec §10 lists
     as missing. */
  var PRESETS = [
    { id: '30', label: '30 m', minutes: 30 },
    { id: '60', label: '1 h', minutes: 60 },
    { id: '120', label: '2 h', minutes: 120 },
    { id: '180', label: '3 h', minutes: 180 }
  ];

  var OTHER = 'other';
  var NO_GOAL = '';

  function findById(list, id) {
    for (var i = 0; i < (list || []).length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  function errorFor(errors, field) {
    for (var i = 0; i < errors.length; i++) if (errors[i].field === field) return errors[i].message;
    return null;
  }

  function presetFor(minutes) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].minutes === minutes) return PRESETS[i].id;
    return null;
  }

  /* The sheet opens on whatever the quick-add row already holds, so pressing
     `+` mid-typing is a continuation rather than a restart (decision 19). */
  function initialDraft(props) {
    var entry = props.entry;
    var prefill = props.prefill || {};

    var minutes = null;
    var otherText = '';
    if (entry) {
      minutes = entry.duration_min;
    } else if (String(prefill.duration || '').trim()) {
      minutes = aggregate.parseDuration(prefill.duration);
      if (minutes === null) otherText = String(prefill.duration).trim();
    }

    var preset = minutes === null ? null : presetFor(minutes);
    if (!preset && minutes !== null) {
      preset = OTHER;
      otherText = aggregate.formatHours(minutes) + ' h';
    }
    if (!preset && otherText) preset = OTHER;

    var goalId = entry ? (entry.goal_id || null) : (prefill.goal_id || null);
    var categoryId = entry ? entry.category_id : (prefill.category_id || null);

    return {
      preset: preset,
      other: otherText,
      activity: entry ? (entry.activity || '') : (prefill.activity || ''),
      goal_id: goalId,
      category_id: categoryId,
      /* A goal fills and locks its category; `Change` unlocks it. */
      locked: !!goalId
    };
  }

  /* Where the cursor goes when the sheet opens: the first thing the quick-add
     row has NOT already decided, in the sheet's own order. Computed once, from
     the opening draft, so it cannot move under the owner as they type.

     Editing is the exception and starts at the top: nothing was handed over,
     the entry was already whole, and whatever is being changed is as likely to
     be the duration as anything else.

     The `save` fallback — everything decided and the category locked by a goal —
     is what the owner asked for at the checkpoint, because the only focusable
     thing in a locked category block is `Change`, and landing on that reads as
     an instruction to change something that is already right. In practice `+`
     now adds a complete row outright instead of opening the sheet, so it is a
     fallback rather than a path. */
  function initialFocus(draft, goalCount, editing) {
    if (editing) return 'duration';
    if (draft.preset === null) return 'duration';
    if (!String(draft.activity).trim()) return 'activity';
    if (goalCount > 0 && !draft.goal_id) return 'goal';
    if (!draft.locked) return 'category';
    return 'save';
  }

  function draftMinutes(draft) {
    if (draft.preset === OTHER) {
      return String(draft.other).trim() === '' ? null : aggregate.parseDuration(draft.other);
    }
    for (var i = 0; i < PRESETS.length; i++) {
      if (PRESETS[i].id === draft.preset) return PRESETS[i].minutes;
    }
    return null;
  }

  /* ---------- SAVING THIS MOVES (spec §6) ---------- */

  function Preview(props) {
    var before = props.before;
    var after = props.after;
    if (!before || !after) return null;

    var line;
    if (!after.enoughHistory) {
      /* BUILD-PLAN § Phase 2: "or 'no projection yet' when history is short".
         Decision 27: the estimate arrives with the second logged day, so the
         entry being previewed is the first. */
      line = html`<span class="preview__flat">No landing date yet — it arrives with the second logged day.</span>`;
    } else if (after.done) {
      line = html`<span class="preview__flat">Target reached.</span>`;
    } else if (!before.landing && after.landing) {
      line = html`<span class="preview__to">Lands ${dates.formatDayMonth(after.landing)}</span>`;
    } else if (before.landing && after.landing) {
      var earlier = after.landing < before.landing;
      line = html`
        <span class="preview__from">Lands ${dates.formatDayMonth(before.landing)}</span>
        <span class="preview__arrow" aria-hidden="true"><${ui.Glyph} name="arrow" /></span>
        <span class=${'preview__to' + (earlier ? ' preview__to--good' : '')}>
          ${dates.formatDayMonth(after.landing)}
        </span>`;
    } else {
      line = html`<span class="preview__flat">No landing date yet.</span>`;
    }

    return html`
      <div class="preview">
        <div class="t-label preview__label">SAVING THIS MOVES</div>
        <div class="preview__row preview__row--hours">
          <span class="preview__from">${props.goalName} ${before.banked.toFixed(1)}</span>
          <span class="preview__arrow" aria-hidden="true"><${ui.Glyph} name="arrow" /></span>
          <span class="preview__to">${after.banked.toFixed(1)} h</span>
        </div>
        <div class="preview__row preview__row--lands">${line}</div>
        ${after.landing && projection.earlyLabel(after) ? html`
          <div class="preview__early">${projection.earlyLabel(after)}</div>` : null}
      </div>`;
  }

  /* ---------- the sheet ---------- */

  function EntrySheet(props) {
    var state = props.state;
    var editing = !!props.entry;

    var draftState = useState(function () { return initialDraft(props); });
    var errorState = useState([]);
    var draft = draftState[0], setDraft = draftState[1];
    var errors = errorState[0], setErrors = errorState[1];

    var focusState = useState(function () {
      var opening = initialDraft(props);
      var count = (state.goals || []).filter(function (g) {
        if (g.archived) return false;
        var cat = findById(state.categories, g.category_id);
        return !!cat && !cat.archived;
      }).length;
      return initialFocus(opening, count, editing);
    });
    var focusField = focusState[0];

    function patch(p) {
      setDraft(function (prev) { return Object.assign({}, prev, p); });
      if (errors.length) setErrors([]);
    }

    /* Goals that can still take hours: not archived, and fed by a category that
       is not archived either. The one already on the entry being edited stays
       whatever its state, so an old row can be saved unchanged. */
    var goals = (state.goals || []).filter(function (g) {
      if (g.id === draft.goal_id) return true;
      if (g.archived) return false;
      var cat = findById(state.categories, g.category_id);
      return !!cat && !cat.archived;
    });

    var goal = draft.goal_id ? findById(state.goals, draft.goal_id) : null;
    var category = draft.category_id ? findById(state.categories, draft.category_id) : null;
    var minutes = draftMinutes(draft);

    function chooseGoal(id) {
      if (id === NO_GOAL) {
        patch({ goal_id: null, locked: false });
        return;
      }
      var picked = findById(state.goals, id);
      /* Business rule §8.2: "picking it fills the category below". */
      patch({ goal_id: id, category_id: picked ? picked.category_id : draft.category_id, locked: true });
    }

    function chooseCategory(id) {
      /* Unlocked and moved off the goal's own category: the pairing cannot
         survive, so the goal goes back to "Nothing yet" rather than being saved
         into a mismatch validate.js would refuse anyway. */
      var stillMatches = goal && goal.category_id === id;
      patch({ category_id: id, goal_id: stillMatches ? draft.goal_id : null, locked: false });
    }

    function save() {
      var input = {
        date: props.day,
        duration_min: minutes,
        activity: String(draft.activity).trim() || null,
        category_id: draft.category_id,
        goal_id: draft.goal_id || null
      };

      /* A duration typed into "Other" that nobody can read is its own message;
         validate.js only knows that it arrived as null. */
      if (draft.preset === OTHER && String(draft.other).trim() !== '' && minutes === null) {
        setErrors([{ field: 'duration_min', message: 'Use a time like 1.5, 1.5h or 90m.' }]);
        return;
      }

      var check = validate.validateEntry(input, state, {
        now: props.now,
        excludeId: editing ? props.entry.id : null
      });
      if (!check.ok) {
        setErrors(check.errors);
        return;
      }
      props.onSave(input);
    }

    /* The preview compares the goal as it stands against the goal with this
       entry on it. In edit mode "as it stands" has to exclude the row being
       edited, or raising 2 h to 2.5 h would read as if both existed. */
    var preview = null;
    if (goal && minutes !== null && minutes > 0) {
      var base = editing
        ? Object.assign({}, state, {
          entries: (state.entries || []).filter(function (e) { return e.id !== props.entry.id; })
        })
        : state;
      preview = {
        before: projection.project(base, goal.id, props.now),
        after: projection.projectWithDelta(base, goal.id, minutes, props.now, { date: props.day })
      };
    }

    var footer = html`
      <button type="button" class="btn" onClick=${props.onClose}>Cancel</button>
      <button type="submit" class="btn btn--brand"
        data-autofocus=${focusField === 'save' ? '' : null}>Save entry</button>`;

    var title = (editing ? 'EDIT ENTRY — ' : 'NEW ENTRY — ') + dates.formatDayShort(props.day);

    return html`
      <${ui.Sheet} title=${title} onClose=${props.onClose} footer=${footer} onSubmit=${save}>

        <${fields.Field} label="HOW LONG" id="entry-len"
          error=${errorFor(errors, 'duration_min')}>
          <${fields.Segmented} labelledBy="entry-len-label"
            autofocus=${focusField === 'duration'}
            value=${draft.preset}
            options=${PRESETS.concat([{ id: OTHER, label: 'Other' }])}
            onChange=${function (id) { patch({ preset: id }); }} />
          ${draft.preset === OTHER ? html`
            <div class="field__other">
              <${fields.TextField} className="fld--duration"
                label="How long, in your own words" value=${draft.other}
                placeholder="1.5 h" spellcheck=${false} maxLength=${12}
                invalid=${!!errorFor(errors, 'duration_min')}
                onInput=${function (v) { patch({ other: v }); }} />
            </div>` : null}
        <//>

        <${fields.Field} label="ACTIVITY — OPTIONAL" id="entry-activity">
          <${fields.TextField} className="fld--sheet" labelledBy="entry-activity-label"
            value=${draft.activity} placeholder="Async chapter + exercises"
            autofocus=${focusField === 'activity'}
            onInput=${function (v) { patch({ activity: v }); }} />
        <//>

        ${goals.length ? html`
          <${fields.Field} label="COUNTS TOWARD" id="entry-goal"
            error=${errorFor(errors, 'goal_id')}
            hint="A goal lives inside one category, so picking it fills the category below. Two hours of Postgres would never touch Python.">
            <${fields.Segmented} labelledBy="entry-goal-label"
              autofocus=${focusField === 'goal'}
              value=${draft.goal_id || NO_GOAL}
              options=${goals.map(function (g) { return { id: g.id, label: g.short_name }; })
                .concat([{ id: NO_GOAL, label: 'Nothing yet' }])}
              onChange=${chooseGoal} />
          <//>` : null}

        <${fields.Field} label="CATEGORY" id="entry-category"
          note=${draft.locked ? 'FILLED FROM THE GOAL' : null}
          error=${errorFor(errors, 'category_id')}>
          ${draft.locked && category ? html`
            <div class="lockrow">
              <span class="lockrow__chip">
                ${category.name}<span class="lockrow__word">locked</span>
              </span>
              <button type="button" class="btn btn--change"
                onClick=${function () { patch({ locked: false }); }}>Change</button>
            </div>`
          : html`
            <${fields.CategorySelect} className="select--sheet"
              categories=${state.categories} value=${draft.category_id}
              labelledBy="entry-category-label"
              autofocus=${focusField === 'category'}
              invalid=${!!errorFor(errors, 'category_id')}
              onChange=${chooseCategory} />`}
        <//>

        ${preview ? html`
          <${Preview} goalName=${goal.short_name}
            before=${preview.before} after=${preview.after} />` : null}
      <//>`;
  }

  ui.EntrySheet = EntrySheet;
})();
