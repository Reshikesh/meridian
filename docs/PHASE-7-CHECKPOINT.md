# Phase 7 Checkpoint — Publication — 4 September 2026

No features. Nothing fixed except what publishing required. Decisions 28 and 29
were settled by the owner before the phase opened and are in `DECISIONS.md`.

## 1. Version (decision 28)

The `'1.1.0'` literal that lived inside `src/core/workbook.js` is now
`src/core/version.js`, loaded before every other core module. The workbook
stamps that constant into every export's `Meta.app_version` rather than a copy
of its own.

It shows in three places, all reading the one constant:

| Where | String | Style |
|---|---|---|
| Data sheet, idle footer | `MERIDIAN 1.1.0` | `.t-label` |
| First-run screen, below the three choices | `MERIDIAN 1.1.0` | `.t-label` |
| Header wordmark | `title="Meridian 1.1.0"` | attribute only |

Nothing else in the header changed.

`package.json` was reconciled from `1.0.0` to `1.1.0` — v1.1.0 had not shipped
and the changelog and workbook already said 1.1.0, so the manifest was simply
behind. Not a bump. One line was added under v1.1.0 in `dist/CHANGELOG.md`.

`tests/unit/version.test.js` binds the copies together: the constant, the
`package.json` version, and the changelog's first `## v` heading, plus the
display strings and a real round-tripped export's `Meta.app_version`. A bump
that misses one of them goes red.

## 2. Vendor check

All twelve recorded sha256s were recomputed from the working tree and **all
twelve match**. Because neither Preact UMD build carries a version string
inside it, a local hash only proves the file is unmodified — not which release
it is — so the four libraries were additionally re-downloaded from their pinned
source URLs and compared byte-for-byte.

| File | Version | Source URL | Recorded sha256 | Recomputed | Upstream |
|---|---|---|---|---|---|
| `preact.umd.js` | 10.29.8 | `unpkg.com/preact@10.29.8/dist/preact.umd.js` | `134b77bc…80b06` | match | match |
| `hooks.umd.js` | 10.29.8 | `unpkg.com/preact@10.29.8/hooks/dist/hooks.umd.js` | `5c29238e…a0566` | match | match |
| `htm.umd.js` | 3.1.1 | `unpkg.com/htm@3.1.1/dist/htm.umd.js` | `7a31776e…94f08` | match | match |
| `xlsx.full.min.js` | 0.20.3 | `cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js` | `cc015130…a6f41` | match | match |
| `fonts/archivo-latin-400.woff2` | Archivo v25 | `fonts.gstatic.com/s/archivo/v25/…` | `07f91601…0056e` | match | — |
| `fonts/archivo-latin-500.woff2` | Archivo v25 | `fonts.gstatic.com/s/archivo/v25/…` | `ab74eca5…d17cf` | match | — |
| `fonts/archivo-latin-600.woff2` | Archivo v25 | `fonts.gstatic.com/s/archivo/v25/…` | `d9e8c29f…a67e8` | match | — |
| `fonts/archivo-latin-700.woff2` | Archivo v25 | `fonts.gstatic.com/s/archivo/v25/…` | `abada6cd…d2a04` | match | — |
| `licences/preact-LICENSE.txt` | — | `unpkg.com/preact@10.29.8/LICENSE` | `1fe69584…4b7d4` | match | — |
| `licences/htm-LICENSE.txt` | — | `unpkg.com/htm@3.1.1/LICENSE` | `740725f7…ce00f` | match | — |
| `licences/sheetjs-LICENSE.txt` | — | `cdn.sheetjs.com/xlsx-0.20.3/package/LICENSE` | `4d2a38ac…e01f64` | match | — |
| `licences/archivo-OFL.txt` | — | `raw.githubusercontent.com/google/fonts/…/OFL.txt` | `108b4e57…b716b` | match | — |

**CVE-2026-22028 (GHSA-36hm-qxxp-pg3m): not applicable.** It affects Preact
10.26.5–10.28.1, patched in 10.26.10, 10.27.3 and 10.28.2. Meridian vendors
**10.29.8**, above the affected range — and 10.29.8 is npm's current `latest`
dist-tag, so there is no newer 10.x to move to. Established from the bytes, not
from the table. **No re-vendoring was required and none was done.** htm 3.1.1
and SheetJS 0.20.3 are unchanged, as instructed.

## 3. Code greps

Across `index.html`, `src/`, `seed/` and `styles/`:

