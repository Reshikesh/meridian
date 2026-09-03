/* Meridian UI — the Lessons screen (decision 25).

   A journal, not a close-out. Cards sized by what is in them, on a wall that
   fills the space left under the header: the pinned cards always, then a
   fill that rotates newest → oldest → random from one visit to the next,
   with a caps label naming which and a click to move it on. The wall is
   MEASURED, not guessed: cards render in priority order and a layout effect
   trims from the end until nothing overflows. Pinned cards are never trimmed;
   if they alone overflow, the wall scrolls.

   A search shows every match, no limit. Archived cards leave the wall
   entirely; *View archived* shows them with restore and delete-for-good.

   Which cards, in what order, and what matches a search are
   src/core/lessons.js; this file only measures and draws. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var useState = preactHooks.useState;
  var useRef = preactHooks.useRef;
  var useEffect = preactHooks.useEffect;
  var useLayoutEffect = preactHooks.useLayoutEffect;
  var useMemo = preactHooks.useMemo;

  var dates = window.Meridian.dates;
  var lessons = window.Meridian.lessons;

  /* Air under the wall, so the last row of cards does not touch the window's
     edge; and the least the wall is ever given, so a short window still shows
     something rather than nothing. */
  var BOTTOM_GAP = 28;
  var MIN_HEIGHT = 240;

  /* A small deterministic generator (mulberry32), seeded by the visit, so a
     random fill is the same random fill for the length of a visit — a card
     added or pinned does not reshuffle everything around it. */
  function seeded(seed) {
    var a = (Number(seed) || 0) + 0x6D2B79F5;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function tagNames(state) {
    var out = Object.create(null);
    (state.goals || []).forEach(function (g) { out[g.id] = g.short_name; });
    (state.categories || []).forEach(function (c) { out[c.id] = c.name; });
    return out;
  }

  function when(lesson) {
    var d = dates.toDate(lesson.date);
    return (lesson.iso_week ? lesson.iso_week.replace(/^\d{4}-/, '') : '') +
      (d ? ' · ' + dates.formatDayMonth(d) : '');
  }

  /* ---------- one card ---------- */

  function Card(props) {
    var l = props.lesson;
    var names = props.names;
    var archived = !!l.archived;
    var label = l.title || l.text;

    var items = archived
      ? [{
        label: 'Delete for good',
        tone: 'warn',
        confirm: { text: 'Deleting is for good. Nothing else in Meridian is.', yes: 'Delete', no: 'Keep it' },
        onSelect: function () { props.onDelete(l.id); }
      }]
      : [
        { label: 'Edit', onSelect: function () { props.onEdit(l); } },
        { label: l.pinned ? 'Unpin' : 'Pin', onSelect: function () { props.onPin(l.id); } },
        {
          label: 'Archive',
          confirm: { text: 'Archiving takes it off the wall and keeps it.', yes: 'Archive', no: 'Keep it' },
          onSelect: function () { props.onArchive(l.id); }
        },
        {
          label: 'Delete',
          tone: 'warn',
          confirm: { text: 'Deleting is for good. Archive keeps it.', yes: 'Delete', no: 'Keep it' },
          onSelect: function () { props.onDelete(l.id); }
        }
      ];

    return html`
      <article class=${'lcard' + (l.pinned ? ' lcard--pinned' : '') + (archived ? ' lcard--archived' : '')}
        data-lesson=${l.id} aria-label=${label}>
        <div class="lcard__top">
          <span class="lcard__when">${when(l)}</span>
          ${l.pinned ? html`<span class="lcard__pinned">PINNED</span>` : null}
          <span class="lcard__spacer"></span>
          ${archived ? html`
            <button type="button" class="actbtn actbtn--brand"
              onClick=${function () { props.onRestore(l.id); }}>restore</button>` : null}
          <${ui.RowMenu} name=${label} items=${items} />
        </div>
        ${l.title ? html`<h2 class="lcard__title">${l.title}</h2>` : null}
        <p class="lcard__text">${l.text}</p>
        ${l.tags && l.tags.length ? html`
          <div class="lcard__tags">
            ${l.tags.map(function (t) { return html`<span class="ltag" key=${t}>${names[t] || t}</span>`; })}
          </div>` : null}
      </article>`;
  }

  /* ---------- the wall ----------
     `fit`: the wall takes the height left under it, and trims cards from the
     end until nothing overflows. `free`: every card, the page scrolls — for
     a search and for the archive. */

  function Wall(props) {
    var hostRef = useRef(null);
    var heightState = useState(null);
    var height = heightState[0], setHeight = heightState[1];
    var limitState = useState(null);
    var limit = limitState[0], setLimit = limitState[1];
    var scrollState = useState(false);
    var scrolls = scrollState[0], setScrolls = scrollState[1];
    /* Where the trim is: shrinking in proportion to the overflow, then
       probing up one card at a time to the first overflow, then done. A ref,
       not state: it changes inside the layout effect and must not itself
       cause a render. */
    var phaseRef = useRef('trim');

    var cards = props.cards;
    var fit = props.mode === 'fit';
    var ids = cards.map(function (c) { return c.id; }).join(',');

    /* How much room there is: from the wall's top to the window's bottom. */
    useLayoutEffect(function () {
      var host = hostRef.current;
      if (!host || !fit) return undefined;
      function measure() {
        var top = host.getBoundingClientRect().top + window.scrollY;
        var h = Math.max(MIN_HEIGHT, window.innerHeight - top - BOTTOM_GAP);
        setHeight(function (prev) { return prev === h ? prev : h; });
      }
      measure();
      window.addEventListener('resize', measure);
      return function () { window.removeEventListener('resize', measure); };
    }, [fit]);

    /* A new set of cards, a new width or a new height: start again from all
       of them, then trim. Trimming only ever shrinks within one measurement,
       so it cannot oscillate. */
    useLayoutEffect(function () {
      phaseRef.current = 'trim';
      setLimit(null);
      setScrolls(false);
    }, [ids, height, props.width, fit]);

    useLayoutEffect(function () {
      var host = hostRef.current;
      var phase = phaseRef.current;
      if (!host || !fit || height === null || phase === 'done') return;
      var shown = limit === null ? cards.length : limit;
      var overX = host.scrollWidth > host.clientWidth + 1;
      var overY = host.scrollHeight > host.clientHeight + 1;
      var over = overX || overY;

      if (!over) {
        /* It fits. Everything is up, or one more is worth trying. */
        if (shown >= cards.length) { phaseRef.current = 'done'; return; }
        phaseRef.current = 'probe';
        setLimit(shown + 1);
        return;
      }
      if (phase === 'probe') {
        /* The probe that overflowed: one back, and stop. */
        phaseRef.current = 'done';
        setLimit(shown - 1);
        return;
      }
      if (shown <= props.pinnedCount) {
        /* The pinned cards alone do not fit: the wall scrolls (decision 25). */
        phaseRef.current = 'done';
        setScrolls(true);
        return;
      }
      /* Trim in proportion to the overflow, and by at least one, so a wall of
         two hundred cards settles in a handful of passes rather than two
         hundred. Never below the pinned cards. */
      var ratio = overX ? host.clientWidth / host.scrollWidth : host.clientHeight / host.scrollHeight;
      var next = Math.min(shown - 1, Math.floor(shown * ratio));
      setLimit(Math.max(props.pinnedCount, next));
    });

    var visible = fit && limit !== null ? cards.slice(0, limit) : cards;

    useEffect(function () {
      if (props.onShown) props.onShown(visible.length);
    }, [visible.length]);

    var className = 'wall' + (fit ? (scrolls ? ' wall--scroll' : ' wall--fit') : ' wall--free');
    var style = fit && height !== null ? (scrolls ? 'max-height:' : 'height:') + height + 'px' : null;

    /* The columns live on an inner box: a multi-column box with a height
       cap makes extra columns sideways rather than growing down, so the
       scrolling wall needs the cap on a box outside the columns. */
    return html`
      <div class=${className} ref=${hostRef} style=${style}
        role="region" aria-label=${props.label}>
        <div class="wall__cols">
          ${visible.map(function (l) {
            return html`<${Card} key=${l.id} lesson=${l} names=${props.names}
              onEdit=${props.onEdit} onPin=${props.onPin} onArchive=${props.onArchive}
              onRestore=${props.onRestore} onDelete=${props.onDelete} />`;
          })}
        </div>
      </div>`;
  }

  /* ---------- the screen ---------- */

  function Lessons(props) {
    var state = props.state;
    var all = state.lessons || [];

    /* One visit, one step of the rotation: read the count on mount, keep
       the mode it gives, and advance the count for next time. A click on
       the label steps the mode and moves the count with it. */
    var visitState = useState(function () {
      var n = props.visits.read();
      props.visits.write(n + 1);
      return n;
    });
    var visit = visitState[0], setVisit = visitState[1];
    var mode = lessons.modeForVisit(visit);

    var queryState = useState('');
    var query = queryState[0], setQuery = queryState[1];
    var archiveState = useState(false);
    var viewingArchive = archiveState[0], setViewingArchive = archiveState[1];
    var shownState = useState(0);
    var shown = shownState[0], setShown = shownState[1];
    var widthState = useState(0);
    var width = widthState[0], setWidth = widthState[1];

    useEffect(function () {
      function onResize() { setWidth(window.innerWidth); }
      window.addEventListener('resize', onResize);
      return function () { window.removeEventListener('resize', onResize); };
    }, []);

    var names = useMemo(function () { return tagNames(state); }, [state.goals, state.categories]);
    var random = useMemo(function () { return seeded(visit); }, [visit]);

    var wall = useMemo(function () {
      return lessons.wallOrder(all, mode, random);
    }, [all, mode, random]);
    var archived = lessons.archived(all);
    var live = lessons.live(all);
    var searching = query.trim() !== '';
    var matches = searching ? lessons.search(all, query, names) : [];

    function stepMode() {
      setVisit(function (v) {
        props.visits.write(v + 2);
        return v + 1;
      });
    }

    var actions = {
      onEdit: props.onEdit, onPin: props.onPin, onArchive: props.onArchive,
      onRestore: props.onRestore, onDelete: props.onDelete, names: names
    };

    /* ---- what the bar says, and what the wall holds ---- */

    var bar;
    var body;

    if (viewingArchive) {
      bar = html`
        <span class="t-label lessons__mode lessons__mode--flat">ARCHIVED — ${archived.length}</span>
        <button type="button" class="linkbtn lessons__switch"
          onClick=${function () { setViewingArchive(false); }}>Back to the wall</button>`;
      body = archived.length
        ? html`<${Wall} mode="free" cards=${archived} pinnedCount=${0} width=${width}
            label="Archived lessons" ...${actions} />`
        : html`<p class="lessons__line">Nothing archived.</p>`;
    } else if (searching) {
      bar = html`
        <span class="t-label lessons__mode lessons__mode--flat">
          MATCHING “${query.trim().toUpperCase()}” — ${matches.length}
        </span>
        <button type="button" class="linkbtn lessons__switch"
          onClick=${function () { setQuery(''); }}>Clear search</button>`;
      body = matches.length
        ? html`<${Wall} mode="free" cards=${matches} pinnedCount=${0} width=${width}
            label="Lessons matching the search" ...${actions} />`
        : html`<p class="lessons__line">Nothing matches “${query.trim()}”.</p>`;
    } else {
      var next = lessons.nextMode(mode);
      bar = html`
        <button type="button" class="t-label lessons__mode" data-mode=${mode}
          aria-label=${lessons.LABEL[mode].toLowerCase().replace('showing', 'Showing') +
            '. Click to show ' + next + '.'}
          onClick=${stepMode}>${lessons.modeLabel(mode, shown, wall.cards.length)}</button>
        ${archived.length ? html`
          <button type="button" class="linkbtn lessons__switch"
            onClick=${function () { setViewingArchive(true); }}>View archived (${archived.length})</button>` : null}`;
      body = live.length
        ? html`<${Wall} mode="fit" cards=${wall.cards} pinnedCount=${wall.pinnedCount} width=${width}
            label="Lessons" onShown=${setShown} ...${actions} />`
        : archived.length
          ? html`<p class="lessons__line">Nothing on the wall. ${archived.length === 1 ? 'One lesson is' : archived.length + ' lessons are'} archived.</p>`
          : null;
    }

    return html`
      <main class=${props.className} data-s="lessons" inert=${props.inert ? true : null}>
        <div class="lessons__head">
          <div class="lessons__title">
            <div class="t-eyebrow">LESSONS</div>
            <h1 class="t-h1">What the weeks taught you</h1>
          </div>
          <div class="lessons__tools">
            ${all.length ? html`
              <input type="search" class="input lessons__search" value=${query}
                placeholder="Search lessons" aria-label="Search lessons"
                autocomplete="off" spellcheck="false"
                onInput=${function (e) { setQuery(e.currentTarget.value); }}
                onKeyDown=${function (e) { if (e.key === 'Escape' && query) { e.stopPropagation(); setQuery(''); } }} />` : null}
            <button type="button" class="btn btn--brand" data-lesson-new
              onClick=${props.onNew}>+ New lesson</button>
          </div>
        </div>

        ${all.length ? html`
          <div class="lessons__bar">${bar}</div>
          ${body}`
        : html`
          <div class="lessons__none">
            <p class="lessons__noneline">
              Nothing written yet. A lesson is anything worth keeping — a rule, a noticing, a line you want to read again.
            </p>
            <button type="button" class="btn" onClick=${props.onNew}>Write the first</button>
          </div>`}
      </main>`;
  }

  ui.Lessons = Lessons;
})();
