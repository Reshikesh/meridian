/* Meridian UI — screen registry and the empty state.

   Log and Where it went say they are empty when there is nothing logged.
   Progress, Goals and Lessons never fall through to here: with nothing in
   them each is still its own screen with its own line saying so. Their
   entries below carry the nav label, and a heading kept true in case.

   The empty state is built from the mockup's own screen-header recipe (eyebrow +
   h1) followed by a full-bleed --strip band, the same treatment its stat strips
   use. It is one component, reused by every screen that needs it. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};

  /* Nav order is the mockup's, left to right (spec §6), less Plan: decision
     26 removes the screen, and Goals is the plan. Five screens. */
  var ORDER = ['log', 'went', 'progress', 'goals', 'lessons'];

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
      heading: 'No goals yet.',
      note: 'A goal turns logged hours into a landing date.'
    },
    goals: {
      label: 'Goals',
      eyebrow: 'GOALS',
      heading: 'No goals yet.',
      note: 'A goal turns logged hours into a landing date.'
    },
    lessons: {
      label: 'Lessons',
      eyebrow: 'LESSONS',
      heading: 'Nothing written yet.',
      note: 'A lesson is anything worth keeping.'
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
        aria-hidden=${props.leaving ? 'true' : null} inert=${props.leaving ? true : null}>
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