| Pattern | Hits |
|---|---|
| `innerHTML` | 0 |
| `dangerouslySetInnerHTML` | 0 |
| `eval(` | 0 |
| `new Function` | 0 |
| `document.write` | 0 |
| `http://` | 0 |
| `https://` | 0 |

Nothing to justify and nothing to remove. The expectation was "none in `src/`";
the result is none anywhere in the four trees, including the vendor-free source
comments — every URL in the project lives in `docs/`, `vendor/README.md` or
`tests/`, none of which ships in the zip.

## 4. History and identity scan — reported, not fixed

**Every path ever committed** (132 distinct), filtered to the flag list —
`.xlsx`, anything under `data/` beyond the placeholder, `tests/e2e/shots/`,
`.claude/`, `node_modules`, `test-results`, `playwright-report`, `.env`, any
zip:

```
data/README.md
```

That is the tracked placeholder itself, which is the one permitted entry.
**Nothing else on the flag list has ever been committed.**

**Machine paths carrying a username**, `git grep -n -i -E "Users\\|/Users/|C:\\"`
across `$(git rev-list --all)` and the working tree:

```
Binary file design/Meridian-Redesign-Screens.pptx matches
```

One hit, in every revision that contains the design deck. It is **not a path**:
the deck was unpacked and every part searched, and the only match is a
case-insensitive `c:\` inside the compressed pixel data of
`ppt/media/image-4-3.png`. No `Users\` or `/Users/` appears anywhere in the
repository, in any revision.

**Author identities that would become public:**

```
Reshikesh <[redacted]>
```

One identity, the owner's own. **This is the one item that needed a decision**,
because it is on all five pre-Phase-7 commits and becomes permanent the moment
the repository is public. The owner chose a GitHub noreply address.
`git config user.email` was set to `22979164+Reshikesh@users.noreply.github.com`
locally, so **every Phase 7 commit already carries it**; the five older commits
could not be re-authored from inside the session, because both `git
filter-branch` and `git rebase --root --exec` are refused by the environment's
command classifier as history rewrites. That rewrite is handed to the owner as a
single command and **must be run before the repository is made public**.

Nothing was rewritten or filtered without instruction.

## 5. `.gitignore`

Every entry on the checklist is present. Two existing rules are deliberately
broader than the checklist asks and were kept: `.claude/` (the checklist names
only `.claude/settings.local.json`) and `data/*` with `!data/README.md` (the
checklist names only `data/*.xlsx`). Narrowing either to match a list would have
published local agent state and any non-`.xlsx` export. The specific lines were
added as well, so the file reads as satisfying the checklist.

`dist/meridian-v1/` became `dist/meridian-*/`, because the stage folder is now
named from the version.

**Nothing on the list was tracked**, so there was no `git rm --cached` to do.
`.gitattributes` is unchanged.

## 6. Licence

`LICENSE` — MIT, `Copyright (c) 2026 RESH`. `"license": "MIT"` in
`package.json`. The README's licence section points at both `LICENSE` and
`vendor/README.md`, and names the third-party licences: Preact MIT, htm
Apache-2.0, SheetJS Apache-2.0, Archivo OFL-1.1, with full texts in
`vendor/licences/`.

## 7. README

Rewritten at the root for a reader who has never seen the project. The previous
file was the owner's build-time handoff — "paste the Phase 0 prompt" — which was
the first thing a stranger would have read. That process was not lost; it lives
in `docs/BUILD-PLAN.md` where it always did.

Sections: what Meridian is and why; the screenshot; Get it; the five screens;
Your data (browser storage, what loses it, export regularly, and the `file://`
shared-origin caveat); Browsers; Version; the SheetJS scanner note; For
developers; Licence.

`docs/readme/log.png` is the only committed screenshot — Log, paper, 1280 px,
generated by `shots.spec.js` rather than cropped by hand, at a 620 px height so
that a three-entry demo Sunday does not leave a third of the frame empty.

`dist/README-for-tester.md` is unchanged, as instructed.

**One deviation from the brief, deliberate.** The scope asked for the developer
commands `npm ci`, `node --test` and `npx playwright test`. Written plainly at
the root, two of the three do not work: `npm ci` fails with `ENOLOCK` because
the app has zero dependencies and therefore no lockfile, and `npx playwright
test` finds neither Playwright nor a config, both of which live in `tests/e2e`
so the app stays dependency-free. A README for strangers whose commands error on
the first paste is worse than no README, so the three commands are kept and
scoped: `node --test` with its quoted glob at the root, and `npm ci`,
`npx playwright install chromium` and `npx playwright test` from `tests/e2e`,
with one line saying why they live there.

## 8. `npm audit`

