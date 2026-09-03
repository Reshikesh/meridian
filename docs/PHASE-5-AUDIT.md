# Phase 5 — the polish gate

Meridian v1, audited against every line of `QUALITY-BAR.md` before being zipped
for the friend. Nothing in this phase added a feature.

**How the audit was run.** One reviewer per QUALITY-BAR section, against the real
code, each told to report only what fails a named line of the bar and to check
`DECISIONS.md` and `DECISION-LOG.md` first so a logged deviation is not
re-reported as a defect. Every finding was then handed to a separate reviewer
whose job was to *refute* it, defaulting to "not real" unless it could be traced
in the code. Finally a completeness reviewer was asked what the whole exercise
had missed.

**27 findings raised, 17 survived refutation, 6 gaps found on top of them.**
Ten were refuted — mostly test-coverage wishes, or deviations already recorded as
decisions. The six later gaps were the most valuable part: two of them outrank
anything the section reviewers found.

| Section | Raised | Confirmed |
|---|---|---|
| 1. Fidelity to the redesign | 2 | 1 |
| 2. Layout and responsiveness | 3 | 0 |
| 3. Smoothness and motion | 3 | 2 |
| 4. Interaction details | 3 | 3 |
| 5. States | 4 | 4 |
| 6. Data and persistence | 3 | 3 |
| 7. Themes and colour | 4 | 2 |
| 8. Definition of done | 5 | 2 |

---

## Fixed

### Data integrity

**Two windows of the app overwrote each other.** Every copy of `index.html` on
one machine shares a single `localStorage` origin, and `persist()` wrote the
whole state blob without ever re-reading it. The friend double-clicks
`index.html` a second time on Wednesday, logs a day, closes it — then touches
the Tuesday window still open behind it, and that one mutation writes its stale
copy over everything Wednesday recorded. This is the exact loss `CLAUDE.md`
forbids, and it was reachable by ordinary use rather than by an edge case.
A `storage` listener now adopts another window's write instead of clobbering it
(`src/store.js`, `installStorageWatch`). *Found by the completeness reviewer.*

**Deleting a category silently orphaned every goal it fed.**
`canDeleteCategory` counted logged minutes and never looked at goals, so a
category with no hours but a goal fed by it was offered for deletion under the
words *"Never used — safe to delete"*. Afterwards the goal survived on screen
naming a category id that no longer existed, no hour could ever reach it because
every picker filters on that id, and an export of that state **could not be
imported** — the Goals row is rejected on its foreign key, so the round trip the
bar requires was broken by a delete the app called safe. Goals now pin their
category, and the Manage row says which goal is holding it.

**Import rejects named the wrong row.** Rejects were numbered by position in the
decoded array, but blank lines are dropped before numbering — so one wiped row
anywhere above shifted every number below it. `src/ui/report.js` promises the
friend *"the header is row 1, so the first data row is row 2"* and decision 5
sends them into Excel to fix the row it names; they would have opened a
perfectly correct entry. Rows now carry their true spreadsheet number.

### Interaction

**Dragging a selection out of a sheet threw the sheet away.** Press inside a
field, drag past the card edge, release: the browser fires `click` on the veil —
the nearest common ancestor — so the sheet closed and everything typed was gone,
with no confirm and no undo. A veil click now only counts when the gesture
*started* on the veil.

**A sheet opened from a `…` menu returned focus to nothing.** Clicking a menu
item focused it, and closing the panel removed it in the same commit, so focus
fell to `<body>` — which the sheet then captured as its "opener" and returned to
on close. The next Tab restarted at the top of the page. The menu now hands focus
back to its `…` before acting.

**Escape could be swallowed for one frame.** The sheet frame attached its Escape
handler, focus trap, scroll lock and first-field focus inside a `useEffect`,
which the vendored hooks flush *after* the frame is painted. On an idle machine
that gap is invisible; under load it is long enough to eat a real Escape — which
is how the new performance suite caught it. It is a layout effect now, and the
sheet's Escape marks the event so the Where-it-went pick-abort cannot also act
on it regardless of which listener happens to be registered first.

**The Log's day never rolled over.** A tab left open across 04:00 rolled the
header stamp but not the Log's day, so the heading, its hours and the quick-add
target all still pointed at yesterday while the header disagreed. The README
tells the friend they can leave it open, so this was on the likely path. The day
now follows the clock — unless they had paged back to an earlier day, which is
kept.

**Nothing acknowledged a press.** No `:active` state existed anywhere, and
`.sheet__close`, the colour swatches and the chart bands had no hover either.
Both added, from tokens, inside §3's 80 ms budget.

**With no categories, `+` opened a sheet that could not be completed.** Now
disabled with the rest of the row.

### States

**A browser that had stopped saving said so only inside the Data sheet.** The
storage-failure and corrupt-saved-data messages were passed to one component
nobody opens before they have started, so the friend could lose a day without
being told. Both now reach the header (`DEMO · NOT SAVING`, in warn) and the
first-run screen.

