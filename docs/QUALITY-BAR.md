# Meridian v1 — quality bar

This is acceptance criteria, not aspiration. A phase is not done until every applicable line passes. The standard the owner set: the result should be indistinguishable from work by a team of professional front-end developers with unlimited time. Concretely, that means the eight sections below.

## 1. Fidelity to the redesign

- Reference: `design/shots/deck-*.png` (paper theme) and the mockup `design/Meridian Redesign.dc.html`. Tokens (`docs/MERIDIAN-SPEC-v1.1.md` §5) and copy (§6) are used verbatim. Only the deviations listed in `docs/DECISIONS.md` (10, 17, 18, 19, 21, 28) are allowed; each is implemented so it looks native, not patched.
- Side-by-side check per screen at 1280 px: type sizes, weights, letter-spacing, caps labels, column alignment, row heights, gutters, border colours, chart proportions. Differences must be explainable by a decision or by real data replacing sample data.
- The chart maths in §4 (ribbon layout constants, donut stroke trick, calendar heat opacity, 18 h bar scale, 16 h plan scale) is ported exactly. Ribbon colours, opacities and focus/dim states match §4c.
- Every screen and sheet uses the same header, nav, sheet frame, table style, button styles, stat blocks and empty-state style. Nothing is styled ad hoc; if a new pattern is needed it is added once as a component and reused.
- Number formatting is consistent everywhere: hours to one decimal (`2.0 h`, `97/112 h`), percentages per §4c (one decimal under 10 %), dates `dd.mm.yyyy` in the header and `7 Jun 2026` in fields, `tabular-nums` on all figures.

## 2. Layout and responsiveness

- Design width is the 1180 px container; the layout is fluid from 1024 px up with no change of structure.
- Below 1024 px the layout degrades gracefully: side-by-side panels stack, tables scroll horizontally *inside their own container*, sheets become full-width with 16 px gutters, the nav wraps or scrolls horizontally. Mobile is not a use target, but nothing may break.
- At every width from 360 px to 2560 px, and at browser zoom 90 %, 100 %, 125 %, 150 %: **no horizontal page scrollbar, no overlapping elements, no clipped or truncated text unless it ends in an ellipsis by design, no element outside the viewport.**
- Automated check (Playwright, run at 360 / 768 / 1024 / 1280 / 1440 / 1920 px, all three themes, every screen and sheet open): `document.documentElement.scrollWidth <= window.innerWidth`; for every visible element with text, `scrollWidth <= clientWidth + 1` unless it has `overflow: hidden` with `text-overflow: ellipsis` or is an intentional scroll container; no two visible leaf elements' bounding boxes intersect unless one is a descendant of the other. Screenshots are saved to `tests/e2e/shots/` for human review.
- Long content is handled by design: 60-character activity text, 30-character category names, 20 categories, 12 goals, a day with 25 entries, a range of 365 days. None of these produce overlap or clipping.

## 3. Smoothness and motion

- No flash of wrong theme, empty content, or unstyled text on load: a pre-paint script sets `data-theme` from localStorage before CSS applies; data is loaded from localStorage before the first render; fonts are local with `font-display: swap` and metrics-compatible fallback sizing so text does not jump.
- Interactions respond within one frame; state updates are optimistic (the UI updates first, persistence happens in the same tick).
- Motion spec: sheet open/close — veil fades 160 ms ease-out, card fades and rises 8 px over 180 ms; screen switch — content cross-fades 120 ms; hover/active — 80 ms; chart focus/dim — 160 ms opacity; calendar heat — 160 ms. No spring physics, no bounces, no motion longer than 200 ms. `@media (prefers-reduced-motion: reduce)` turns all of it off.
- No layout shift when numbers change: stat blocks and table cells reserve width for their largest expected value; charts animate opacity, not size.
- Scrolling is native (no scroll-jacking). Sheets lock body scroll while open and restore the scroll position on close.
- Long operations (workbook import, export of thousands of rows) show a busy state inside the same UI within 100 ms; the page never appears frozen.

## 4. Interaction details

- Every interactive element has hover, active, focus-visible and disabled states derived from the tokens. Focus rings are visible for keyboard users and hidden for mouse users.
- Sheets: Escape closes, clicking the veil closes, focus is trapped inside while open and returns to the opener on close, the first field is focused on open.
- Quick-add: Enter commits from any field in the row; Tab order is duration → activity → category → `+`; after commit the row clears and the duration field regains focus so consecutive entries take no mouse.
- Destructive or lossy actions (delete a zero-hour category, archive a category with hours, replace local data on import) confirm inline in the same visual language, never with `window.confirm`.
- Validation messages appear next to the field, in `--warn`, and clear as soon as the input is valid. Nothing is written on invalid input.
- Date inputs keep the mockup's parsing rules (§3), including day-first numeric dates and silent revert on nonsense, plus a visible flash of the reverted value so the user notices.
- The 6-second undo after a range change keeps its exact feel (Appendix B, item 1).

## 5. States

- Every screen has designed empty, loading and error states that use the app's own components and copy tone (short, factual, no exclamation marks): no entries today; empty range; no goals (ghost row only); zero categories; import failed; workbook older than the app's schema.
- First run offers three paths on one screen: Import workbook, Start with demo data, Start empty. Demo data shows a persistent "Demo data" badge and a "Start fresh" action.
- Unexported changes: a small persistent indicator in the header ("3 unexported changes" → "Exported 2 min ago"); closing the tab with unexported changes triggers the browser's leave warning.

## 6. Data and persistence

- Every mutation persists to localStorage synchronously in the same event; a reload at any moment shows the same state.
- Export → import → export is byte-for-byte stable in content (round-trip test), and an export opened in Excel shows clean tables with a header row and no formulas.
- Import validation reports per sheet: rows accepted, rows rejected with sheet, row number and reason; foreign keys (category, goal) are checked; unknown columns are ignored with a note; missing sheets are reported, not fatal.
- Core logic (dates, day boundary, aggregation, projections, validation, workbook mapping) lives in `src/core/` with no DOM access and is covered by `node --test` unit tests, including: 04:00 boundary at 03:59 and 04:00, ISO week numbering across a year boundary, waking-hours totals, landing-date arithmetic, cap/floor readings, ribbon `layout()` with 1, 2, 9 and 20 rows.

## 7. Themes and colour

- All three themes are pure token swaps; every colour on every screen, including SVG charts, comes from a token. Switching themes re-renders every chart with no reload.
- Category swatches are the fixed hexes from §5 but are checked for contrast against each theme's `--bg`; where a swatch falls under 3:1 on graphite, it is rendered with a 1 px `--line` outline rather than changed.
- Text contrast meets 4.5:1 for body and labels and 3:1 for large headings in every theme (automated check on the token table).

## 8. Definition of done (every phase)

1. Unit tests and Playwright suite pass; the responsive matrix has no failures; screenshots were looked at by a human.
2. Side-by-side fidelity check against the reference screenshot for every screen touched.
3. No console errors or warnings on any screen, in any theme, in Chrome and Firefox, opened via `file://`.
4. No network requests at runtime (verified in devtools with the machine offline).
5. `docs/DECISION-LOG.md` updated with the technical decisions made; `README-for-tester.md` still accurate.
6. Known gaps are listed explicitly in the phase report; "done" never hides a shortcut.