```
=== npm audit (root) ===
npm error code ENOLOCK
npm error audit This command requires an existing lockfile.
npm error audit Try creating one first with: npm i --package-lock-only

=== npm audit (tests/e2e) ===
found 0 vulnerabilities
```

The root `ENOLOCK` is the correct result, not a failure: the app has zero
dependencies and therefore no lockfile. The only dependency tree in the project
is `tests/e2e`, which audits clean. **Nothing was upgraded**, so
`@playwright/test` stays at 1.62.1.

## 9. Package

`dist/meridian-1.1.0.zip` — **0.56 MB, 61 files** (60 before; `version.js` is
the new one). The name comes from the version constant in both the packaging
script and `dist.spec.js`, reached through `createRequire` in the ESM script, so
the two cannot disagree about which file to look for. The stage folder follows
the same name.

The zip is **untracked**, confirmed against `.gitignore:16` (`dist/*.zip`), per
decision 29.

## 10. Test results

| Suite | Result |
|---|---|
| `node --test` (unit) | **518 / 518** |
| Playwright, Chromium (e2e) | **255 / 255** |
| Edge | not run |
| Firefox | not run — deferred by instruction |
| Safari | no project exists |

The responsive and zoom matrices are **108 of those 255**, all green in all
three themes:

| Matrix | Tests | Axis |
|---|---|---|
| `responsive.spec.js` | 39 | 13 widths (345–1920, each also −15 px) × 3 themes, every screen and 15 transient states |
| `zoom.spec.js` | 45 | 5 widths × 3 zooms (90 %, 125 %, 150 %) × 3 themes |
| `firstrun.spec.js` width matrix | 24 | 8 widths × 3 themes — the one screen the main matrix cannot reach, because the shell only exists once there is data |

**The two new version strings sit inside audited states**, so the no-overlap,
no-clipping and no-page-scroll checks covered them at every width in every
theme: the Data sheet footer is the `sheet-data` state in `responsive.spec.js`,
and the first-run line is the whole subject of the `firstrun.spec.js` matrix.
Both stay green at 345 px, the narrowest width in the suite.

### On flakiness, honestly

The first two full runs each reported **one or two failures that passed on an
isolated re-run** — first `360px / graphite` and `360px / blueprint` in
`responsive.spec.js`, then `smoke.spec.js` "theme persists across reload with no
flash". They were not the same tests twice, and the first pair coincided with an
`npm audit` that hung for two minutes alongside the run.

Rather than assert "flake" from re-runs, the suite was run again with
`--retries=2`, which makes Playwright classify the two cases apart: a test that
fails then passes is reported as **flaky**, a test that fails throughout is
**failed**. That run returned **255 passed, nothing flaky and nothing failed** —
no retry was consumed at all. The earlier failures were contention on this
machine, not a regression. Recorded here because "it passed the second time" is
not evidence on its own.

`docs/DECISION-LOG.md` #16 already notes that Playwright's Firefox and
full-Chromium binaries cannot launch on this machine; heavy parallel load is the
same underlying fragility.

## 11. What the owner switches by hand

The phase deliberately stops short of all four:

1. **Dependabot alerts** — Settings → Code security → Dependabot alerts.
2. **Secret scanning** — Settings → Code security → Secret scanning.
3. **Push protection** — the same panel, under secret scanning.
4. **Visibility → Public** — Settings → General → Danger Zone. **After** the
   commit re-authoring in §4, not before.

## Known gaps

- **The pre-Phase-7 commits still carry `[redacted]`.** The rewrite command is in the report and in §4. This is the one item that blocks going public. **Corrected 4 Sep 2026:** this report said "five" throughout; `git log --author` counts **23** of the 30 commits, the other 7 being Phase 7's own. The rewrite has to cover all 23.
- **Edge is untested on v1.1.0.** It failed with exit 4 on the Phase 6 run and was not re-attempted here. It passed on v1.0.0, which is what the README says.
- **Firefox is untested and deferred**, by instruction. Its Playwright project remains gated behind `MERIDIAN_FIREFOX` and was not touched.
- **Safari is untested.** No WebKit project exists in the config.
- ~~**`dist/README-for-tester.md` says "Firefox works too".**~~ **Closed 4 Sep 2026** in the range-pick fix below: it now carries the root README's wording — machine-tested in Chromium, Edge passed on v1.0.0, Firefox and Safari untested.
- The four confirmed findings from `docs/PHASE-5-AUDIT.md` are unchanged; none is a publication blocker.

## Questions for the owner

None. Decisions 28 and 29 covered the phase; the one open item — the commit
identity — was answered before the build started.

