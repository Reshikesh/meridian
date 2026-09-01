const { test, expect } = require('@playwright/test');
const { APP_URL } = require('./lib/app-url');
const { installState } = require('./lib/seed-state');

const SCREENS = ['log', 'went', 'progress', 'goals', 'plan', 'lessons'];
const THEMES = ['paper', 'graphite', 'blueprint'];

// Attach every listener BEFORE the first navigation, or load-time console
// messages and the very first requests are missed entirely.
function watch(page) {
  const consoleErrors = [];
  const pageErrors = [];
  const offNetwork = [];
  const allRequests = [];

  page.on('console', (m) => {
    // Warnings count as failures too: a deprecation or a Preact key warning is
    // a defect the friend would eventually hit.
    if (m.type() === 'error' || m.type() === 'warning') {
      consoleErrors.push(`${m.type()}: ${m.text()} @ ${JSON.stringify(m.location())}`);
    }
  });
  page.on('pageerror', (e) => pageErrors.push(String(e && e.stack ? e.stack : e)));
  page.on('requestfailed', (r) => {
    if (!r.url().startsWith('file://')) offNetwork.push(`FAILED ${r.url()}`);
  });
  page.on('request', (r) => {
    allRequests.push(r.url());
    if (!/^(file|data|blob):/i.test(r.url())) offNetwork.push(`${r.method()} ${r.url()}`);
  });

  return { consoleErrors, pageErrors, offNetwork, allRequests };
}

test('opens from file://, walks every screen and theme, stays silent and offline', async ({ page, context }) => {
  // Belt and braces: even if the request listener were to miss something, this
  // route makes any attempt to leave the machine fail loudly and get recorded.
  const blocked = [];
  await context.route(/^(https?|ws|wss):\/\//i, (route) => {
    blocked.push(route.request().url());
    return route.abort();
  });

  // From Phase 1 an empty localStorage means the first-run screen, which has no
  // nav to walk. firstrun.spec.js owns that path; this one walks the shell.
  await installState(page);

  const w = watch(page);
  const res = await page.goto(APP_URL, { waitUntil: 'load' });
  expect(res, 'file:// navigation returned a response').not.toBeNull();

  // Default screen, with data loaded and no screen persisted, is "went".
  await expect(page.locator('.root')).toHaveAttribute('data-screen', 'went');
  await expect(page.locator('main.screen[data-s="went"]')).toBeVisible();
  await expect(page.locator('.wordmark')).toHaveText('MERIDIAN');
  await expect(page.locator('.stamp')).not.toBeEmpty();

  for (const theme of THEMES) {
    await page.click(`[data-theme-btn="${theme}"]`);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await expect(page.locator(`[data-theme-btn="${theme}"]`)).toHaveAttribute('data-active', '1');

    for (const screen of SCREENS) {
      await page.click(`[data-nav="${screen}"]`);
      await expect(page.locator('.root')).toHaveAttribute('data-screen', screen);
      await expect(page.locator(`main.screen[data-s="${screen}"]`)).toBeVisible();
      await expect(page.locator(`[data-nav="${screen}"]`)).toHaveAttribute('data-active', '1');
      // Only the active screen is rendered at all.
      await expect(page.locator('main.screen')).toHaveCount(1);
    }
  }

  expect(w.pageErrors, `uncaught page errors:\n${w.pageErrors.join('\n')}`).toEqual([]);
  expect(w.consoleErrors, `console errors/warnings:\n${w.consoleErrors.join('\n')}`).toEqual([]);
  expect(w.offNetwork, `non-file:// requests:\n${w.offNetwork.join('\n')}`).toEqual([]);
  expect(blocked, `requests that tried to leave the machine:\n${blocked.join('\n')}`).toEqual([]);

  // Printed unconditionally, including on a pass: an accidental CDN link or a
  // newly vendored file shows up here in the log the moment it is added.
  console.log('requests observed:', JSON.stringify(w.allRequests, null, 1));
});

test('theme persists across reload with no flash of the wrong theme', async ({ page }) => {
  await installState(page);
  await page.goto(APP_URL);
  await page.click('[data-theme-btn="graphite"]');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'graphite');
  expect(await page.evaluate(() => localStorage.getItem('meridian:theme'))).toBe('graphite');

  // 'commit' resolves as soon as the navigation commits, before load fires, so
  // reading data-theme here proves the PRE-PAINT script set it — not a later
  // hydration pass that would show a flash of the wrong theme first.
  await page.reload({ waitUntil: 'commit' });
  const atCommit = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  expect(atCommit, 'theme must be applied before first paint').toBe('graphite');
});

test('screen is not persisted: a reload returns to went', async ({ page }) => {
  await installState(page);
  await page.goto(APP_URL);
  await page.click('[data-nav="lessons"]');
  await expect(page.locator('.root')).toHaveAttribute('data-screen', 'lessons');

  await page.reload();
  await expect(page.locator('.root')).toHaveAttribute('data-screen', 'went');
});