**Dropping a non-workbook on the first-run screen** opened the Data sheet, which
offers to export a dataset that does not exist yet. The message stays on the
first-run screen now.

### Fidelity

**The reachability panel lost the mockup's tabular figures** on the pace number,
keeping them only on the required-hours number. One CSS line. The refuting
reviewer measured the real difference at about 0.05 px a digit in Archivo, so
this is a hairline nit, recorded because §1 says *verbatim*.

---

## Not fixed, and why

**The graphite swatch outline does not work.** QUALITY-BAR §7 says a swatch
under 3:1 gets a 1 px `--line` outline. On graphite `--line` is itself 1.34:1
against the background — *less* distinguishable than the swatch it is meant to
rescue, so the outline reads as a step toward the page rather than away from it.
The implementation is faithful; the bar's own remedy is what fails. **Your call:
one word, `--ink2` instead of `--line` (5.6:1 on graphite), would make the rule
actually bite.** Left alone for v1 because §1 forbids inventing a treatment.

**Calendar day numerals over saturated heat.** `--ink` on a fully saturated heat
cell is 1.83:1 on graphite. It is verbatim from the mockup, and it only affects
the hover numerals on the busiest days of a focused band. A 1 px `--bg` halo
would fix it without touching a token, if you want it.

**Sheets animate open and vanish on close.** The motion spec describes the open;
there is no exit animation. Adding one means holding each sheet mounted through
its exit, which is a change to the sheet stack days before the zip ships. Listed
rather than done.

**Three bars transition size, not opacity** (`weekstrip__bar` height,
`goalbar__fill` and `sharebar__fill` width). §3 says charts animate opacity, not
size. These are progress bars rather than charts, and a width transition is what
makes a bar read as filling; changing it would be a worse result than the rule.

**Firefox has never been run.** `DECISIONS.md` 6 names Chromium *and* Firefox as
targets. Playwright's Firefox build cannot launch on this machine (a
long-standing, logged environment failure), so the suite has only ever proven
Chromium and Edge. **This is the one gap I cannot close for you: please open the
unzipped `index.html` in Firefox by hand before you send it**, walk the six
screens, log an entry and export. Everything the app uses is ordinary, but
"tested" would be the wrong word.

**Two gaps from the completeness reviewer are left open**, both test-coverage
rather than defects: no test has ever rendered the app with motion *enabled*
(every project runs `reducedMotion: 'reduce'`), and the import-report sheet is
only ever exercised at 1280 px in one theme.

---

## The numbers

Measured with the timed project alone on the machine (`npm run test:perf`);
running it beside eleven other workers measured the machine, not the app, which
is why it is now opt-in.

| BUILD-PLAN target | Measured |
|---|---|
| 2,000 entries to first render, under 200 ms | **168–181 ms** |
| A range change, under 100 ms | **19–23 ms** |
| Screen switches | **18–31 ms** |
| No jank in sheet animations | **no long task** over four open/close cycles |

Two honest notes. Playwright cannot drive the DevTools Performance panel the
plan names, so jank is measured with `PerformanceObserver` long tasks — a task
over 50 ms is what the panel would draw a red triangle over. And Chromium
exposes no paint, navigation or resource timing at all on a `file://` origin, so
first render is timed with a `MutationObserver` from navigation start.

The headroom on first render is thin, and it is nearly all SheetJS: the vendored
`xlsx.full.min.js` is 952 KB, 98 % of the vendored JavaScript, parsed on every
open although it is only needed for import and export. Stubbing it drops first
render to 122–129 ms. Loading it on demand is about twenty lines and would give
back 50 ms — **not done here**, because it changes the load path days before the
zip ships and import/export is the app's only backup. It is the obvious first
optimisation if you ever want one.

---

## New coverage

- `tests/e2e/performance.spec.js` — the three BUILD-PLAN numbers, on a
  2,000-entry dataset, in a project that runs alone.
- `tests/e2e/keyboard.spec.js` — ten tests that use no pointer at all: every
  screen, a complete entry through the quick-add row, the sheet contract, the
  stacked sheet, the row menu, the chart bands, typed dates.
- `tests/e2e/dist.spec.js` — unpacks the built zip somewhere else and drives
  that copy offline: the manifest carries no workbook, no test and nothing of
  yours; it first-runs, logs, exports and survives a reload in silence.
- `perfState()` (2,000 entries) beside the existing stress dataset.
- Unit tests for the category/goal deletion rule and for reject row numbering.

## Where it stands

- **439 unit tests**, **462 e2e** across Chromium and Edge, **4 timed**, all green.
- The responsive matrix runs 13 widths × 3 themes × 6 screens × 23 states, and
  the zoom matrix walks the same states at 90/125/150 %.
- `dist/meridian-v1.zip` — 0.53 MB, 55 files, verified by test to contain the
  app, the licences, the tester README and an empty `data` folder, and none of
  your own data.