---

# Fix after Phase 7 — range pick — 4 September 2026

No features. Two defects on one screen, one line in the tester README, and
v1.1.0 re-cut on the same private remote. Decision 30 was settled by the owner
before the work opened and is in `DECISIONS.md`, with its amendment.

## 1. Pre-flight

```
git config user.email  ->  22979164+Reshikesh@users.noreply.github.com
git status             ->  working tree clean
git fetch origin; git status -sb  ->  ## main...origin/main  (96d96a9 == origin/main)
git log --format='%ae %ce' | sort -u
  22979164+Reshikesh@users.noreply.github.com  x2
  [redacted]                            x2
```

Two identities, as expected. **Section 4 of the report above says the gmail
address is on five commits; it is on 23 of 30.** The rewrite the owner runs
before going public has to cover all 23. Corrected in Known gaps above and in
`DECISION-LOG.md` #238. No history was rewritten here.

## 2. Reproducing it

The report named a theme, a browser and a zoom that were left blank, and
suspected motion, so nothing was assumed. **78 configurations** were swept
before a line of source was touched: five datasets by nine preceding actions,
nine viewport widths, three stored ranges, motion on and off, Chromium and
Edge.

**Motion is not the variable.** Every path behaves identically with
`reducedMotion` on and off. Neither is width, dataset, theme, browser, nor a
stored `meridian:range`. Exactly one path fails, and it fails everywhere:

| step | rail | heading |
|---|---|---|
| landed default | `14 DAYS` | 186.5 hours logged |
| click 2 Jun — pick opens | `PICK END DAY` | Pick the second day. |
| to Log, then back to Where it went | `PICK END DAY` | Pick the second day. |
| **the owner's click #1** | undo shown | **50.5 hours logged** — *it lands* |
| **the owner's click #2** | `PICK END DAY` | **Pick the second day.** — *it anchors* |

Reproduced via Log, Goals, Progress and Lessons, in Chromium and in Edge.

## 3. Root cause

