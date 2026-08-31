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
| 17 | Sleep / Work / Errands | **Sleep and errands are Settings defaults (8 h/day, 15 h/week), never logged. Work is a logged Upkeep category; its 45 h is its planned hours.** Every "accounted for / to go / coverage / unlogged / of N h" figure uses **waking hours = 24 − sleep default** per day (16 h; 112 h per week). The Plan bar keeps its 168 h breakdown because it names sleep explicitly. |
| 18 | Week start | **Monday everywhere**, including the calendar header (M T W T F S S). ISO week numbers. |
| 19 | How a quick entry commits | **The inline quick-add row commits on Enter** (duration, activity, category; goal optional via the row's category → the entry links to no goal). **`+` opens the full sheet** for goal-linked entries and "Other" durations. Both paths write the same entry shape. |
| 20 | Seed goals | **Two hours-only goals:** Learn Python — 130 h, due 16 weeks after first run; Half-marathon training — 60 h, due 20 weeks after first run. Seed entries make the reachability maths consistent (see spec §9 [P]). |
| 21 | "COUNTS TOWARD" in the New category sheet | **Dropped.** A category feeds many goals; the only link is `Goals.category_id`. The sheet keeps NAME, COLOUR, DIRECTION and the upkeep note. |
| 22 | v1 rendering stack | **Preact 10 + htm + preact/hooks, vendored UMD builds, no build step.** API-compatible with React so the GitHub version is a mechanical port (htm → JSX). Vanilla JS only for the pre-paint theme script and the seed file. |

## Things that are technical, not product (Claude Code decides and logs them in `docs/DECISION-LOG.md`)

File and module layout, component boundaries, state shape, ID format, how the ribbon chart's layout function is ported, test structure, how the responsive collapse is implemented, export filename details, vendoring URLs and versions.
