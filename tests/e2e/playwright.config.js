const { defineConfig, devices } = require('@playwright/test');

// Meridian runs from file:// with no server, so there is no baseURL and no
// webServer: every navigation is an absolute file:// URL from lib/app-url.js.
/* performance.spec.js is timed, so it must not share the machine with eleven
   other workers: measured inside the parallel run it read 288-493 ms for a
   first render that takes 171-185 ms on its own. It is kept out of the two
   browser projects and given one of its own, run alone by `npm run test:perf`,
   so the numbers in the phase report mean something. A top-level testIgnore
   cannot be undone per project, so each project carries its own. */
const TIMED = '**/performance.spec.js';

/* The timed project exists only when it is asked for by name. Left in the
   default list it runs beside eleven other workers and measures the machine
   rather than the app — which is exactly how its sheet-timing test failed in a
   full run and passed alone. `npm run test:perf` passes --project=perf. */
if (process.argv.indexOf('--project=perf') !== -1) process.env.MERIDIAN_PERF = '1';
/* Via the environment, not argv alone: Playwright's worker processes re-read
   this file without the parent's arguments, so a project that existed only in
   the parent is "not found in the worker process". The env var is inherited. */
const PERF_ONLY = !!process.env.MERIDIAN_PERF;

module.exports = defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.js',
  outputDir: 'test-results',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  // list only. The html reporter writes a viewer that cannot be opened on the
  // owner's machine, so it would be a report nobody ever reads.
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Deterministic rendering.
    colorScheme: 'light',
    reducedMotion: 'reduce',
    // REQUIRED. Without it, page.clock instants are parsed in Node's timezone
    // and rendered in the browser's, which lands the header stamp a day early.
    // Pinning the browser to UTC makes an explicit ...Z instant unambiguous.
    timezoneId: 'UTC',
  },
  projects: [
    // Playwright's own chromium build (the headless shell installed by
    // `npm run e2e:setup`). devices['Desktop Chrome'] sets no `channel`, so
    // this does not reach for a system Chrome — there is none on this machine.
    { name: 'chromium', testIgnore: TIMED, use: { ...devices['Desktop Chrome'] } },

    // The browser the owner and the tester actually use. Uses the installed
    // system Edge, so it needs no downloaded binary.
    { name: 'msedge', testIgnore: TIMED, use: { ...devices['Desktop Edge'], channel: 'msedge' } },

    // Timed, and run alone. Chromium only: the budgets are a property of the
    // app, not of a second browser's parse speed.
    ...(PERF_ONLY
      ? [{
        name: 'perf',
        testMatch: TIMED,
        fullyParallel: false,
        use: { ...devices['Desktop Chrome'] },
      }]
      : []),

    // Opt-in with MERIDIAN_FIREFOX=1. Playwright's Firefox build cannot launch
    // on this Windows box (spawn UNKNOWN, SideBySide activation-context
    // failure), so keeping it out of the default set keeps the suite honest
    // rather than permanently red. Firefox is one env var away the day the
    // binary works.
    ...(process.env.MERIDIAN_FIREFOX
      ? [{ name: 'firefox', testIgnore: TIMED, use: { ...devices['Desktop Firefox'] } }]
      : []),
  ],
});
