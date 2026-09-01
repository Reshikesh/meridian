/* Meridian UI — app root: the store, the first-run gate, screen switching,
   theme switching, the header stamp, and the data path in and out.

   The store is created and read at load, before the first render, so the app
   paints its real state rather than fading in from empty (QUALITY-BAR §3). */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var useState = preactHooks.useState;
  var useEffect = preactHooks.useEffect;
  var dates = window.Meridian.dates;
  var aggregate = window.Meridian.aggregate;
  var workbook = window.Meridian.workbook;
  var ui = window.Meridian.ui;
  var seed = window.MERIDIAN_SEED;

  var THEME_KEY = window.Meridian.storeKeys.theme;
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

  /* Created and loaded before render, not inside a component: the first paint
     must already know whether there is any data. */
  var store = window.Meridian.createStore({
    storage: window.Meridian.safeStorage(window)
  });
  store.load();
  window.Meridian.store = store;
  window.Meridian.installUnloadGuard(store, window);

  function App() {
    var stateHolder = useState(store.getState());
    var screenState = useState(DEFAULT_SCREEN);
    var outgoingState = useState(null);
    var themeState = useState(readTheme);
    var stampState = useState(currentStamp);
    var tickState = useState(function () { return new Date(); });
    var dataState = useState({ open: false, view: 'idle', pending: null, message: null });
    /* The Log screen's day. Spec §1: the analysis range is the only persisted
       state, so this resets to today on every open — which is where the friend
       wants to be when they sit down to log. */
    var dayState = useState(function () { return dates.dayKey(dates.logicalDay(new Date())); });
    /* Sheets, oldest first. Only the New category sheet ever stacks (over
       Manage), but a stack is what makes "closes back to its origin" a
       property of the frame rather than a special case in one sheet. */
    var stackState = useState([]);
    /* What is typed in the Log's quick-add row. It lives here rather than in the
       row because an entry saved through the sheet has to clear the row too, and
       the sheet is not the row's child. */
    var quickState = useState(function () {
      return Object.assign({}, ui.EMPTY_ENTRY_DRAFT);
    });

    var data = stateHolder[0], setData = stateHolder[1];
    var screen = screenState[0], setScreen = screenState[1];
    var outgoing = outgoingState[0], setOutgoing = outgoingState[1];
    var theme = themeState[0], setTheme = themeState[1];
    var stamp = stampState[0], setStamp = stampState[1];
    var tick = tickState[0], setTick = tickState[1];
    var sheet = dataState[0], setSheet = dataState[1];
    var day = dayState[0], setDay = dayState[1];
    var stack = stackState[0], setStack = stackState[1];
    var quick = quickState[0], setQuick = quickState[1];

    var firstRun = data === null;

    useEffect(function () {
      return store.subscribe(function (next) { setData(next); });
    }, []);

    /* Persist in the click, not in an effect. QUALITY-BAR §6 requires every
       mutation to reach localStorage synchronously in the same event, and an
       effect keyed on [theme] also skips entirely when the clicked theme equals
       the current one — which silently discarded a deliberate choice made to
       undo a change from another window.

       The workbook carries the theme so a dataset is portable, but choosing one
       is a display preference, not an edit: it syncs into settings without
       moving the unexported counter. */
    function chooseTheme(id) {
      writeTheme(id);
      document.documentElement.setAttribute('data-theme', id);
      setTheme(id);
      if (store.getState()) store.setSettings({ theme: id }, { silent: true });
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
       across 04:00, and "Exported 2 min ago" would stay two minutes old for an
       hour. Returning the previous string unchanged lets Preact bail out, so
       this costs nothing on the minutes it does not change. */
    useEffect(function () {
      function refresh() {
        setStamp(function (prev) {
          var next = currentStamp();
          return next === prev ? prev : next;
        });
        setTick(new Date());
      }
      document.addEventListener('visibilitychange', refresh);
      var timer = setInterval(refresh, 60000);
      return function () {
        document.removeEventListener('visibilitychange', refresh);
        clearInterval(timer);
      };
    }, []);

    /* ---------- the data path ---------- */

    function patchSheet(patch) {
      setSheet(function (prev) { return Object.assign({}, prev, patch); });
    }

    function startDemo() {
      store.replaceAll(seed.buildDemo(new Date(), { theme: theme }), 'demo');
    }

    function startEmpty() {
      store.replaceAll(seed.buildEmpty(new Date(), { theme: theme }), 'empty');
    }

    function startFresh() {
      store.startFresh();
      setSheet({ open: false, view: 'idle', pending: null, message: null });
    }

    function handleFile(file) {
      if (!ui.io.isWorkbook(file)) {
        patchSheet({ open: true, view: 'idle', message: 'That is not an .xlsx workbook.' });
        return;
      }
      patchSheet({ open: true, view: 'busy', message: null });
      ui.io.afterPaint(function () {
        ui.io.readFile(file).then(function (buffer) {
          var result = workbook.decode(window.XLSX, buffer, { now: new Date() });
          patchSheet({ open: true, view: 'report', pending: result, message: null });
        }).catch(function () {
          patchSheet({ open: true, view: 'idle', pending: null, message: 'That file could not be read.' });
        });
      });
    }

    function applyImport() {
      var pending = sheet.pending;
      if (!pending || !pending.state) return;
      store.replaceAll(pending.state, 'import');
      var imported = pending.state.settings && pending.state.settings.theme;
      if (THEME_IDS.indexOf(imported) !== -1 && imported !== theme) {
        writeTheme(imported);
        document.documentElement.setAttribute('data-theme', imported);
        setTheme(imported);
      }
      patchSheet({ open: true, view: 'imported', pending: null, message: null });
    }

    function handleExport() {
      patchSheet({ open: true, view: 'busy', message: null });
      ui.io.afterPaint(function () {
        try {
          var now = new Date();
          var bytes = workbook.encode(window.XLSX, store.getState(), { now: now });
          ui.io.download(bytes, workbook.exportFilename(now));
          store.markExported(now);
          patchSheet({ view: 'idle', message: null });
        } catch (e) {
          patchSheet({ view: 'idle', message: 'The workbook could not be written.' });
        }
      });
    }

    function closeSheet() {
      setSheet({ open: false, view: 'idle', pending: null, message: null });
    }

    /* ---------- the Log screen ---------- */

    var todayKey = dates.dayKey(dates.logicalDay(tick));

    /* Past days stay editable; a day that has not happened is never reachable
       (spec §12, business rule §8.15). */
    function stepDay(delta) {
      setDay(function (prev) {
        var next = dates.dayKey(dates.addDays(prev, delta));
        return next > todayKey ? prev : next;
      });
    }

    /* ---------- the sheet stack ----------
       push/pop rather than one id, because the New category sheet opens over
       Manage and has to close back to it (the mockup's `data-open="back"`). */

    function pushSheet(entry) {
      setStack(function (prev) { return prev.concat([entry]); });
    }

    function popSheet() {
      setStack(function (prev) { return prev.slice(0, -1); });
    }

    function clearStack() {
      setStack([]);
    }

    /* ---------- entries ---------- */

    function clearQuickAdd() {
      setQuick(Object.assign({}, ui.EMPTY_ENTRY_DRAFT));
    }

    function addEntry(input) {
      store.addEntry(input);
      clearQuickAdd();
    }

    /* A new entry clears the row whichever path wrote it; editing an existing
       one does not, because that sheet was never opened from the row. */
    function saveEntry(sheetState, input) {
      if (sheetState.entry) {
        store.updateEntry(sheetState.entry.id, input);
      } else {
        store.addEntry(input);
        clearQuickAdd();
      }
      popSheet();
    }

    var stackNodes = stack.map(function (item, i) {
      var key = item.kind + ':' + i;

      if (item.kind === 'entry') {
        return html`
          <${ui.EntrySheet} key=${key} state=${data} now=${tick} day=${day}
            entry=${item.entry || null} prefill=${item.prefill || null}
            onSave=${function (input) { saveEntry(item, input); }}
            onClose=${popSheet} />`;
      }

      if (item.kind === 'manage') {
        return html`
          <${ui.ManageSheet} key=${key} state=${data} now=${tick} theme=${theme}
            onNew=${function () { pushSheet({ kind: 'category' }); }}
            onUpdate=${function (id, patch) { store.updateCategory(id, patch); }}
            onArchive=${function (id) { store.archiveCategory(id, new Date()); }}
            onRestore=${function (id) { store.restoreCategory(id); }}
            onDelete=${function (id) { store.deleteCategory(id); }}
            onClose=${clearStack} />`;
      }

      return html`
        <${ui.CategorySheet} key=${key} state=${data} theme=${theme}
          onAdd=${function (input) { store.addCategory(input); popSheet(); }}
          onClose=${popSheet} />`;
    });

    var exportInfo = data ? data.exportInfo : null;
    var dataLabel = ui.format.exportLabel(exportInfo, tick);

    /* Phase 2 gives Log a real screen; the other five are still the designed
       empty state, and both take the same cross-fade classes.

       A plain function, not a component: a component declared inside App would
       be a new function identity on every render, so Preact would tear the
       screen down and rebuild it each time — and the quick-add row would lose
       what was being typed into it the moment anything else changed. */
    function renderScreen(id, mode) {
      var className = 'screen' +
        (mode === 'leaving' ? ' screen--leaving' : mode === 'entering' ? ' screen--entering' : '');
      var key = (mode === 'leaving' ? 'out:' : '') + id;

      if (id === 'log') {
        return html`
          <${ui.Log} key=${key} className=${className} state=${data} now=${tick}
            day=${day} today=${todayKey}
            draft=${quick} onDraft=${setQuick}
            onStepDay=${stepDay}
            onAddEntry=${addEntry}
            onOpenEntrySheet=${function (prefill) { pushSheet({ kind: 'entry', prefill: prefill }); }}
            onEditEntry=${function (entry) { pushSheet({ kind: 'entry', entry: entry }); }}
            onDeleteEntry=${function (id2) { store.deleteEntry(id2); }}
            onManage=${function () { pushSheet({ kind: 'manage' }); }} />`;
      }

      return html`
        <${ui.EmptyState} key=${key} screen=${id}
          leaving=${mode === 'leaving'} entering=${mode === 'entering'} />`;
    }

    var sheetNode = sheet.open ? html`
      <${ui.DataSheet}
        view=${sheet.view} pending=${sheet.pending} message=${sheet.message}
        firstRun=${firstRun}
        exportInfo=${exportInfo} now=${tick} source=${data ? data.source : null}
        storageError=${store.getError()}
        onExport=${handleExport} onFile=${handleFile}
        onApplyImport=${applyImport} onDismissReport=${firstRun ? closeSheet : closeSheet}
        onStartFresh=${startFresh} onClose=${closeSheet} />` : null;

    if (firstRun) {
      return html`
        <div class="root" data-screen="firstrun">
          <div class="container">
            <${ui.Header} compact stamp=${stamp} theme=${theme} onTheme=${chooseTheme} />
            <div class="screens">
              <${ui.FirstRun}
                busy=${sheet.view === 'busy'} message=${sheet.open ? null : sheet.message}
                onFile=${handleFile} onDemo=${startDemo} onEmpty=${startEmpty} />
            </div>
          </div>
          ${sheetNode}
        </div>`;
    }

    return html`
      <div class="root" data-screen=${screen}>
        <div class="container">
          <${ui.Header}
            screen=${screen} theme=${theme} stamp=${stamp}
            demo=${data.source === 'demo'}
            dataLabel=${dataLabel} unexported=${!!(exportInfo && exportInfo.unexported)}
            onScreen=${goToScreen} onTheme=${chooseTheme}
            onOpenData=${function () { patchSheet({ open: true, view: 'idle', message: null }); }} />
          <div class="screens">
            ${outgoing === null ? null : renderScreen(outgoing, 'leaving')}
            ${renderScreen(screen, outgoing === null ? null : 'entering')}
          </div>
        </div>
        ${sheetNode}
        ${stackNodes}
      </div>`;
  }

  preact.render(html`<${App} />`, document.getElementById('app'));
})();
