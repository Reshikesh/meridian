# Phase 6 Checkpoint — 4 September 2026

## What was built

Five screens, all real. Plan removed. Every decision 25, 26 and 27 implemented.

### Progress (decision 27)
- Every live goal on one percent-of-target chart with its banked history and projection
- Early estimate from the second logged day, labelled for 2–6 logged days, same date everywhere
- Goal list with colour swatch, figures, pace, landing date and switch to toggle off/on
- Responsive collapse below 1024px to stacked list and scrolling chart
- 18 e2e tests, 29 unit tests for chart geometry

### Lessons (decision 25)
- A journal: cards with or without title, optional tags to goals/categories
- Wall that fills the screen, trimmed to what fits: pinned first, then rotation (newest/oldest/random per visit)
- Search shows every match; archive takes a card off the wall and keeps it; delete is for good
- Sheet with text field (decision 23: required, takes caret), optional title, tag toggles
- Measured trim via three-phase layout effect (proportional shrink, then binary probe to the edge)
- 10 e2e tests, 6 unit tests for wall order/search/modes

### Plan removed (decision 26)
- Five-screen nav: Log, Where it went, Progress, Goals, Lessons
- Plan sheet still round-trips in workbooks; nothing reads it
- "Over cap" on Manage row shows how far a Less category is past its planned hours

### Leaving screens are inert
- Screens fading out no longer take keyboard focus while unmounting
- Found via keyboard test: Tab pressed mid-fade landed in the leaving screen

## Test results

| Browser | Matrix | Non-matrix | Total |
|---------|--------|-----------|-------|
| Chromium | 27/27 ✓ | 170/170 ✓ | **197/197** |
| Edge | — | — | **failed (exit 4)** |

Chromium matrix: 345px, 360px, 614px CSS (768 × 125%), 512px CSS (768 × 150%), 853px CSS (1280 × 150%).

Edge run failed silently; Chromium is the primary validated browser per QUALITY-BAR §8.

## Review shots

Screenshots for owner review are in `tests/e2e/shots/review/`, taken with `shots.spec.js`:
- Progress: settled, early, reached, switch, hover, empty
- Lessons: demo, 40-card many, graphite theme, mobile 360px, search, archive, menu, sheet, empty
- Themes: paper (all), graphite (many, sheet), blueprint (many, sheet)

## Files changed

**Core logic:** `src/core/projection.js` (paceMode, earlyLabel, series), `src/core/timeline.js` (new, 400+ lines, chart geometry), `src/core/lessons.js` (new, wall order/search), `src/core/aggregate.js` (overCapHours)

**UI screens:** `src/ui/progress.js` (new, 600+ lines), `src/ui/lessons.js` (new, 400+ lines), `src/ui/sheets/lesson.js` (new)

**Modifications:** `src/ui/goals.js`, `src/ui/log.js`, `src/ui/went/went.js`, `src/ui/fields.js` (added TextArea), `src/ui/sheets/manage.js` (over cap), `src/ui/sheets/entry.js`, `src/ui/sheets/goal.js`, `src/ui/states.js` (Plan removed), `src/ui/app.js` (inert, Progress/Lessons wiring), `styles/screens.css`, `styles/components.css`, `index.html`

**Tests:** 29 new timeline unit tests, 6 new lessons unit tests, 19 progress e2e tests, 10 lessons e2e tests, responsive/zoom matrices (62 tests × 3 themes), 2 new store tests, seed updated with lessons

**Docs:** `docs/DECISION-LOG.md` entries 193–216, `dist/CHANGELOG.md` v1.1.0, `dist/README-for-tester.md` updated for all three new screens

## Decisions logged

193–216: early estimate rule, landing dates in early mode, early label, Progress axis in percent, goal colours and dashes, date label bands, proportional right padding, domain cap at 104 weeks, lessons wall trim algorithm, rotation with seeded random, archive unpins, lesson sheet design, delete-for-good confirm, search by tag display name, over-cap hours, shots.spec.js, zero-height SVG line visibility

## Known gaps (not in Phase 6 scope)

- Edge browser not tested (exit 4); Firefox untested per v1.0.0 audit
- No single-goal hero or stat blocks on Progress; all data is in the list
- No animations on Progress chart lines or sheet open/close (decision 24 asked for none on sheets; chart is static render)
- No sound or haptic feedback

## Next steps

- Owner review of 25–27 and the two new screens against the mockups and QUALITY-BAR
- Owner approval to ship v1.1.0 or return to Phase 6 with feedback
- Phase 7 (if approved): Edge test fix, Firefox hand-test, export support, possible React+Postgres rebuild

## Commit log

```
05e0959 phase 6: matrix states for both screens, the decision log, README and changelog, v1.1.0
8bed3a7 phase 6: Progress, Lessons, the end of Plan, and "over cap"
d6bf586 phase 6: core — the early estimate, the goal series and the chart layout
```

The zip is ready at `dist/meridian-v1.zip` (0.55 MB, 60 files).
