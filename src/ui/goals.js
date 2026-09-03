/* Meridian UI — the Goals screen (deck-04-goals.png, spec §4h, §6, §12).

   The table is the mockup's five columns — GOAL, TARGET, BY, PROGRESS, LANDS —
   with the ghost row under them and the footer verbatim. A sixth, narrow column
   carries the `…` menu BUILD-PLAN § Phase 4 asks for ("archive goal via row
   menu"), the way the Log's table already ends.

   Not one number is computed here. Banked hours, progress, the landing date and
   the slippage are `projection.goalRows`, and the entry sheet's SAVING THIS
   MOVES preview reads the same `project()` — the two are one arithmetic, so
   they cannot drift apart. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};

  var dates = window.Meridian.dates;
  var projection = window.Meridian.projection;

  /* Counts are spelled out as far as the mockup's own "Three open." goes, and
     become figures past the point where a word is slower to read than a
     number. */
  var WORDS = ['no', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
               'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

  function count(n) {
    return n > 0 && n < WORDS.length ? WORDS[n] : String(n);
  }

  function plural(n, word) {
    return n + ' ' + word + (n === 1 ? '' : 's');
  }

  /* "Three open. One slipping." — the second sentence only when something is
     slipping, so a screen with nothing wrong on it says nothing red. */
  function headline(counts) {
    if (counts.open === 0) return { lead: 'No goals yet.', warn: null };
    return {
      lead: count(counts.open) + ' open.',
      warn: counts.slipping > 0 ? count(counts.slipping) + ' slipping.' : null
    };
  }

  /* ---------- LANDS ---------- */

  function Lands(props) {
    var row = props.row;

    if (row.done) {
      return html`
        <div class="goalrow__lands">
          <div class="goalrow__date goalrow__date--good">Reached</div>
        </div>`;
    }

    /* Fewer than two logged days for this goal: there is no honest date to
       put here yet, and the reason is worth more than a blank cell. The
       owner's own words (Phase 4), now covering only this case — from the
       second day on there is an early estimate, labelled (decision 27). */
    if (!row.landing) {
      return html`
        <div class="goalrow__lands">
          <div class="goalrow__date goalrow__date--none" aria-hidden="true">—</div>
          <div class="goalrow__slip">after a week of logging</div>
        </div>`;
    }

    var slip = row.slippageDays;
    var late = slip !== null && slip > 0;
    var note = slip === null ? null
      : slip > 0 ? '+' + plural(slip, 'day')
      : slip < 0 ? '−' + plural(-slip, 'day')
      : 'on time';
    var early = projection.earlyLabel(row);

    return html`
      <div class="goalrow__lands">
        <div class=${'goalrow__date' + (late ? ' goalrow__date--warn' : '')}>
          ${dates.formatDayMonth(row.landing)}
        </div>
        ${note ? html`
          <div class=${'goalrow__slip' + (late ? ' goalrow__slip--warn' : '')}>${note}</div>`
          : null}
        ${early ? html`<div class="goalrow__early">${early}</div>` : null}
      </div>`;
  }

  /* ---------- one live goal ---------- */

  function GoalRow(props) {
    var row = props.row;
    var g = row.goal;
    var pct = row.target > 0 ? Math.min(100, row.banked / row.target * 100) : 0;

    var sub = row.banked.toFixed(1) + ' h';
    if (row.weeksRunning > 0) sub += ' · ' + plural(row.weeksRunning, 'week') + ' running';

    return html`
      <div class="goalrow">
        <div class="goalrow__name">
          <button type="button" class="goalrow__label" onClick=${function () { props.onEdit(g); }}
          >${g.short_name}</button>
          ${g.identity ? html`<div class="goalrow__identity">${g.identity}</div>` : null}
        </div>

        <div class="goalrow__target">${row.target.toFixed(1)} h</div>
        <div class="goalrow__by">${dates.formatDayMonth(g.by_date)}</div>

        <div class="goalrow__progress">
          <div class="goalbar">
            <div class="goalbar__fill" style=${'width:' + pct.toFixed(1) + '%'} />
          </div>
          <div class="goalrow__sub">${sub}</div>
        </div>

        <${Lands} row=${row} />

        <${ui.RowMenu} name=${g.short_name} items=${[
          { label: 'Edit', onSelect: function () { props.onEdit(g); } },
          {
            label: 'Archive',
            confirm: {
              text: 'Archiving keeps the ' + row.banked.toFixed(1) +
                ' h. It leaves the pickers, not the history.',
              yes: 'Archive', no: 'Keep it'
            },
            onSelect: function () { props.onArchive(g.id); }
          }
        ]} />
      </div>`;
  }

  /* ---------- an archived goal ----------
     "Archived goals keep their hours. Nothing is deleted." — so it keeps its
     row, in the Manage sheet's own treatment of an archived category: dimmed,
     the hours it kept, and a way back. */
  function ArchivedRow(props) {
    var row = props.row;
    var g = row.goal;

    return html`
      <div class="goalrow goalrow--archived">
        <div class="goalrow__name">
          <span class="goalrow__label goalrow__label--flat">${g.short_name}</span>
          ${g.identity ? html`<div class="goalrow__identity">${g.identity}</div>` : null}
        </div>

        <div class="goalrow__target">${row.target.toFixed(1)} h</div>
        <div class="goalrow__by">${dates.formatDayMonth(g.by_date)}</div>

        <div class="goalrow__progress">
          <div class="goalrow__sub">${row.banked.toFixed(1)} h kept</div>
        </div>

        <div class="goalrow__lands">
          <button type="button" class="actbtn actbtn--brand"
            onClick=${function () { props.onRestore(g.id); }}>restore</button>
        </div>

        <div></div>
      </div>`;
  }

  /* ---------- the screen ---------- */

  function Goals(props) {
    var state = props.state;
    var rows = projection.goalRows(state, props.now);
    var counts = projection.goalCounts(state, props.now);
    var head = headline(counts);

    var live = rows.filter(function (r) { return !r.goal.archived; });
    var archived = rows.filter(function (r) { return r.goal.archived; });

    return html`
      <main class=${props.className} data-s="goals" inert=${props.inert ? true : null}>
        <div class="goals__head">
          <div class="goals__title">
            <div class="t-eyebrow">GOALS</div>
            <h1 class="t-h1">
              ${head.lead}
              ${head.warn ? html`${' '}<span class="goals__slipping">${head.warn}</span>` : null}
            </h1>
          </div>
          <button type="button" class="btn btn--brand" data-goal-new
            onClick=${function () { props.onNew(); }}>+ New goal</button>
        </div>

        <div class="goaltable">
          <div class="goaltable__scroll">
            <div class="goalrow goaltable__head t-label">
              <div>GOAL</div><div>TARGET</div><div>BY</div><div>PROGRESS</div>
              <div class="goaltable__right">LANDS</div><div></div>
            </div>

            <div class="goaltable__rows">
              ${live.map(function (row) {
                return html`
                  <${GoalRow} key=${row.goal.id} row=${row}
                    onEdit=${props.onEdit} onArchive=${props.onArchive} />`;
              })}

              <button type="button" class="goalrow goalrow--ghost" onClick=${props.onNew}>
                <span class="goalrow__ghostname">Name it</span>
                <span class="goalrow__target">hours</span>
                <span class="goalrow__by">date</span>
                <span class="goalrow__sub goalrow__hint">Meridian fills this from your log</span>
                <span></span>
              </button>

              ${archived.length ? html`
                <div class="goals__archived">
                  <div class="t-label goals__archivedlabel">ARCHIVED</div>
                  ${archived.map(function (row) {
                    return html`
                      <${ArchivedRow} key=${row.goal.id} row=${row}
                        onRestore=${props.onRestore} />`;
                  })}
                </div>` : null}
            </div>
          </div>
        </div>

        <p class="goals__foot">Archived goals keep their hours. Nothing is deleted.</p>
      </main>`;
  }

  ui.Goals = Goals;
  /* Progress reuses the same headline from the same counts (decision 27). */
  ui.goalHeadline = headline;
})();
