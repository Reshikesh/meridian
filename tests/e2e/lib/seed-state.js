// A dataset in localStorage before the page loads.
//
// From Phase 1 the app has a first-run screen, and an empty localStorage means
// exactly that: no header nav, no screens, nothing to walk. Every spec that
// exercises the shell has to say which dataset it is looking at, so it says so
// here rather than in eight different inline scripts.
//
// The state is built from the real seed module at a fixed reference day, so the
// injected JSON is byte-identical run to run and the screenshots do not churn.

const seed = require('../../../seed/seed.js');

// The mockup's own "today" (spec §9), so seeded dates read like the design.
// Local-time constructor on purpose: the seed keys its shape to the weekday of
// the logical day, which is a local-clock notion.
const REFERENCE_DAY = new Date(2026, 5, 7, 12, 0, 0);

const DATA_KEY = 'meridian:data';
const THEME_KEY = 'meridian:theme';

function demoState() {
  return seed.buildDemo(REFERENCE_DAY);
}

function emptyState() {
  return seed.buildEmpty(REFERENCE_DAY);
}

// addInitScript, not an evaluate after load: the store reads localStorage at
// load time, before the first render, so anything written afterwards would be
// read one paint too late.
//
// Written only when the key is absent. An init script runs again on every
// navigation, so writing unconditionally would silently reset the dataset on
// each reload — and a test of "this survives a reload" would then be testing
// the fixture rather than the app.
async function installState(page, state) {
  await page.addInitScript(([key, json]) => {
    try {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, json);
    } catch (e) { /* private mode */ }
  }, [DATA_KEY, JSON.stringify(state || demoState())]);
}

async function installTheme(page, theme) {
  await page.addInitScript(([key, value]) => {
    try { localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }, [THEME_KEY, theme]);
}

module.exports = {
  REFERENCE_DAY, DATA_KEY, THEME_KEY,
  demoState, emptyState, installState, installTheme,
};
