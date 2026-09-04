# Meridian v1 — build plan

Six phases, each its own Claude Code session, each ending at a checkpoint where the owner looks at the result before the next phase starts. Scope is deliberately narrow per phase; the acceptance criteria in `MERIDIAN-SPEC-v1.1.md` §12 and `QUALITY-BAR.md` apply to everything touched.

## How the owner runs a phase

1. Open a terminal in the project folder and start Claude Code.
2. Paste the phase prompt below. Claude Code must answer with a plan first; read it, approve it (or correct it), then let it build.
3. At the checkpoint, double-click `index.html` in Chrome and in Firefox, do the listed checks, and write feedback as a numbered list: what you saw, what you expected, which screen, which width or theme. Paste it back. Repeat until the checkpoint passes.
4. Say "phase N accepted" so it commits, then start a new session for the next phase.

Never let a phase absorb the next one's scope. If something is missing that belongs to a later phase, say "later phase" and move on.

---

## Phase 0 — Scaffold, shell, tokens, tests harness

**Prompt**
```
Phase 0. Read CLAUDE.md and docs/BUILD-PLAN.md § Phase 0, then docs/QUALITY-BAR.md. Produce a plan (file list, what each contains, how tests run) and wait for my approval before writing anything.
```

**Scope**
- Repository layout per `CLAUDE.md`; `.gitignore`; `git init` with an initial commit.
- Vendor Preact 10, preact/hooks, htm, SheetJS (pinned), Archivo woff2 + OFL; `vendor/README.md` with versions, URLs, licences.
- `index.html` shell: pre-paint theme script; `styles/tokens.css` with the three themes verbatim from spec §5; base and component styles for header, nav, theme toggle, date/week stamp, buttons, tables, stat blocks, sheet frame, inputs, empty state.
- App root with the six nav items and screen switching (`data-screen`), theme switching with persistence, header date/week stamp from the real clock with the 04:00 boundary. Screens are empty frames with a designed empty state; Plan/Progress/Lessons show the "coming after your first full week" state (decision 4).
- Test harness: `node --test` running one real test (dates.js: boundary at 03:59/04:00, ISO week across New Year); Playwright with a smoke test (opens via `file://`, switches all screens and themes, no console errors) and the responsive matrix runner from QUALITY-BAR §2 producing screenshots.

**Acceptance**
- Opens by double-click in Chrome and Firefox from `file://`, offline, with zero console errors and zero network requests.
- Header, nav and theme toggle match `deck-01-log.png` at 1280 px pixel-for-pixel in proportion; all three themes switch and persist across reload with no flash.
- Responsive matrix passes on the empty shell at all widths.

**Checkpoint (owner)**: open it offline, switch themes, resize the window from wide to narrow; nothing overlaps; reload keeps the theme.

---

## Phase 1 — Core logic, store, workbook import/export, first run, seed

**Prompt**
```
Phase 1. Read CLAUDE.md and docs/BUILD-PLAN.md § Phase 1, then spec §7, §8, §9, §10 and DECISIONS 2, 5, 9, 13, 15, 17, 20. Plan first, wait for approval.
```

**Scope**
- `src/core/`: dates (boundary, ISO weeks, date parsing per spec §3), aggregate (per day / week / range, waking-hours denominators, direction split, category and goal totals), projection (banked, pace, required, landing date, slippage, "not enough history" rule = fewer than 7 logged days), validate (entry, category, goal, workbook rows), workbook (objects ↔ sheets, `Meta` with `schema_version`, `app_version`, `exported_at`).
- `src/store.js`: state shape, reducers for entries/categories/goals/settings, synchronous localStorage persistence, unexported-changes counter, `beforeunload` hook.
- Import (file picker and drag-and-drop anywhere on the first-run screen and on a header action) with the validation report UI; export as `meridian-data-YYYY-MM-DD.xlsx`; replace/keep prompt when local data exists (decision 15).
- First-run screen: Import workbook / Start with demo data / Start empty. Demo badge and Start-fresh action.
- `seed/seed.js`: the §9 [P] dataset with dates relative to first run; totals internally consistent; two hours-only goals (decision 20).
- Unit tests for every core function; round-trip test (import(export(state)) deep-equals state); validation tests with malformed rows.

