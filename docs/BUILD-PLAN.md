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

## v1.5 backlog (after the friend's feedback)

- Plan screen (planned vs lived, readings, zero-sum footer, Save plan with next-week versioning).
- Progress screen (projection chart, levers, all-goals list, the always-on explainer line).
- Lessons (close-out queue generation from plan deltas, history, tags).
- Whatever the friend's feedback changes in Log / Where it went / Goals.

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
