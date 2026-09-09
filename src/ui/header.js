/* Meridian UI — header bar: brand, nav, theme toggle, data control, stamp.
   Geometry and copy are the mockup's, verbatim (spec §6).

   The brand is the wordmark with the build under it (decision 28, amended 9
   Sep 2026). The mockup has one line there; this is the second of the two
   places the header carries something the mockup had no data to show.

   Two things the mockup has no room for, because it has no data behind it:
   the unexported-changes indicator (QUALITY-BAR §5) and a way in to import and
   export (spec §10). Both are the same control. It is written in the header's
   own vocabulary — the dim, tabular, letter-spaced caps of the date stamp
   beside it — rather than as a button, because the header has no buttons
   outside the two segmented groups.

   On first run the header keeps only what still means something with no data in
   the app: the wordmark, the theme toggle and today's date. */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};
  var version = window.Meridian.version;

  var THEMES = [
    { id: 'paper', label: 'PAPER' },
    { id: 'graphite', label: 'GRAPHITE' },
    { id: 'blueprint', label: 'BLUEPRINT' }
  ];

  function Themes(props) {
    return html`
      <div class="themes" role="group" aria-label="Theme">
        ${THEMES.map(function (t) {
          var active = props.theme === t.id;
          return html`
            <button type="button" class="themes__btn" key=${t.id} data-theme-btn=${t.id}
              data-active=${active ? '1' : '0'}
              aria-pressed=${active}
              onClick=${function () { props.onTheme(t.id); }}
            >${t.label}</button>`;
        })}
      </div>`;
  }

  function Header(props) {
    var compact = !!props.compact;

    return html`
      <header class=${'header' + (compact ? ' header--compact' : '')}>
        <div class="header__left">
          <div class="brand"
            title=${/* Decision 28: the build, on hover and to a screen reader.
                       The number is on the screen now; the tooltip keeps the
                       sentence-case full name, which is the form a tooltip and
                       a screen reader are read in. */ version.TITLE}
          >
            <span class="wordmark">MERIDIAN</span>
            ${/* Decision 28 as amended: the version under the wordmark. The
                  bare number, because the line above it has already said the
                  name — `MERIDIAN 1.3.1` here would say it twice. */ ''}
            <span class="brand__version">${version.VERSION}</span>
          </div>
          ${compact ? null : html`
            <nav class="nav" aria-label="Screens">
              ${ui.SCREEN_ORDER.map(function (id) {
                var active = props.screen === id;
                return html`
                  <button type="button" class="nav__btn" key=${id} data-nav=${id}
                    data-active=${active ? '1' : '0'}
                    aria-current=${active ? 'page' : null}
                    onClick=${function () { props.onScreen(id); }}
                  >${ui.SCREENS[id].label}</button>`;
              })}
            </nav>`}
        </div>
        <div class="header__right">
          <${Themes} theme=${props.theme} onTheme=${props.onTheme} />
          ${compact ? null : html`
            <button type="button" class="datactl" data-data-open data-demo=${props.demo ? '1' : '0'}
              data-error=${props.data.tone === 'error' ? '1' : '0'}
              data-tone=${props.data.tone || 'calm'}
              aria-label=${props.error ? props.error.message : 'Data — ' + props.data.text}
              onClick=${props.onOpenData}>
              <span class="datactl__label">${props.demo ? 'DEMO' : 'DATA'}</span>
              <span class="datactl__sep" aria-hidden="true">·</span>
              ${/* One line, whatever it is saying: the export label this app has
                    always shown, or one of the linked workbook's states. Which
                    one is core/link.js's decision, not the header's. */ ''}
              <span class=${'datactl__state datactl__state--' + (props.data.tone || 'calm')}>
                ${props.data.text}
              </span>
            </button>`}
          <span class="stamp">${props.stamp}</span>
        </div>
      </header>`;
  }

  ui.THEMES = THEMES;
  ui.Header = Header;
})();