**Acceptance**
- All unit tests pass; round-trip is exact; a workbook with 3 malformed rows imports the rest and lists the 3 with sheet, row and reason.
- Exported file opens in Excel as clean tables (header row, no formulas, ISO text dates, integer minutes).
- First-run flow works in all three paths; reload after each shows the same state; the unexported indicator counts correctly and clears on export.

**Checkpoint (owner)**: start with demo data, export, open the workbook in Excel, change one activity text and one duration, import it back, confirm the change shows and the validation report reads sensibly. Then break a row on purpose (letters in the minutes column) and import again.

---

## Phase 2 — Log screen, New entry sheet, Manage categories, New category sheet

**Prompt**
```
Phase 2. Read CLAUDE.md and docs/BUILD-PLAN.md § Phase 2, then spec §1–§3 (Log and the three sheets), §4f, §6 (Log, New entry, New category, Manage), §12 (Log, Manage categories) and DECISIONS 10, 17, 19, 21. Plan first, wait for approval.
```

**Scope**
- Log: day header with waking-hours copy, ← → day paging (past days editable, future days not selectable), entries table without the VALUE column, `…` row menu with edit and delete (edit reuses the entry sheet), week bar strip (18 h scale, today in `--brand`), "LOGGED THIS WEEK x/112 h".
- Quick-add row: duration (accepts `1.5`, `1.5h`, `90m`), activity, category dropdown; Enter commits from any field; clears and refocuses duration after commit; validation inline.
- New entry sheet: HOW LONG presets + Other (numeric input), ACTIVITY optional, COUNTS TOWARD goal picker that fills and locks the category with "Change" to unlock, SAVING THIS MOVES preview (banked and landing before → after, or "no projection yet" when history is short), Cancel / Save entry. Same sheet in edit mode with the current values.
- Manage categories sheet: list with direction, this-week hours, share of 112 h bar, edit (rename in place, colour, direction, planned hours), archive with inline confirm when hours exist, restore, delete only at zero hours; footer copy verbatim. New category sheet without COUNTS TOWARD.
- Sheet behaviour per QUALITY-BAR §4 (Escape, veil click, focus trap, return focus, stacked category sheet returns to its origin sheet).
- Playwright: log an entry both ways, edit it, delete it, archive/restore a category, day paging, plus the responsive matrix with each sheet open.

**Acceptance**: spec §12 Log and Manage categories criteria; QUALITY-BAR §1–§5 for everything touched; fidelity check against `deck-01-log.png`, `deck-07-sheet-entry.png`, `deck-09-sheet-category.png`, `deck-10-sheet-manage.png`.

**Checkpoint (owner)**: log a whole real day using only the keyboard through the quick-add row; then use the sheet to log against a goal; edit one entry; delete one; page back a day; archive a category that has hours and restore it; resize the window with the entry sheet open.

---

## Phase 3 — Where it went

**Prompt**
```
Phase 3. Read CLAUDE.md and docs/BUILD-PLAN.md § Phase 3, then spec §3 (calendar, presets, undo, typed dates, band click), §4a–§4d, §6 (Where it went), §12 (Where it went) and DECISIONS 17, 18. Plan first, wait for approval.
```

