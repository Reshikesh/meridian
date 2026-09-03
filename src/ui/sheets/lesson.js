/* Meridian UI — the New lesson sheet (decision 25).

   Also the edit sheet, as the entry and goal sheets are. A lesson is whatever
   the owner wants to keep — a rule, a noticing, a line — so the sheet asks
   for the words first (decision 23: the required field leads and takes the
   caret), then an optional title, then optional tags naming a goal or a
   category. The date is the day it is written and is not asked for. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var useState = preactHooks.useState;
  var fields = ui.fields;

  var TITLE_MAX = 60;

  function initialDraft(lesson) {
    return {
      text: lesson ? lesson.text : '',
      title: lesson && lesson.title ? lesson.title : '',
      tags: lesson ? (lesson.tags || []).slice() : []
    };
  }

  /* What a tag can name: every live goal and category, plus whatever this
     lesson already carries, so an old tag on an archived goal survives an
     edit rather than vanishing because it is no longer offered. */
  function tagOptions(state, current) {
    var out = [];
    var seen = Object.create(null);
    (state.goals || []).forEach(function (g) {
      if (g.archived && current.indexOf(g.id) === -1) return;
      out.push({ id: g.id, label: g.short_name, kind: 'goal' });
      seen[g.id] = 1;
    });
    (state.categories || []).forEach(function (c) {
      if (c.archived && current.indexOf(c.id) === -1) return;
      out.push({ id: c.id, label: c.name, kind: 'category' });
      seen[c.id] = 1;
    });
    current.forEach(function (id) {
      if (!seen[id]) out.push({ id: id, label: id, kind: 'unknown' });
    });
    return out;
  }

  /* Many may be on at once, so these are toggle buttons, not a radio group:
     each is its own tab stop and flips with Enter or Space. */
  function TagPicker(props) {
    return html`
      <div class="tagpick" role="group" aria-labelledby=${props.labelledBy}>
        ${props.options.map(function (o) {
          var on = props.value.indexOf(o.id) !== -1;
          return html`
            <button type="button" class="tagpick__btn" key=${o.id}
              data-active=${on ? '1' : '0'} aria-pressed=${on ? 'true' : 'false'}
              onClick=${function () { props.onToggle(o.id); }}>${o.label}</button>`;
        })}
      </div>`;
  }

  function LessonSheet(props) {
    var editing = !!props.lesson;
    var draftState = useState(function () { return initialDraft(props.lesson); });
    var errorState = useState(null);
    var draft = draftState[0], setDraft = draftState[1];
    var error = errorState[0], setError = errorState[1];

    function patch(p) {
      setDraft(function (prev) { return Object.assign({}, prev, p); });
      if (error) setError(null);
    }

    function toggleTag(id) {
      patch({
        tags: draft.tags.indexOf(id) === -1
          ? draft.tags.concat([id])
          : draft.tags.filter(function (t) { return t !== id; })
      });
    }

    function submit() {
      var text = String(draft.text).trim();
      if (!text) {
        setError('Write something first.');
        return;
      }
      props.onSave({
        text: text,
        title: String(draft.title).trim() || null,
        tags: draft.tags.slice()
      });
    }

    var options = tagOptions(props.state, draft.tags);

    var footer = html`
      <button type="button" class="btn" onClick=${props.onClose}>Cancel</button>
      <button type="submit" class="btn btn--brand">${editing ? 'Save changes' : 'Save lesson'}</button>`;

    return html`
      <${ui.Sheet} title=${editing ? 'EDIT LESSON' : 'NEW LESSON'}
        onClose=${props.onClose} onSubmit=${submit} footer=${footer}>

        <${fields.Field} label="WHAT YOU LEARNED" id="lesson-text" error=${error}>
          <${fields.TextArea} className="fld--lesson" labelledBy="lesson-text-label"
            value=${draft.text} rows=${5} autofocus
            placeholder="Python only happens before 8am. Every evening attempt became scrolling."
            invalid=${!!error}
            describedBy=${error ? 'lesson-text-error' : null}
            onInput=${function (v) { patch({ text: v }); }} />
        <//>

        <${fields.Field} label="TITLE — OPTIONAL" id="lesson-title"
          hint="A few words to find it by. Leave it empty and the first line stands in.">
          <${fields.TextField} className="fld--goalname" labelledBy="lesson-title-label"
            value=${draft.title} placeholder="Before eight" maxLength=${TITLE_MAX}
            onInput=${function (v) { patch({ title: v }); }} />
        <//>

        ${options.length ? html`
          <${fields.Field} label="TAGS — OPTIONAL" id="lesson-tags"
            hint="A goal or a category this belongs to. Search finds a lesson by its tags too.">
            <${TagPicker} labelledBy="lesson-tags-label" options=${options}
              value=${draft.tags} onToggle=${toggleTag} />
          <//>` : null}
      <//>`;
  }

  ui.LessonSheet = LessonSheet;
})();
