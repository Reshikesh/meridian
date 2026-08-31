/* Meridian UI — screen registry and the empty state.

   Phase 0 renders no data, so every screen is its empty state. Log, Where it
   went and Goals say they are empty; Progress, Plan and Lessons carry the calm
   "coming after your first full week" line, because they are v1.5 (decision 4).

   The empty state is built from the mockup's own screen-header recipe (eyebrow +
   h1) followed by a full-bleed --strip band, the same treatment its stat strips
   use. It is one component, reused by all six screens. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};

  /* Nav order is the mockup's, left to right (spec §6). */
  var ORDER = ['log', 'went', 'progress', 'goals', 'plan', 'lessons'];

  var SCREENS = {
    log: {
      label: 'Log',
      eyebrow: 'LOG',
      heading: 'Nothing logged yet.',
      note: 'Entries you add will appear here.'
    },
    went: {
      label: 'Where it went',
      eyebrow: 'WHERE IT WENT',
      heading: 'Nothing to show yet.',
      note: 'A few logged days will fill this.'
    },
    progress: {
      label: 'Progress',
      eyebrow: 'PROGRESS',
      heading: 'Coming after your first full week.',
      note: 'Projections need a few weeks of logged hours behind them.'
    },
    goals: {
      label: 'Goals',
      eyebrow: 'GOALS',
      heading: 'No goals yet.',
      note: 'A goal turns logged hours into a landing date.'
    },
    plan: {
      label: 'Plan',
      eyebrow: 'PLAN',
      heading: 'Coming after your first full week.',
      note: 'Planning a week works once there is a lived week to compare it to.'
    },
    lessons: {
      label: 'Lessons',
      eyebrow: 'LESSONS',
      heading: 'Coming after your first full week.',
      note: 'The weekly close-out arrives when the first week closes.'
    }
  };

  /* `entering` / `leaving` drive the 120ms cross-fade. Neither is set on first
     load, so the app paints its content immediately rather than fading up from
     blank (QUALITY-BAR §3: no flash of empty content on load). */
  function EmptyState(props) {
    var s = SCREENS[props.screen];
    var className = 'screen';
    if (props.leaving) className += ' screen--leaving';
    else if (props.entering) className += ' screen--entering';

    return html`
      <main class=${className} data-s=${props.screen}
        aria-hidden=${props.leaving ? 'true' : null}>
        <div class="empty__head">
          <div class="t-eyebrow empty__eyebrow">${s.eyebrow}</div>
          <h1 class="t-h1">${s.heading}</h1>
        </div>
        <div class="empty__panel">
          <p class="empty__note">${s.note}</p>
        </div>
      </main>`;
  }

  ui.SCREEN_ORDER = ORDER;
  ui.SCREENS = SCREENS;
  ui.EmptyState = EmptyState;
})();
