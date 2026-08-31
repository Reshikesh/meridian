/* Meridian UI — app root: screen switching, theme switching, the header stamp.

   Phase 0 holds this state in the component. src/store.js (state shape,
   reducers, persistence, the unexported-changes counter) is Phase 1. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var useState = preactHooks.useState;
  var useEffect = preactHooks.useEffect;
  var dates = window.Meridian.dates;
  var ui = window.Meridian.ui;

  var THEME_KEY = 'meridian:theme';
  var THEME_IDS = ['paper', 'graphite', 'blueprint'];

  /* Spec §1: the only persisted state is the analysis range (Phase 3). The
     current screen is deliberately not persisted, and "Where it went" is the
     documented default. */
  var DEFAULT_SCREEN = 'went';

  /* Must match --m-screen in styles/base.css. */
  var SCREEN_FADE_MS = 120;

  /* localStorage can throw outright on a file:// origin depending on the
     browser's site-data settings. An uncaught throw here would leave the owner
     looking at a blank page, so every access is guarded. */
  function readTheme() {
    try {
      var stored = localStorage.getItem(THEME_KEY);
      if (THEME_IDS.indexOf(stored) !== -1) return stored;
    } catch (e) { /* fall through to the default */ }
    return 'paper';
  }

  function writeTheme(theme) {
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* in-memory only */ }
  }

  function currentStamp() {
    return dates.formatStamp(dates.logicalDay(new Date()));
  }

  function App() {
    var screenState = useState(DEFAULT_SCREEN);
    var outgoingState = useState(null);
    var themeState = useState(readTheme);
    var stampState = useState(currentStamp);

    var screen = screenState[0], setScreen = screenState[1];
    var outgoing = outgoingState[0], setOutgoing = outgoingState[1];
    var theme = themeState[0], setTheme = themeState[1];
    var stamp = stampState[0], setStamp = stampState[1];

    /* Persist in the click, not in an effect. QUALITY-BAR §6 requires every
       mutation to reach localStorage synchronously in the same event, and an
       effect keyed on [theme] also skips entirely when the clicked theme equals
       the current one — which silently discarded a deliberate choice made to
       undo a change from another window. */
    function chooseTheme(id) {
      writeTheme(id);
      document.documentElement.setAttribute('data-theme', id);
      setTheme(id);
    }

    /* Cross-fade: the outgoing screen stays mounted for the length of the
       transition and fades out while the incoming one fades in (QUALITY-BAR §3).
       Rendering only the new screen would be a fade-in from blank, not a
       cross-fade. */
    function goToScreen(id) {
      if (id === screen) return;
      setOutgoing(screen);
      setScreen(id);
    }

    useEffect(function () {
      if (outgoing === null) return undefined;
      var timer = setTimeout(function () { setOutgoing(null); }, SCREEN_FADE_MS);
      return function () { clearTimeout(timer); };
    }, [outgoing, screen]);

    /* Mount-time sync only; clicks persist through chooseTheme above. */
    useEffect(function () {
      document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    /* The stamp is computed at load, so it would go stale in a tab left open
       across 04:00. Returning the previous string unchanged lets Preact bail
       out, so this costs nothing on the minutes it does not change. */
    useEffect(function () {
      function refresh() {
        setStamp(function (prev) {
          var next = currentStamp();
          return next === prev ? prev : next;
        });
      }
      document.addEventListener('visibilitychange', refresh);
      var timer = setInterval(refresh, 60000);
      return function () {
        document.removeEventListener('visibilitychange', refresh);
        clearInterval(timer);
      };
    }, []);

    return html`
      <div class="root" data-screen=${screen}>
        <div class="container">
          <${ui.Header}
            screen=${screen} theme=${theme} stamp=${stamp}
            onScreen=${goToScreen} onTheme=${chooseTheme} />
          <div class="screens">
            ${outgoing === null ? null : html`
              <${ui.EmptyState} key=${'out:' + outgoing} screen=${outgoing} leaving />`}
            <${ui.EmptyState} key=${screen} screen=${screen} entering=${outgoing !== null} />
          </div>
        </div>
      </div>`;
  }

  preact.render(html`<${App} />`, document.getElementById('app'));
})();
