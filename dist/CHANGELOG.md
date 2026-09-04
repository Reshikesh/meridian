# Meridian — changelog

## v1.1.0 — 4 September 2026

Five screens, all of them real.

### New

- **Progress** — every live goal on one chart, in its category's colour: banked
  history to today, the projection on to its landing, the target marked, the
  warn band when it is late; percent of target on the vertical axis; a goal
  list beside it with figures and a switch per goal.
- **Lessons** — a journal. Cards with or without a title, tagged to a goal or a
  category; a wall that fills the screen with pinned cards first and a fill
  that rotates newest, oldest, random from one visit to the next; search that
  shows every match; pin, archive, restore, and delete for good.
- **An early estimate** — a landing date from the second logged day, labelled
  *early estimate — N days* until the seventh, on Goals, the goal sheet, the
  entry sheet and Progress alike.
- **Over cap** — the Manage row says how far a *Less* category is past its
  planned hours this week.
- **The version, on the screen** — `MERIDIAN 1.1.0` in the Data sheet footer
  and on the first-run screen, and on the wordmark as a tooltip. Every export
  already carried it in the Meta sheet; now the app says it out loud.

### Changed

- **Plan is gone.** Goals is the plan. The workbook's Plan sheet still
  round-trips; nothing reads it.
- The Lessons sheet in the workbook gains `title`, `pinned` and `archived`. An
  older workbook imports its lessons untitled, unpinned and live.
- A screen fading out no longer takes keyboard focus with it.

## v1.0.0 — 3 September 2026

The first build to leave the owner's machine. One friend, a few days, a zip.

### What it does

- **Log** — a day's entries as durations, a keyboard-first quick-add row, day
  paging, edit and delete, and the week bar strip.
- **Where it went** — a Monday-first calendar with two-click ranges, presets and
  a six-second undo; the coverage donut, the direction split, and the
  category/goal ribbon chart with click-to-shade.
- **Goals** — hours-only goals fed by one More category, with a landing date
  projected in a straight line from real pace, and the reachability panel.
- **Manage categories** — create, rename, recolour, re-direct, archive, restore,
  and delete only what has never been lived.
- **Import and export** — `.xlsx` in and out, every row validated, every reject
  named with its sheet, its Excel row and its reason.
- **Three themes**, demo data, and a first run that offers import, demo or empty.

### What was deliberately not there

Plan, Progress and Lessons needed weeks of history to say anything true, so
they said that instead (all three reshaped and shipped in v1.1.0). Goals are
measured in hours only. There are no clock times, no accounts, no sync, and no
network access of any kind.

### Known, and written down

- Firefox has not been machine-tested; Chromium and Edge have. Open it once by
  hand there.
- On the graphite theme, two category swatches and the day numerals over the
  darkest calendar heat are lower contrast than the rest of the app.
- Sheets animate open and close instantly.

Everything above, with the reasoning, is in `docs/PHASE-5-AUDIT.md`.
