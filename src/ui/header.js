/* Meridian UI — header bar: wordmark, nav, theme toggle, date/week stamp.
   Geometry and copy are the mockup's, verbatim (spec §6). */
(function () {
  'use strict';

  var html = htm.bind(preact.h);
  var ui = (window.Meridian = window.Meridian || {}).ui = window.Meridian.ui || {};

  var THEMES = [
    { id: 'paper', label: 'PAPER' },
    { id: 'graphite', label: 'GRAPHITE' },
    { id: 'blueprint', label: 'BLUEPRINT' }
  ];

  function Header(props) {
    return html`
      <header class="header">
        <div class="header__left">
          <span class="wordmark">MERIDIAN</span>
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
          </nav>
        </div>
        <div class="header__right">
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
          </div>
          <span class="stamp">${props.stamp}</span>
        </div>
      </header>`;
  }

  ui.THEMES = THEMES;
  ui.Header = Header;
})();
