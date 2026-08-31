const { test, expect } = require('@playwright/test');
const { APP_URL } = require('./lib/app-url');

// Proves the frozen-clock plumbing the responsive matrix depends on, and the
// two date rules that are binding everywhere in the app:
//   * decision 2  — the day boundary is 04:00, so 03:59 still belongs to the
//                   previous day;
//   * decision 18 — Monday-first ISO weeks, so 31.12.2026 is W53 and
//                   04.01.2027 is W1.
//
// playwright.config.js pins timezoneId: 'UTC'. page.clock.setFixedTime takes an
// ABSOLUTE instant — a bare 'YYYY-MM-DDTHH:mm:ss' string would be parsed in
// NODE's timezone and rendered in the BROWSER's, landing a day early. Always
// pass an explicit ...Z instant.

// Week number is zero-padded to two digits: decision 18 says ISO week numbers,
// and ISO 8601 writes them padded (2027-W01). The spec's examples (W23, W17,
// W14) are all two-digit anyway, so W01 is the only rendering consistent with
// both the standard and the fixed-width header stamp.
const STAMP = /^\d{2}\.\d{2}\.\d{4} \/ W\d{2}$/;

const cases = [
  // mid-day: unambiguous, this is the pure "does the frozen clock reach the
  // rendered stamp at all" case.
  { at: '2026-06-07T12:00:00Z', stamp: '07.06.2026 / W23' },
  // 04:00 boundary, either side of the same minute.
  { at: '2026-09-07T03:59:00Z', stamp: '06.09.2026 / W36' },
  { at: '2026-09-07T04:00:00Z', stamp: '07.09.2026 / W37' },
  // boundary and ISO week rollover at once.
  { at: '2027-01-01T03:59:00Z', stamp: '31.12.2026 / W53' },
  { at: '2027-01-04T09:00:00Z', stamp: '04.01.2027 / W01' },
];

for (const c of cases) {
  test(`header stamp at ${c.at} is "${c.stamp}"`, async ({ page }) => {
    await page.clock.setFixedTime(new Date(c.at));
    await page.goto(APP_URL);
    await expect(page.locator('.stamp')).toHaveText(c.stamp);
  });
}

test('header stamp has the DD.MM.YYYY / Wnn shape', async ({ page }) => {
  await page.goto(APP_URL);
  await expect(page.locator('.stamp')).toHaveText(STAMP);
});
