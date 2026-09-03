/* Meridian UI — the New category sheet (deck-09-sheet-category.png, spec §6).

   Decision 21 drops the mockup's COUNTS TOWARD block: a category feeds many
   goals, and the only link is `Goals.category_id`. What is left is the sheet's
   own list — NAME, COLOUR, DIRECTION and the upkeep note — verbatim.

   It stacks over the Manage sheet at z-index 41 and closes back to it, which is
   what the mockup's `data-open="back"` encodes. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var useState = preactHooks.useState;

  var validate = window.Meridian.validate;
  var fields = ui.fields;

  function errorFor(errors, field) {
    for (var i = 0; i < errors.length; i++) if (errors[i].field === field) return errors[i].message;
    return null;
  }

  function CategorySheet(props) {
    var draftState = useState(function () {
      return { name: '', colour: fields.SWATCHES[0], direction: 'more' };
    });
    var errorState = useState([]);
    var draft = draftState[0], setDraft = draftState[1];
    var errors = errorState[0], setErrors = errorState[1];

    function patch(p) {
      setDraft(function (prev) { return Object.assign({}, prev, p); });
      if (errors.length) setErrors([]);
    }

    function add() {
      var check = validate.validateCategory(draft, props.state);
      if (!check.ok) {
        setErrors(check.errors);
        return;
      }
      props.onAdd({
        name: String(draft.name).trim(),
        colour: draft.colour,
        direction: draft.direction,
        /* Decision 21 keeps four blocks and no planned-hours field, so a new
           category starts outside the plan and is given hours from the Manage
           sheet's row editor. */
        weekly_plan_hours: 0
      });
    }

    var footer = html`
      <button type="button" class="btn" onClick=${props.onClose}>Cancel</button>
      <button type="submit" class="btn btn--brand">Add category</button>`;

    return html`
      <${ui.Sheet} title="NEW CATEGORY" onClose=${props.onClose} footer=${footer}
        onSubmit=${add} stacked>

        <div class="catgrid">
          <${fields.Field} label="NAME" id="cat-name" error=${errorFor(errors, 'name')}>
            <${fields.TextField} className="fld--name" labelledBy="cat-name-label"
              value=${draft.name} placeholder="Volunteering" autofocus
              invalid=${!!errorFor(errors, 'name')}
              onInput=${function (v) { patch({ name: v }); }} />
          <//>

          <${fields.Field} label="COLOUR" id="cat-colour" error=${errorFor(errors, 'colour')}>
            <${fields.Swatches} labelledBy="cat-colour-label" theme=${props.theme}
              value=${draft.colour}
              onChange=${function (v) { patch({ colour: v }); }} />
          <//>
        </div>

        <${fields.Field} label="DIRECTION — WHAT DOES MORE OF THIS MEAN" id="cat-dir"
          note=${props.fromGoal ? 'MORE FEEDS THE GOAL' : null}
          error=${errorFor(errors, 'direction')}>
          <${fields.DirectionCards} labelledBy="cat-dir-label" value=${draft.direction}
            onChange=${function (v) { patch({ direction: v }); }} />
          ${props.fromGoal && draft.direction !== 'more' ? html`
            <p class="field__hint" role="status">
              Only More categories can carry goals. Less and Upkeep are fine to add
              here, they just will not feed this one.
            </p>` : null}
        <//>

        <p class="notepanel">
          Upkeep is logged but never scored or ranked — haircuts, laundry,
          commutes. You’ll see the hours, never a verdict.
        </p>
      <//>`;
  }

  ui.CategorySheet = CategorySheet;
})();