**Scope**
- Left rail: Monday-first calendar with month bands from the first entry date to today, two-click range, presets 30D / 90D / YTD / ALL, typed dates with the mockup's parsing and silent-revert-with-flash, undo for 6 s, focus ring per input, hover day numerals, future days unselectable, `meridian:range` persistence.
- Header: hours logged, coverage donut (waking-hours denominator), direction split bar with caption.
- Ribbon chart ported exactly from spec §4c (`layout()`, colours, opacities, goal split with the real per-entry goal attribution instead of the mockup's synthetic hash; "No goal" band), SPLIT Category/Goal, SORT Descending/Ascending, band click → calendar heat per §4d, legend footer.
- Empty and degenerate states: empty range, one category, archived categories present in history but not in pickers.
- Unit tests for aggregate-by-range and `layout()`; Playwright for the full interaction table and the responsive matrix (the chart and calendar must reflow, not overflow).

**Acceptance**: spec §12 Where it went criteria; QUALITY-BAR §1–§3, §7 (chart re-render on theme switch); fidelity against `deck-02-went.png`.

**Checkpoint (owner)**: with demo data, click a 30-day range, click a band, change the range, hit undo, type `7/6` and a nonsense date, switch all three themes with a band focused; then narrow the window until the layout stacks.

---

## Phase 4 — Goals screen, New goal sheet, projections in the entry sheet

**Prompt**
```
Phase 4. Read CLAUDE.md and docs/BUILD-PLAN.md § Phase 4, then spec §4h, §6 (Goals, New goal), §8 rules 2–5, §12 (Goals) and DECISIONS 14, 20. Plan first, wait for approval.
```

**Scope**
- Goals table: identity line, short name, target, by-date, progress bar, lands (date and ± days), "weeks running" streak, ghost row, footer copy verbatim; archive goal via row menu (keeps hours), edit goal (reuses sheet).
- New goal sheet: I WANT TO BECOME, SHORT NAME, FED BY (More categories only), HOURS NEEDED, BY, IS THAT REACHABLE panel from real pace history (or the honest "no history yet" line), "Date changes take effect next week" note, Cancel / Create goal.
- Projection wired end-to-end: entry sheet's SAVING THIS MOVES and the Goals table use the same `src/core/projection.js`.
- Tests: projection edge cases (zero pace, target already reached, by-date passed), Playwright for create/edit/archive and the responsive matrix.

**Acceptance**: spec §12 Goals criteria; QUALITY-BAR; fidelity against `deck-04-goals.png` and `deck-08-sheet-goal.png`.

**Checkpoint (owner)**: create a goal fed by Learning, log two hours against it, confirm the table and the entry-sheet preview agree, then create a goal with a past date and a zero-hour target to see both rejections.

---

## Phase 5 — Polish gate and packaging

**Prompt**
```
Phase 5. Read CLAUDE.md and docs/BUILD-PLAN.md § Phase 5, then docs/QUALITY-BAR.md in full. Plan first, wait for approval. This phase adds no features.
```

**Scope**
- Full QUALITY-BAR audit, section by section, with a written report: every failure fixed or listed.
- Responsive matrix at all widths, zooms and themes with every sheet open; overlap/overflow checks green; screenshots reviewed.
- Keyboard audit: whole app usable without a mouse; focus order sensible; focus-visible rings consistent.
- Theme audit: swatch contrast on graphite (outline rule), text contrast table.
- Long-content audit per QUALITY-BAR §2 last bullet, using a generated stress dataset.
- Performance: 2,000 entries load in under 200 ms to first render; range change under 100 ms; no jank in sheet animations (measured with the Performance panel).
- Optional if all above is green: Chromium File System Access "Link workbook" direct save, as an enhancement that never replaces export.
- Packaging: `dist/meridian-v1.zip` containing the app (no tests, no docs except the tester README), `dist/README-for-tester.md` (how to open, browsers, the 04:00 rule, logging tips, export every evening to `data/`, what feedback is wanted and how to send the workbook back), and a `dist/CHANGELOG.md`.

**Acceptance**: QUALITY-BAR §8 definition of done for the whole app; the zip opens on a machine that has never seen the project.

**Checkpoint (owner)**: unzip on another computer or user account, open offline, run through one day exactly as the friend would, using the tester README only. Then hand it over.

---

## Phase 6 — Lessons, Progress, and the end of Plan

Decisions 25, 26 and 27 (3 Sep 2026) reshape the three deferred screens into
things a friend can use in a few days, so they ship before the handover rather
than after it.

**Prompt**
```
Phase 6. Read CLAUDE.md and docs/BUILD-PLAN.md § Phase 6, then DECISIONS 25–27, spec §4e and §6 (Progress, Lessons), and decision-log 177–192. Plan first, wait for approval.
```

**Scope**
- Plan (decision 26): remove the nav item — five screens; `states.js`, the header, the matrix and the keyboard spec follow. The Manage row's THIS WEEK column says `{n} h over cap` when a Less category is past its planned hours. The Plan workbook sheet still round-trips; nothing reads it.
- Lessons (decision 25): `src/ui/lessons.js`. Cards sized by content, in a wall that fills the space left under the header: pinned first, then a fill that rotates newest → oldest → random per visit, with a caps label naming the mode that advances it on click; a layout effect trims from the end until nothing overflows, and pinned cards are never trimmed (the wall scrolls if they alone overflow). Search over title, text and tags shows every match. A New lesson sheet (optional title, text, optional tags to a goal or category); edit, pin, archive and delete via the `…` menu with inline confirm; a *View archived* switch showing restore and delete-for-good. Store reducers for lessons; `title`, `pinned`, `archived` in the Lessons sheet, older workbooks importing untitled, unpinned and live. A designed empty state. Copy is new, in the app's voice.
- Progress (decision 27): `src/ui/progress.js`. One chart, every live goal a line in its category's colour (a second goal in the same category dashed): banked history solid to today, projection on to the landing, target marked, the warn band when late, axes auto-ranged over every goal, with the vertical axis in percent of target so a 60-hour and a 130-hour goal read against the same line. A goal list beside the chart (above it below 1024 px) with colour, name, banked/target, pace, lands ± days, and a switch per goal; the headline reuses the Goals screen's count ("Two open. One slipping."); the explainer line (decision 12) under the chart. No goals → a line saying so; a reached goal keeps its history and projects nothing. No levers. In core: an early-estimate mode in `projection.js` (from the second distinct logged day to the sixth: banked ÷ days × 7, flagged `early`), a `series()` for each goal's cumulative points, and a pure, tested chart layout beside `ribbon.js`. The Goals table, the goal sheet's reachability and the entry sheet's preview all take the early estimate and its label from the same call.
- Tests: unit for the early-estimate rule, the series and the chart layout, including zero pace, target reached, date passed, one logged day; Playwright for lessons (create with and without a title, pin, search, the rotating fill and its trim, archive, view archived, delete for good) and progress (early, settled, reached, late, no goals, a goal switched off, two goals in one category); matrix states for both screens and the lessons sheet; `dist.spec.js` against a re-cut zip.
- Docs: README-for-tester and CHANGELOG updated for five screens; decision log.

**Acceptance**: QUALITY-BAR §8 for the two new screens; the same landing date and label on Goals, the goal sheet, the entry sheet and Progress for any goal; fidelity against `deck-03-progress.png` for layout and tokens, with the copy computed; the responsive and zoom matrices green with the new states; the zip re-cut and `dist.spec.js` green.

**Checkpoint (owner)**: start fresh. Write three lessons, one without a title; pin one, archive one, find the third by search, then view the archived one and delete it for good. Create two goals, log against both on two different days, open Progress and read both lines and the early-estimate label; switch one goal off. Import a workbook with a week of entries against it and watch the label go. Set a Less category's planned hours below what you have logged this week and find "over cap" in Manage.

## Phase 7 — Publication

The repository goes to GitHub as a private repo named `meridian`, v1.1.0 tagged
and a draft release carrying the zip; the owner flips it to public by hand. No
features, and nothing fixed except what publishing requires. Decisions 28 and 29
were made at the start of the phase and are recorded in `DECISIONS.md`.

**Prompt**
```
Phase 7 — publication. Read CLAUDE.md, docs/QUALITY-BAR.md §8, docs/DECISIONS.md, the tail of docs/DECISION-LOG.md and docs/PHASE-6-CHECKPOINT.md. Plan first, wait for approval. Firefox is deferred: do not test it, do not touch its config, and never say it was tested.
```

**Scope**, one commit per item.
1. **Version** (decision 28): the literal in `workbook.js` lifted into `src/core/version.js`, loaded first; shown in the Data sheet footer, on the first-run screen and as the wordmark's `title`. A unit test binds the constant to `package.json` and to the changelog's first `## v` heading. Matrix states for first run and the Data sheet stay green in all three themes.
2. **Vendor check**: every vendored library's version, source URL and recorded sha256 reported and recomputed. Preact checked against CVE-2026-22028 (affects 10.26.5–10.28.1) and re-vendored if in range. htm and SheetJS 0.20.3 stay. Outcome logged either way.
3. **Code greps** across `index.html`, `src/`, `seed/`, `styles/`: `innerHTML`, `dangerouslySetInnerHTML`, `eval(`, `new Function`, `document.write`, `http://`, `https://`. Every hit justified in one line or removed.
4. **History and identity scan**, reported and never fixed unasked: every path ever committed, machine paths carrying a username across all revisions and the working tree, and every author identity that would become public. Anything flagged stops the phase for the owner. History is never rewritten without instruction.
5. **`.gitignore`** covers node_modules, test output, workbooks, zips, local agent state, editor and OS litter; anything on the list that is tracked is `git rm --cached`.
6. **LICENSE** (MIT, decision 29), `"license": "MIT"` in `package.json`, and a README licence section pointing at it and at `vendor/README.md`.
7. **README.md** rewritten for strangers in the app's voice: what and why, one committed screenshot, how to get it, the five screens, where the data lives and how it is lost, which browsers are actually tested, where to read the version, the SheetJS scanner false positive, developer commands, licence. `dist/README-for-tester.md` is untouched.
8. **`npm audit`**, applying only fixes that leave `@playwright/test` on its current major.minor.
9. **Package**: the zip named from the version constant, the script and `dist.spec.js` following it, rebuilt and re-tested. The zip stays untracked.
10. **GitHub**: `gh repo create meridian --private --source=. --push`, an annotated `v1.1.0` tag, and a **draft** release carrying the zip with notes from the changelog. Never made public, never published — the owner does both by hand.
11. **Docs**: decisions 28 and 29, decision-log entries for every technical call, this section, and `docs/PHASE-7-CHECKPOINT.md`.

**Acceptance**: QUALITY-BAR §8 with the version on screen; unit and Chromium e2e suites green including the responsive and zoom matrices; the zip cut, named for the version, and `dist.spec.js` green against it; the repository private on GitHub with the tag pushed and the release still a draft; nothing of the owner's data, machine or local state in the published tree.

**Checkpoint (owner)**: open the draft release and download its zip; unzip and run it; read the version in the Data sheet footer and on first run; read the README as a stranger would. Then, by hand: Dependabot alerts, secret scanning with push protection, and Visibility → Public when ready.

## Backlog (after the friend's feedback)

- Whatever the friend's feedback changes in Log / Where it went / Goals / Lessons / Progress.
- Lessons: visit-based resurfacing, once there is enough history for it to mean anything (decision 25, not taken).
- Firefox, tested by hand until Playwright's build launches on this machine.
- Load SheetJS on demand (decision-log 189): ~50 ms of first render.

## Checkpoint report template (Claude Code writes this at every checkpoint)

```
Phase N report
- Built: …
- Tests: unit X/X, e2e Y/Y, responsive matrix: pass / failures listed below
- Fidelity: screens compared, deviations and why
- Technical decisions logged: n (see docs/DECISION-LOG.md)
- Known gaps: …
- Questions for the owner (product only): …
```

## Bug report template (owner writes)

```
1. Screen / sheet: …  Theme: …  Width or zoom: …
   Saw: …
   Expected: …
```
