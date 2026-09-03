# Meridian v1 — product decisions (final)

Status: **all resolved on 30 Aug 2026.** These override `MERIDIAN-SPEC-v1.1.md` §13 wherever they differ. Claude Code does not reopen them; anything not covered here and not purely technical gets asked once, at the start of a phase.

| # | Decision | Resolution |
|---|---|---|
| 1 | Durations only, or start/end clock times? | **Durations only.** Entries have a date and a duration in minutes; no clock times, no overlap logic. Consequence accepted: no time-of-day views on this data. |
| 2 | When does the logging day end? | **04:00.** "Today" = local clock minus 4 h; an entry belongs to the day it is logged on. No splitting. |
| 3 | Profiles | **One profile.** No profile UI, no `profile_id` column. |
| 4 | v1 screens | **Log + New entry sheet; Where it went; Manage categories + New category sheet; Goals + New goal sheet; import/export/first-run; all three themes; seed data.** Plan, Progress, Lessons are v1.5 (nav items present but render a calm "coming after your first full week" state, styled like the app, not a placeholder). |
| 5 | May the friend hand-edit the workbook? | **Yes.** Import validates every row and reports rejects; nothing fails silently. |
| 6 | Target browsers | **Chromium (Chrome/Edge) and Firefox, current versions, desktop.** Download is the primary save path. File System Access direct save is a Chromium-only enhancement, added only in Phase 5 if time allows. |
| 7 | Felt score | **None.** |
| 8 | Connection time | **Out of v1.** |
| 9 | Initial categories | **Seed the 8 sample categories:** Work (upkeep), Scrolling (less), Family (more), Idle TV (less), Learning (more), Exercise (more), Reading (more), Everything else (upkeep) — colours and planned hours per spec §9. |
| 10 | Value dots (1–5 per entry) | **Cut from v1.** No dots in the quick-add row or Log table; the VALUE column is removed and its width goes to ACTIVITY. The `value` column stays in the workbook, always blank. |
| 11 | Themes | **All three** (paper, graphite, blueprint), tokens verbatim from spec §5. Choice persists in localStorage and is applied before first paint. |
| 12 | Explanatory mode | **No chip.** The one gated line ("Projected from logged hours, not from your plan.") ships always-on when Progress ships (v1.5). |
| 13 | Weekly cap for Less categories | **Cap = that category's planned hours.** No separate input; `weekly_cap_hours` column exists, blank means equal to plan. |
| 14 | Non-hour goal units | **Hours only.** `target_unit` is always `h` in v1; the column stays for later. |
| 15 | Local data and an imported workbook both exist | **Prompt: "Replace local data" / "Keep local, discard import".** Never merge. |
| 16 | Category rename history | **Rename in place.** Archive sets `archived_on`; restore clears it. Effective-dated rename chains are deferred to the GitHub version. |
| 17 | Sleep / Work / Errands | **Amended 2 Sep 2026 — see below.** ~~Sleep and errands are Settings defaults (8 h/day, 15 h/week), never logged.~~ **Work is a logged Upkeep category; its 45 h is its planned hours.** Every "accounted for / to go / coverage / unlogged / of N h" figure uses **the whole day: 24 h, and 168 h a week.** |
| 18 | Week start | **Monday everywhere**, including the calendar header (M T W T F S S). ISO week numbers. |
| 19 | How a quick entry commits | **Amended 2 Sep 2026 — see below.** **The inline quick-add row commits on Enter** (duration, activity, category **and goal**). **`+` opens the full sheet** for the projection preview and for editing. Both paths write the same entry shape. |
| 20 | Seed goals | **Two hours-only goals:** Learn Python — 130 h, due 16 weeks after first run; Half-marathon training — 60 h, due 20 weeks after first run. Seed entries make the reachability maths consistent (see spec §9 [P]). |
| 21 | "COUNTS TOWARD" in the New category sheet | **Dropped.** A category feeds many goals; the only link is `Goals.category_id`. The sheet keeps NAME, COLOUR, DIRECTION and the upkeep note. |
| 22 | v1 rendering stack | **Preact 10 + htm + preact/hooks, vendored UMD builds, no build step.** API-compatible with React so the GitHub version is a mechanical port (htm → JSX). Vanilla JS only for the pre-paint theme script and the seed file. |

## Things that are technical, not product (Claude Code decides and logs them in `docs/DECISION-LOG.md`)

File and module layout, component boundaries, state shape, ID format, how the ribbon chart's layout function is ported, test structure, how the responsive collapse is implemented, export filename details, vendoring URLs and versions.