`app.js` holds the Where-it-went view outside the screen so a range, an undo or
a split is not lost on the way to Log and back (`DECISION-LOG.md` #117) — and
the pending pick was held with it. `range.pick` then correctly read
`view.pending === true` on the next click and **landed the stale anchor**
against the day the owner meant to start a new range with. The click after it
anchored. Every click from then on was off by one: land, anchor, land, anchor.

**Both reported symptoms are that one cause.** (A) "the second click does not
land" is the click that anchored. (B) "the old figures stay on screen during a
pick" is the full set of figures the *first* click painted by landing — a range
the owner had not chosen, appearing where they expected a blank waiting state.

**Nothing regressed, and #173 was never wrong.** `src/core/range.js` is
byte-unchanged since `156c7bd` (Phase 4), where #173 moved the anchor out of
`range`. The defect is in what survives a screen change, which is `app.js`. The
staged `dist/meridian-1.1.0/` is byte-identical to `src/`, so the owner was not
running an older artefact either.

**Defect (B) does not exist separately.** Every other clause of decision 30 was
already built and was verified running: blanked hours, donut at zero, no split
caption, no coverage note, no ribbon, no lit preset, no calendar heat, the
anchor marked as a range start, Escape restoring with no undo, and the anchor
day clicked twice landing a one-day range. The two deliberate deviations from
the wording of decision 30 are recorded in `DECISIONS.md`.

## 4. Why 255 passing tests missed it

"Where it went" is the default screen. Every existing test reaches it with
`page.goto` and never leaves it, so **#117's guarantee had no test at all**, in
either direction. `went.spec.js` already covers the two-click pick, the third
click and the swap — all of them pass, and all of them pass on the unfixed
build too. The responsive and zoom matrices walk between screens constantly, but
they audit layout, not the picker's state.

The suite had also never run with motion enabled: `playwright.config.js` sets
`reducedMotion: 'reduce'` globally, which the Phase 5 audit had noted.

## 5. The fix

| file | change |
|---|---|
| `src/core/range.js` | `pick()` clears the focus on the first click (decision 30). `abort()` documented as the transition for a dropped pick, and it returns an idle view by identity. |
| `src/ui/app.js` | `goToScreen` abandons an open pick **on arrival** at `went`. |

Abandoning on arrival rather than on departure is the same rule and the same
observable behaviour — the screen is never entered on a half-made pick — but a
`requestAnimationFrame` sampler taken during the fix showed why it matters:
`screen-out` holds **opacity 1 for its first ~77 ms**, so abandoning in the
departing click made the leaving copy visibly snap from the pending panel back
to the ribbon, and `PICK END DAY` back to `14 DAYS`, before the screen had begun
to go. Sampled again after the change, the leaving copy holds the pending panel
to opacity 0.001. It also cannot be outrun by navigating away and back inside
the 120 ms, which a timer hung on the fade could (`DECISION-LOG.md` #232).

## 6. Tests

| suite | before | after | added |
|---|---|---|---|
| `node --test` (unit) | 518 | **524** | 6 |
| Playwright, Chromium | 255 | **269** | 14 |

**The 255 that existed are unchanged in number and all still pass.** One
existing assertion changed meaning rather than count: `range.test.js` asserted
that a band focus survives a two-click pick, which decision 30 reverses.

`tests/e2e/went-pick.spec.js` is new — 14 tests, and the first in the project to
run with `reducedMotion: 'no-preference'`. Every test in it reaches the screen
through the nav from Log rather than by `goto`, which is the gap section 4
names. It is a `test.use` inside the one file rather than a new project, so the
existing tests keep running exactly as they did.

Against the **unfixed** build it reported **5 failed, 9 passed**:

```
FAIL  a pick works with a band focused, and the focus does not survive it
        .ribbon__band--on   expected 0, received 1
FAIL  a pick is dropped by leaving for log,      so the next click anchors
FAIL  a pick is dropped by leaving for goals,    so the next click anchors
FAIL  a pick is dropped by leaving for progress, so the next click anchors
FAIL  a pick is dropped by leaving for lessons,  so the next click anchors
        .rail__days         expected "14 DAYS", received "PICK END DAY"
```

The nine that passed are the guard: they are what decision 30 already had.

**The full Chromium run was clean on the first attempt — 269 passed in 7.5 min,
no retries consumed and none needed.** The responsive and zoom matrices are 108
of those 269, green in all three themes at every width and zoom.

`went-pending` **was already a matrix state** and has been since Phase 3, so the
pending state was already audited for overlap, clipping and page scroll at every
width, zoom and theme. It was verified rather than added twice. What it had
never been checked for is what it *says*, which is now `expectPending()` in the
new file — the whole of decision 30 as one assertion, run in eleven tests.

`QUALITY-BAR.md` section 2 names no list of states (only "every screen and sheet
open"), so there was nothing there to add `went-pending` to, and it is unchanged.

## 7. Package

`dist/meridian-1.1.0.zip` — 0.56 MB, 61 files, unchanged in shape. `dist.spec.js`
passes against it: it carries the fix and the corrected tester README, and its
`src/` is byte-identical to the working tree. The zip is **untracked**, confirmed
against `.gitignore:16` (`dist/*.zip`), per decision 29.

## 8. Docs

`DECISIONS.md` — decision 30 and its amendment, including the two deviations.
`DECISION-LOG.md` — #229 to #238. `dist/CHANGELOG.md` — a **Fixed** entry for
the stale pick and a **Changed** entry for the cleared focus, both under v1.1.0.
`dist/README-for-tester.md` — the "Firefox works too" line now carries the root
README's wording, which closes the Known gap above.

## 9. The re-cut

v1.1.0 is re-cut on the commit this report lands in. The old draft release and
the old `v1.1.0` tag are deleted local and remote first; the new annotated tag
is pushed and a fresh **draft** release is created with the v1.1.0 changelog
section as its notes and the zip as its one asset. The repository stays
**private** and the release stays **unpublished** — both were verified as such
before anything was deleted.

## Known gaps

- **The 23 pre-Phase-7 commits still carry `[redacted]`.** Unchanged by
  this work, and still the one item that blocks going public.
- **Edge is untested on v1.1.0 as a suite.** It was driven by hand during the
  investigation, where it reproduced the defect and then the fix, but the
  `msedge` project was not run.
- **Firefox and Safari remain untested**, as before.
- **The cross-fade artefact is recorded, not tested.** An assertion that the
  leaving copy still reads `PICK END DAY` would have to catch a 120 ms window,
  which is the kind of timing-dependent check section 10 of the report above
  argues against. It was measured, fixed and written up instead.
- **A pick left open on another screen is dropped silently.** Nothing tells the
  owner it went; the screen simply opens on the range it had. That is what
  decision 30 asks for, and the alternative — a line in the rail saying a pick
  was discarded — is copy in neither the spec nor the mockup.
- The four confirmed findings from `docs/PHASE-5-AUDIT.md` are unchanged.

## Questions for the owner

None. Decision 30 and its three sub-answers were settled before the work opened.
