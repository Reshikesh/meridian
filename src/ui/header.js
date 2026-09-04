/* Meridian UI — header bar: wordmark, nav, theme toggle, data control, stamp.
   Geometry and copy are the mockup's, verbatim (spec §6).

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
          <span class="wordmark"
            title=${/* Decision 28: the build, on hover and to a screen reader.
                       Nothing visible changes in the header. */ version.TITLE}
          >MERIDIAN</span>
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
              data-error=${props.error ? '1' : '0'}
              aria-label=${props.error ? props.error.message : 'Data — ' + props.dataLabel}
              onClick=${props.onOpenData}>
              <span class="datactl__label">${props.demo ? 'DEMO' : 'DATA'}</span>
              <span class="datactl__sep" aria-hidden="true">·</span>
              ${props.error ? html`
                <span class="datactl__state datactl__state--error">NOT SAVING</span>`
              : html`
                <span class=${'datactl__state' + (props.unexported ? ' datactl__state--live' : '')}>
                  ${props.dataLabel}
                </span>`}
            </button>`}
          <span class="stamp">${props.stamp}</span>
        </div>
      </header>`;
  }

  ui.THEMES = THEMES;
  ui.Header = Header;
})();
