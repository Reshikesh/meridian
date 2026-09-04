/* Decision 28: one version string in the project.

   `src/core/version.js` is the source. Two other files repeat the number
   because their formats give us no way to derive it — package.json is read by
   npm before any of our code runs, and the changelog is prose. This suite is
   what keeps them honest: bump the constant and the suite goes red until both
   agree.

   The release tag is the third copy and cannot be checked from here — a tag is
   cut after the last commit, so no test that runs before it can see it. Phase
   7's checkpoint records the tag against this constant instead. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const version = require('../../src/core/version.js');

const ROOT = path.join(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('the constant is a plain three-part version, no prefix', () => {
  assert.match(version.VERSION, /^\d+\.\d+\.\d+$/);
});

test('package.json carries the same version', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.strictEqual(pkg.version, version.VERSION,
    `package.json says ${pkg.version}; src/core/version.js says ${version.VERSION}`);
});

test('the changelog opens on the same version', () => {
  /* The FIRST `## v` heading: the changelog is newest-first, so the top entry
     is the version being shipped. Anything below it has already gone out. */
  const first = read('dist/CHANGELOG.md').split('\n').find((l) => l.startsWith('## v'));
  assert.ok(first, 'dist/CHANGELOG.md has no `## v` heading at all');

  const found = first.match(/^## v(\d+\.\d+\.\d+)/);
  assert.ok(found, `the changelog's first version heading is not parseable: ${first}`);
  assert.strictEqual(found[1], version.VERSION,
    `the changelog opens on v${found[1]}; src/core/version.js says ${version.VERSION}`);
});

test('the display strings are built from the constant', () => {
  assert.strictEqual(version.DISPLAY, 'MERIDIAN ' + version.VERSION);
  assert.strictEqual(version.TITLE, 'Meridian ' + version.VERSION);
});

test('a real export stamps the constant into its Meta sheet', () => {
  /* The regression this exists for: workbook.js held its own '1.1.0' literal
     until Phase 7, so an export could disagree with the screen that made it.
     Asserted on a round-tripped workbook rather than on the source text — what
     matters is the bytes the friend gets, not how they were produced. */
  const XLSX = require('../../vendor/xlsx.full.min.js');
  const workbook = require('../../src/core/workbook.js');
  const seed = require('../../seed/seed.js');

  const NOW = new Date(2026, 5, 7, 12, 0, 0);
  const bytes = workbook.encode(XLSX, seed.buildDemo(NOW), { now: NOW });
  const { report } = workbook.decode(XLSX, bytes, { now: NOW });

  assert.strictEqual(report.meta.app_version, version.VERSION);
});
