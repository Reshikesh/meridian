const { defineConfig, devices } = require('@playwright/test');

// Meridian runs from file:// with no server, so there is no baseURL and no
// webServer: every navigation is an absolute file:// URL from lib/app-url.js.
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
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },

    // The browser the owner and the tester actually use. Uses the installed
    // system Edge, so it needs no downloaded binary.
    { name: 'msedge', use: { ...devices['Desktop Edge'], channel: 'msedge' } },

    // Opt-in with MERIDIAN_FIREFOX=1. Playwright's Firefox build cannot launch
    // on this Windows box (spawn UNKNOWN, SideBySide activation-context
    // failure), so keeping it out of the default set keeps the suite honest
    // rather than permanently red. Firefox is one env var away the day the
    // binary works.
    ...(process.env.MERIDIAN_FIREFOX
      ? [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }]
      : []),
  ],
});