## Amendments

Decisions are final until the owner changes one. These were changed at the Phase 2
checkpoint, on 2 Sep 2026, after using the built screens.

### 17 — there is no sleep setting

**Was:** sleep was a Settings default of 8 h a day, never logged, and every
denominator in the app was "waking hours" — 24 − sleep, so 16 h a day and 112 h a
week. The day cap was the same figure.

**Now:** the setting is gone. A day is 24 h and a week is 168 h, which is what the
mockup says (spec §6: "9.5 h accounted for, 14.5 to go"; "97/168 h"; "SHARE OF
168 H"). Anyone who wants to see their sleep makes a category called Sleep and
logs it like anything else.

**Why:** a fixed nightly figure is wrong on most nights — five hours one night,
eight the next — so it would need editing daily to stay true, which is worse than
not having it. The 24 h day cap stays, as a guard against a typo (`90` where
`90m` was meant), not as a budget.

**Consequences:** `sleep_hours_per_day` is out of the Settings sheet; a workbook
from an earlier build still importing it gets a note saying so, not a reject.
`errands_hours_per_week` is untouched and still dormant; how the v1.5 Plan
screen breaks 168 down is a question for that phase.

### 19 — the quick-add row carries the goal too

**Was:** the inline row took duration, activity and category, and an entry made
there linked to no goal; `+` opened the full sheet for goal-linked entries.

**Now:** the row also has a COUNTS TOWARD picker, so a goal-linked entry never
has to open a dialog. The `+` moves to the right-hand end of the row and still
opens the full sheet — for the SAVING THIS MOVES projection, and as the editor
for an existing entry.

**Why:** logging against a goal is the ordinary case, not the exception, and a
dialog for it is friction in the loop the app is built around. Business rule
§8.2 is unchanged: picking a goal fills its category, and moving the category off
it clears the goal.

### 23 — the goal sheet leads with the name, and the identity line is optional and last

Added at the Phase 4 checkpoint, on 3 Sep 2026, after the owner's first three
real goals came out as `Learn Cooking / Cook` and `Cycling / Cycling`.

**Was:** the sheet opened with `I WANT TO BECOME`, a 20 px field placeheld
`someone who…`, carrying the autofocus, above the required `SHORT NAME`.

**Now:** `SHORT NAME` and `FED BY` lead and the name takes the caret;
`HOURS NEEDED` and `BY` follow; the identity field is last, at the same size as
every other field, labelled `WHY IT MATTERS — OPTIONAL`, placeheld
`Building my own tools, not just using them`, with the hint "Shows under the
name on the Goals screen. Leave it empty if nothing fits."

**Why:** the caret was inside the optional field before the required name had
been read, so the placeholder was destroyed by the first keystroke and the goal's
own name went into the identity line. It was a focus-order fault, not a wording
one — rewording alone would have produced the same rows. The owner asked for the
two strings to go and they have; their suggested `Goal Name` label was not taken,
because a second field named after the goal is what produced the duplication in
the first place.

**Not taken:** a placeholder cycling through ten examples. It is auto-updating
content, so `prefers-reduced-motion` would have to freeze it on one string —
which means writing one good static string regardless — and a placeholder in a
field that is about to be typed into is never read at all.

**Consequences:** spec §6's New goal sheet copy and the field order in
`design/shots/deck-08-sheet-goal.png` are superseded here. The seed's identity
lines are unchanged and still read correctly on the Goals screen. Existing rows
are not migrated; the owner clears them in the same sheet.

### 24 — a category can be created from the goal sheet's FED BY picker

**Was:** `FED BY` listed the More categories and nothing else. A goal for
something with no category yet was a dead end: cancel, lose everything typed,
go to Log → Manage categories → + New, come back, retype.

**Now:** a `+ New category` button under the picker stacks the existing New
category sheet over the goal sheet and hands the result back. The goal sheet
never unmounts, so the draft survives; a More category lands selected and
focused, and one that is not says so and stays saved.

**Why:** the machinery already existed — the same stack, z-index and
close-back-to-origin that Manage → New category uses — and with every More
category archived or imported away the picker was an empty box whose only exit
was a submit-time error naming it.

**Not taken:** putting `+ New category` inside the `<select>` as an option (it
fires on arrow-key traversal and is announced as a value), and disabling Less
and Upkeep in the stacked sheet (it would make one fidelity-locked sheet into
two). Rule §8.3 is explained, not enforced by amputation.
