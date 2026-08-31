# Meridian — v1 (friend test build)

Meridian is a single-user, locally run, value-based time tracker. It records where time goes as dated durations, gives each category a direction (More / Less / Upkeep), feeds goals from one category each, and projects landing dates in a straight line from actual pace. The owner is non-technical; you are the whole engineering team. v1 exists so one friend can run it from a zip for a few days and give feedback. After that, a React + Postgres version goes to GitHub — so keep the code portable, but do not build for that now.

## Read these before any work, in this order

1. `docs/DECISIONS.md` — 22 final product decisions. Never reopen them.
2. `docs/MERIDIAN-SPEC-v1.1.md` — the extracted spec: screens, interactions, chart maths, tokens, copy, data model, rules, gaps, acceptance criteria. Where it and this file disagree, this file wins; where it and `DECISIONS.md` disagree, `DECISIONS.md` wins.
3. `docs/QUALITY-BAR.md` — acceptance criteria for fidelity, responsiveness, motion, states, data, themes. Binding.
4. `docs/BUILD-PLAN.md` — the phases. Work on exactly one phase per session.
5. `design/Meridian Redesign.dc.html` and `design/shots/deck-*.png` — the design source of truth. The `.dc.html` is a Claude Design component file (React.createElement, template directives, inline styles): use it for exact maths, tokens and copy, never as code to copy.

## Stack — fixed, do not propose alternatives

- Static files opened from `file://` by double-clicking `index.html`. No build step, no bundler, no transpiler, no dev server required to run the app.
- **Preact 10 + htm + preact/hooks**, vendored UMD builds in `vendor/`. Tagged templates (`html\`...\``), no JSX, no TypeScript. Plain CSS in `styles/`, custom properties from spec §5.
- **SheetJS** (`xlsx.full.min.js`, pinned version) vendored for `.xlsx` read/write. Working copy in `localStorage` under keys prefixed `meridian:`.
- **Archivo** font vendored (woff2 400/500/600/700 with its OFL licence) with a `system-ui` fallback.
- Tests: `node --test` for `src/core/`; Playwright in `tests/e2e/` (npm-installed there only — the app itself has zero dependencies). Playwright opens the app via `file://`.
- Record every vendored file's version, source URL and licence in `vendor/README.md`.

## Hard constraints

- `file://` rules: classic `<script src>` only (no `type="module"`), no `fetch()` of local files, no network requests at runtime, no CDN links, no Google Fonts link.
- Nothing may be lost: every mutation persists to `localStorage` synchronously; unexported-changes indicator in the header; `beforeunload` warning when unexported changes exist.
- Durations only (decision 1); day boundary 04:00 (decision 2); waking-hours denominators (decision 17); Monday-first everywhere (decision 18).
- Fidelity: tokens and copy verbatim; layouts match `design/shots`. Only the deviations in `DECISIONS.md` are allowed. No new features, no "improvements", no placeholder UI.
- `src/core/` has no DOM access and is fully unit-tested. UI components never contain business rules.
- Import validates every row and reports rejects; export round-trips exactly.

## Repository layout

```
index.html              shell: pre-paint theme script, styles, vendor scripts, seed, src scripts, mount point
styles/tokens.css       spec §5 verbatim: three themes as [data-theme] custom-property blocks
styles/base.css         reset, type scale, spacing scale, motion tokens, reduced-motion
styles/components.css   nav, buttons, chips, tables, stat blocks, sheets, inputs, empty states
styles/screens.css      per-screen layout and the responsive collapse (see QUALITY-BAR §2)
src/core/               pure logic: dates.js (04:00 boundary, ISO weeks), aggregate.js, projection.js, validate.js, workbook.js (sheet ↔ objects), ids.js
src/store.js            state shape, reducers, localStorage persistence, unexported-changes counter
src/ui/                 Preact components: app.js, header.js, log.js, went/ (calendar, ribbon, donut, split), goals.js, sheets/ (entry, goal, category, manage), firstrun.js, states.js
seed/seed.js            demo dataset as a classic script assigning window.MERIDIAN_SEED (dates relative to first run)
vendor/                 preact, hooks, htm, sheetjs, fonts + README.md
tests/unit/             node --test suites for src/core and store
tests/e2e/              Playwright: smoke, responsive matrix, overlap/overflow checks, fidelity screenshots
docs/                   DECISIONS.md, MERIDIAN-SPEC-v1.1.md, QUALITY-BAR.md, BUILD-PLAN.md, DECISION-LOG.md (yours)
design/                 mockup file, screenshots, deck
data/                   the owner's and tester's exported workbooks (gitignored except README)
dist/                   Phase 5 output: the zip for the friend + README-for-tester.md
```

## How to work

- One phase per session. Start every phase by reading its section in `docs/BUILD-PLAN.md`, then produce a plan (files to touch, components, tests) and wait for approval before writing code. Stop at the phase checkpoint and report as specified there.
- Questions: technical ones you decide and log in `docs/DECISION-LOG.md` (one line each: what, why). Product questions not answered by the docs are batched and asked once at the start of a phase — never mid-build. If truly blocked mid-phase, pick the option most faithful to the mockup, log it, and flag it in the checkpoint report.
- Do not touch another phase's scope; do not refactor unasked; do not add dependencies to the app; do not change tokens or copy.
- Run the full test suite and the responsive matrix before calling anything done. Look at the Playwright screenshots yourself. Compare each touched screen against its reference screenshot at 1280 px.
- Commit at least once per phase: `phase N: <what>`; small commits inside a phase are welcome.
- Never delete or overwrite anything in `data/` or `design/`.
- Write for the next reader: short files, named functions, a comment only where the mockup's maths is non-obvious (cite the spec section, e.g. `// spec §4c layout()`).

## Quality, in one line

Ship what a senior front-end team with unlimited time would sign off on; `docs/QUALITY-BAR.md` defines what that means and is checked at every checkpoint.
