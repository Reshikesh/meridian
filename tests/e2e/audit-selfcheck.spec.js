const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { test, expect } = require('@playwright/test');
const { auditInPage, formatAudit } = require('./lib/audit');

// This spec tests the AUDITOR, not the app: it runs on fixtures only, so it is
// green before index.html exists and it stays green independently of the app.
// Its job is to stop lib/audit.js quietly degrading into a no-op — which is
// exactly how a responsive suite ends up passing while the layout is broken.

const fixture = (f) => pathToFileURL(path.join(__dirname, 'fixtures', f)).href;

test.use({ viewport: { width: 1280, height: 900 } });

test('the audit CATCHES all three failure classes', async ({ page }) => {
  await page.goto(fixture('fixture-broken.html'));
  const res = await page.evaluate(auditInPage);
  console.log(formatAudit(res, 'broken').join('\n'));

  expect(res.pageScroll.ok, 'must detect horizontal page scroll').toBe(false);
  expect(res.textOverflow.length, 'must detect clipped text').toBeGreaterThan(0);
  expect(res.overlaps.length, 'must detect overlapping leaves').toBeGreaterThan(0);
  expect(res.offLeft.length, 'must detect a box pushed off the left edge').toBeGreaterThan(0);
  expect(res.clippedOverlays.length,
    'must detect an overlay clipped by an ancestor').toBeGreaterThan(0);
});

test('the audit does NOT flag legitimate patterns', async ({ page }) => {
  await page.goto(fixture('fixture-ok.html'));
  await page.evaluate(() => window.scrollTo(0, 400)); // put the sticky header over the rows
  const res = await page.evaluate(auditInPage);
  console.log('counts:', JSON.stringify(res.counts));
  console.log(formatAudit(res, 'ok').join('\n') || '(clean)');

  expect(res.pageScroll.ok, 'sticky/fixed/scroller patterns must not scroll the page').toBe(true);
  expect(res.textOverflow, 'ellipsis, clamp, scroller and input must not count as clipped').toEqual([]);
  expect(res.overlaps, 'sticky over rows and fixed sheet over page must not count as overlap').toEqual([]);
  expect(res.offLeft, 'nothing legitimate hangs off the left edge').toEqual([]);
  expect(res.clippedOverlays, 'a fixed, on-screen overlay is not clipped').toEqual([]);
  expect(res.counts.overlays, 'the overlay fixture is actually present').toBeGreaterThan(0);
});
