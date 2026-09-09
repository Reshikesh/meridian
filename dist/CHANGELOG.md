# Meridian — changelog

## v1.3.2 — 9 September 2026

Nothing in the app itself changed. The notes that come with it did.

### Changed

- **These notes now ask you for the version** when you report something that
  went wrong — the small grey number under MERIDIAN in the top-left corner, and
  already in any screenshot of the whole window. Without it there is no telling
  a fresh problem from one that is already fixed.

## v1.3.1 — 9 September 2026

Which build you are looking at, without hovering anything.

### Changed

- **The version is on the screen**, under the MERIDIAN wordmark in the top-left
  corner, in small dim type. It was already on the opening screen, in the Data
  sheet footer and in the tooltip on the wordmark — none of which help when
  what you are looking at is a screenshot of something going wrong. The header
  is the height it always was.

## v1.3.0 — 9 September 2026

Coming back to a browser that cleared everything.

### Fixed

- **Linking a workbook can no longer overwrite it by accident.** Meridian used
  to ask "keep what is here, or take what is in the file?" whenever the file
  had data in it — including when Meridian itself was empty, where the
  highlighted button, the one Enter lands on, would write that emptiness over
  your workbook. It now simply opens the file when there is nothing to lose,
  and where there genuinely is a choice, the option that keeps your workbook
  is the highlighted one.

### New

- **Open a workbook**, first thing on the opening screen. If your browser
  clears its data when it closes, Meridian starts empty every time — and this
  is the one click that brings everything back and reconnects the file.
- **Meridian tells you when that is happening**, and where the setting is. In
  Edge: Settings → Privacy, search, and services → Clear browsing data on
  close → turn off "Cookies and other site data".

### Changed

- **The file picker still opens at Documents.** It was meant to reopen where
  your workbook lives; browsers only remember that for pages served from a
  website, and Meridian is a file on your computer. So if you keep your
  workbook somewhere else, linking it again means a few clicks through folders.
- **"Saved" and "Exported" are now different words.** The Data sheet says
  *Saved just now* when a change reached your linked workbook, and keeps
  *Exported* for a file you downloaded. It used to say "Exported" for both.

## v1.2.0 — 7 September 2026

A spreadsheet on your computer that keeps itself up to date.

### New

- **Link workbook** — point Meridian at an `.xlsx` file once, and every entry,
  category, goal and lesson is written into that same file as you go. No Export
  button, no pile of `meridian-data-…(3).xlsx` in Downloads. The header reads
  **SAVED · AUTO** and the count stays at nought.
- **Create workbook** — or let Meridian make the file for you, in Documents,
  named `meridian.xlsx`.
- **One click a session.** Chrome and Edge forget file permission when they
  close, so the first change you make after opening Meridian asks once: *Allow
  this site to edit meridian.xlsx?* Click **Allow** — not Enter, which lands on
  Don't Allow — and that covers everything until you close the browser. Dismiss
  it and the header reads **SAVE · 3** until you click it.
- **It notices when you edit the workbook yourself.** If the file has changed
  since Meridian last wrote it, nothing is written over: the header says
  **EDITED OUTSIDE**, and clicking it asks whether to keep what is in Meridian
  or take what is in the file. If everything Meridian has was already saved,
  it simply opens what the file holds and says nothing.
- **WORKBOOK LOCKED** — when a save does not reach the file, the count keeps
  counting and the next change tries again. Nothing is lost either way: this
  browser still holds everything.

### Changed

- Firefox and Safari have no file picker, so none of this appears there and
  Export works exactly as before.
- Excel opens a workbook the browser wrote behind its yellow **PROTECTED VIEW**
  bar. Enable Editing is harmless; the README says how to stop it asking.

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
- **Starting a range pick clears a focused band.** Focusing a band asks a
  question about the range on screen; carrying it into the next range answered a
  question nobody had asked, with the new chart already dimmed and the calendar
  already shaded when it arrived.
- **Days the calendar will not accept now answer you.** A day before your first
  logged day, or after today, used to light up under the pointer exactly like a
  day you could pick — and then the click did nothing. Those days no longer take
  the highlight, and clicking one flashes it in warn red instead of failing
  silently. Nothing about which days you may pick has changed: the calendar has
  always run from your first logged day to today.

### Fixed

- **Picking a range after leaving Where it went and coming back.** A pick
  waiting for its second day used to survive the trip, so the next click on the
  calendar *finished* that half-made pick instead of starting a new range — and
  every click after it was off by one: one landed a range you had not chosen,
  the next blanked the screen. It read as the second click not landing, and as
  the old figures refusing to clear. Leaving the screen now abandons a
  half-made pick. The range, the undo, the split and the sort still survive it,
  as they always did.

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
