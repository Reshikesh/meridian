# MERIDIAN-SPEC-v1.1.md

> v1.1 = v1 with the review corrections applied (decisions 1–22 are final; see `docs/DECISIONS.md`). Where this file and `CLAUDE.md` disagree, `CLAUDE.md` wins.

Source of truth: `Meridian Redesign.dc.html` (project file, version v1787886334933340). The earlier upload `uploads/meridian-v4.html` is a superseded iteration; features that exist only there (radial 24-h clock, 7×24 rhythm grid, Living it / year-in-weeks / life-in-weeks, felt-vs-spent, per-goal 16-week continuity strip, savour flag, felt score, profiles, normal/explanatory mode chip, light+dark theme pair) are **not in the mockup** and are routed to §13. Sample "today" everywhere in the mockup is **Sunday 7 June 2026, ISO week W23** [O], hard-coded as `TODAY = dnum(2026,5,7)`.

Tagging: [O] observed · [I] inferred · [P] proposed · [?] decision (→ §13). In v1.1 a remaining [?] means the item belongs to a v1.5 screen (Plan, Progress, Lessons) or a deferred feature; nothing tagged [?] blocks v1.

---

## 1. Navigation and screen inventory

No URL/hash routing anywhere [O]: screen state is `data-screen` on the root `div[ref=rootRef]`, sheet state is `data-sheet`, theme is `data-theme`; CSS attribute selectors show/hide (`[data-s]`, `[data-sheet-id]`). The only persisted state is the analysis date range, `localStorage["meridian.range"]` = `{"s":<epoch-day>,"e":<epoch-day>}` [O].

| Item | Kind | Purpose | Element ref | Reads | Writes | URL/hash |
|---|---|---|---|---|---|---|
| MERIDIAN wordmark | brand | none (not clickable) | header span | — | — | no |
| Log | nav screen | day's entries + quick add + week bars | `button[data-nav="log"]` → `div[data-s="log"]` | entries for day, week totals | entries [I: via quick-add/sheet] | no |
| Where it went | nav screen (default) | range totals, direction split, category/goal ribbon chart, range picker | `[data-nav="went"]` → `[data-s="went"]` | entries in range, categories, goals | `meridian.range` | no |
| Progress | nav screen | one goal's projection + levers + all-goals list | `[data-nav="progress"]` → `[data-s="progress"]` | goal, entries history | — | no |
| Goals | nav screen | goal table + new-goal entry point | `[data-nav="goals"]` → `[data-s="goals"]` | goals + derived progress | goals [I: via sheet] | no |
| Plan | nav screen | weekly planned vs lived hours per category | `[data-nav="plan"]` → `[data-s="plan"]` | plan, week's entries, categories | plan [I: Save plan] | no |
| Lessons | nav screen | weekly close-out prompt + lesson history | `[data-nav="lessons"]` → `[data-s="lessons"]` | lessons, close-out prompts | lessons [I: Save & next] | no |
| New entry sheet | modal | create a log entry | `div[data-sheet-id="log"]`, opened by `[data-open="log"]` | goals, categories, goal projection | entries [I] | no |
| New goal sheet | modal | create a goal | `[data-sheet-id="goal"]`, opened by `[data-open="goal"]` | categories, pace history | goals [I] | no |
| New category sheet | modal (stacked, z-index 41) | create a category | `[data-sheet-id="category"]`, opened by `[data-open="category"]`; closes back to origin sheet via `data-open="back"` [O] | goals | categories [I] | no |
| Manage categories sheet | modal | list/edit/archive/restore/delete categories | `[data-sheet-id="manage"]`, opened by `[data-open="manage"]` (Plan screen) | categories, week totals | categories [I] | no |
| Theme toggle | control | switch paper/graphite/blueprint | `[data-theme-btn]` group | — | [I: should persist; mockup doesn't] | no |
| Date/week stamp | display | "07.06.2026 / W23" | header span | today | — | no |

There is **no in-app control** for the explanatory line: `showExplainer` is a component prop (Tweaks), default `true`, gating one caption on Progress [O]. See §13.

## 2. Component inventory

For all: hover/focus styling comes from `style-hover` / `style-focus` attributes; active state is `data-active="0|1"` flipped by JS or hard-coded in static sheets [O]. Missing-state entries are [I] unless noted.

| Component | Element ref | Inputs | States in mockup | Missing states [I] |
|---|---|---|---|---|
| Nav button | `[data-navbtn][data-nav]` | screen id | default (navdim), hover (navink), active (brand bg) | disabled n/a |
| Theme button | `[data-tbtn][data-theme-btn]` | theme id | default, hover, active | — |
| Segmented button | `[data-seg]` | label | default (line border), active (ink bg, bg text) | disabled, focus ring, keyboard |
| Preset button | `[data-preset]` (30/90/ytd/all) | range | default, hover, active (brand, set inline by `syncDials`) | — |
| Direction card | `[data-dir]` | direction | default, active (ink border + pale bg) | keyboard, focus |
| Editable field affordance | `[data-fld]` | text | default (dashed underline), hover (brand underline) | **no editor exists** — visual only [O]; needs input, validation, long-text |
| Category chip | inline span, `--pale` bg (`--warnbg`+`--warn` for Scrolling) | name | default | overflow/long name |
| Value dots (1–5) | 5 × 11px circles; filled `--brand`, empty 1.5px `--axis` border; Scrolling row's single filled dot is `--axis` [O] | score | filled/empty | interactive set/clear, zero/unset |
| Goal link text | "COUNTS TOWARD" cell, `--brand` text or `—` in `--axis` | goal name | linked / none | click-through |
| Progress bar | 7px `--pale` track + `--brand` fill (Goals) | pct | default | 0%, >100% |
| Plan bar + tick | 12px `--pale` track, fill = lived/16 h, 2px `--ink` tick = plan/16 h | plan, lived | default | lived>16 h overflow |
| Stat block | label (10.5px caps) + value (30/20px tabular) | — | default, warn cell (`--warnbg`) | — |
| Sheet/modal | `[data-sheet-id]`, `--veil` overlay, 560/760px card, shadow `0 18px 50px rgba(0,0,0,.28)` | — | open/closed (CSS) | esc-to-close, click-veil-close, scroll lock |
| Date input | `#rangeStart`, `#rangeEnd` | free text | default, focus (brand border), sr-only labels [O] | invalid feedback (silently reverts [O]) |
| Undo button | `↩ UNDO`, shown ≤6 s after range change | prior range | default, hover underline | — |
| Calendar month band | `[data-mon="k"]`, k=0..11 (Jul 2025–Jun 2026) | days | past, future (dashed), in-range, focused-heat, hover, start/end markers + date chips, focused-field ring | — |
| Ribbon band (chart) | SVG `path`+`rect` per node | node | default .42 opacity, focused .72, dimmed .08, gap dashed .22 | tooltip (none [O]) |
| Quick-add row | Log screen strip row | — | static | commit, validation, empty |
| Ghost goal row | "Name it / hours / date" | — | static | becomes editor |
| Legend | Went footer spans | — | static | — |
| Week bar strip | Log footer, 7 bars | day hours | past (`--pale`), today (`--brand`) | empty week |

Profile switcher, mode chip, tooltips: **absent from mockup** [O] → §13.

## 3. Interaction inventory

Status legend: **works** = wired in mockup JS · **visual** = rendered only · **unclear**.

| Trigger | Result | Data written | Element ref | Status |
|---|---|---|---|---|
| Click nav item | `applyScreen`: sets `data-screen`, closes sheet, re-flags active | — | `[data-nav]` | works |
| Click theme button | `applyTheme`: sets `data-theme`, re-flags active | — (not persisted [O]) | `[data-theme-btn]` | works |
| Click `+` (Log quick-add) / `+ New goal` / `Manage categories` / `+ New` | opens sheet via `applySheet` | — | `[data-open="log\|goal\|manage\|category"]` | works |
| Click ×/Cancel/Save/Create/Add/Done in sheets | closes sheet (category sheet returns to origin via `"back"`) | **nothing saved** [O] | `[data-open=""]`, `[data-open="back"]` | works (close only) |
| Click SPLIT Category/Goal | `setState dim`, clears focus, chart rebuilds | — | `[data-dimbtn]` | works |
| Click SORT Descending/Ascending | `setState sort` | — | `[data-sortbtn]` | works |
| Click 30D/90D/YTD/ALL | range = last 30/90 days, Jan 1–today, or 1 Jul 2025–today; clears focus; scrolls calendar; arms undo | `meridian.range` | `[data-preset]` | works |
| Click past calendar day (1st) | start=end=day, status "PICK END DAY" | — | day cell in `[data-mon]` | works |
| Click past calendar day (2nd) | range lands (auto-swapped), undo armed 6 s | `meridian.range` | day cell | works |
| Click future day | ignored | — | dashed cells | works |
| Hover calendar day | day-numbers appear in ±1 week rows; cell turns `--brand` | — | day cell | works |
| Click ↩ UNDO (≤6 s) | restores prior range, scrolls to it | `meridian.range` | undo button | works |
| Type in `#rangeStart`/`#rangeEnd` + blur or Enter | parse (ISO `Y-M-D`; `7 Jun [2026]`; `Jun 7`; **day-first** `D/M[/Y]` [O]; missing year → 2026, else 2025 if future); clamp 1 Jul 2025–7 Jun 2026; invalid → silent revert; commit lands range + scrolls | `meridian.range` | `#rangeStart`, `#rangeEnd` | works |
| Escape in date input | discard draft, blur | — | date inputs | works |
| Focus date input | selects text, scrolls calendar to that date, ring on that endpoint | — | date inputs | works |
| Click chart band | toggle focus; calendar shades days by that node's daily hours (opacity 0.10 + 0.90·v/max, max over full history [O]) | — | SVG `g` per node | works |
| Load page | restore+validate `meridian.range`; scroll calendar (retry ≤12 frames, reassert at 400 ms) | — | `componentDidMount` | works |
| Log ←/→ day arrows | — | — | Log header buttons | visual |
| Quick-add fields, Category dropdown, value dots, `…` row menu | — | — | Log rows | visual |
| All `[data-fld]` "editable" text | — | — | everywhere | visual |
| Sheet controls: HOW LONG, COUNTS TOWARD, colour swatches, direction cards, dropdowns, Change | — | — | sheets | visual (active states hard-coded) |
| edit · archive · restore · delete (manage sheet) | — | — | manage rows | visual |
| Save plan / Skip / Save & next / + tag | — | — | Plan, Lessons | visual |
| Keyboard | Enter/Escape on date inputs only [O]; no other keyboard behaviour | — | — | works |

## 4. Visualization specifications

All visuals re-render correctly on theme toggle because every colour is a `var(--*)` token, **except** the 9 hard-coded category hexes (§5), which are theme-invariant [O]. The mockup stores **durations, not clock times** [O], so "entry crossing an hour/day boundary", "overlap", and "more than one category in one hour" are unrepresentable in every chart below — flagged once here, decided in §13. Savour and archived-category handling: savour doesn't exist [O]; archived categories are simply absent from the chart's `CATS` array (sample) — real behaviour: archived categories stay in every historical range and chart, leave pickers and Plan (§8.11).

### 4a. Coverage donut (Where it went header)
- Ref: 38×38 SVG in `[data-s="went"]` header; `title` + `aria-label` = `covLabel`.
- Inputs: `logged` h and `total = days×24` in range.
- Math: pie via stroke trick — inner circle r=9.5, stroke-width 19, `stroke-dasharray = pct/100×59.69 59.69` (59.69 = 2π·9.5), rotated −90° so fill starts at 12 o'clock; `--pale` disc behind, 1px `--line` rim.
- Tooltip: native `title` = "`{pct}% of the {total} h in this range are logged`" [O].
- Empty range: pct 0 → empty disc (works); zero-day range impossible (start≤end enforced).

### 4b. Direction split bar (Where it went header)
- Ref: 30px flex bar, three segments.
- Inputs: hours by category direction over range: up (`--good`), down (`--warn`), keep (third segment = `--axis` at 0.26 opacity under `--ink2` label).
- Math: widths = `dir/logged×100`, `.toFixed(3)%`; labels `upPct/downPct/keepPct` rounded, keepPct = 100−up−down; caption `dirHours` = "`{up} h more · {down} h less · {keep} h upkeep`".
- DOM rendering. Zero-width segments overflow-hidden (label clips) [O]; all-zero logged → 0% widths, blank bar [O, ungraceful] — needs empty state [I].

### 4c. Category/Goal ribbon chart ("% OF LOGGED")
- Ref: SVG built in JS (`chart()` via `React.createElement`), exposed as `{{ chart }}`; viewBox `0 0 900 H`.
- Inputs: per-category or per-goal hour totals over range (`totals()`), sort dir, focus id.
- Layout math: constants PAD 24, GAP 9, MINH 34, xL 176, xR 628, bw 26, W 900, nameX 670; H = max(420, n×56+48). Row heights = value-proportional share of `(H−2·PAD −GAP·(n−1))`, then rows under 34px pinned to 34 and the remainder redistributed pro-rata (`layout()`). Left trunk: contiguous stack, vertically centred; right: same heights with 9px gaps. Ribbon = cubic Bézier pair with control x at `(xL+xR)/2`.
- Colour: up→`--good`, down→`--warn`, keep→`--axis`. Opacities: ribbon .42, focused .72, others-while-focused .08; right bar 1.0 (dim .18); trunk bar .85.
- Goal split: nodes = 4 goals + "No goal" (`logged − attributed`, sub "across every category"); per-day attribution = `share × (0.6+0.8·hash)`, scaled so a category's goal shares never exceed 0.92 of it [O, synthetic].
- Left label: "LOGGED HOURS" + total; per row: name (14.5px 600), optional sub (11px), right-aligned `%` (1 decimal <10%) + "`{h} h`".
- Legend (screen footer): "More is better / Less is better / Upkeep — neither / **Click any band to shade the days it happened.**" No tooltips [O].
- Click band → focus (see 4d). `state.src` is fixed `'logged'`; the coded `'all'`/"Unaccounted" node is unreachable dead code [O] (Appendix A).
- Empty range/zero hours: `layout()` falls back to equal heights [O]; percentage shows 0 — acceptable but meaningless; needs explicit empty state [I].

### 4d. Range calendar with focus heat (Where it went, left rail)
- Ref: DOM grid in `{{ calendar }}`; 12 month bands `[data-mon=0..11]` = Jul 2025 → Jun 2026; sticky S-M-T-W-T-F-S header (**Sunday-first** [O], vs Monday-first week bars elsewhere — Appendix A). **Build Monday-first (M-T-W-T-F-S-S), decision 18.**
- Cell states: future = transparent + 1px dashed `--line2`; past out-of-range = `--pale`; in-range = `--axis`; in-range while focused = focus colour at opacity `0.10+0.90·min(1, dayHours/max)` where max scans 1 Jul 2025–today [O]; hover = `--brand`; hovered ±1 week rows show day numerals; start/end cells get 3px brand corner box-shadows + date chip (start above, end below) + 1.5px ring when its input is focused.
- Interactions: two-click range, presets, typed dates, undo — see §3.
- Day-boundary/DST: dates are pure epoch-day integers via `Date.UTC` [O] — no timezone math exists.

### 4e. Progress projection chart
- Ref: static inline SVG, viewBox `0 0 880 330`, in `[data-s="progress"]` — **entirely hard-coded sample** [O]; no JS.
- Encodes (sample): y-axis 0/65/130 h (65→y158 [approximate y-scale [O]]); x-axis W17–W41 (200px per 6 weeks); logged polyline W17→W23 ending at (256,210)="42 h"; solid `--brand` "your pace" line from (256,210) to landing (675,43)="14 OCT"; dashed `--axisink` "needed" line to target (556,43)="TARGET 30 SEP"; `--warn` translucent rect between target and landing; 130 h dashed ceiling.
- Rule it encodes: straight-line, non-compounding projection from actual pace; landing = today + (target−banked)/pace [I, arithmetic 42+7·12.6wk≈130 h lands ~mid-Oct ✓].
- Legend: "logged / your pace / needed" swatches [O]. Gated caption (`sc-if showExplainer`): "Projected from logged hours, not from your plan."
- Levers panel [O sample]: "Scrolling −30 m/d → −25 d (bar 100%)", "Weekend block +2 h → −15 d (60%)", "Idle TV −1 h/wk → −7 d (28%)"; bar width ∝ days saved. ALL GOALS list: "Learn Python +25 d / Read 12 books on time / Run 200 km −12 d".
- Empty/insufficient history: not handled [O missing]; needs "not enough weeks to project" state [I].

### 4f. Log week bar strip
- Ref: Log footer; 7 DOM bars Mon–Sun.
- Math: height % = hours/18 (caption verbatim: "Bars are hours per day, 18 h scale."); today's bar `--brand`, others `--pale`; number above each; side stat "LOGGED THIS WEEK 97/168 h".
- >18 h day overflows scale [O missing]; clamp or rescale [I].

### 4g. Plan planned-vs-lived bars
- Ref: Plan table rows, DOM.
- Math: track = 16 h full width [O: all sample widths = h/16]; fill width = lived/16, colour per row (sample: `--good` Family/Exercise, `--brand` Learning/Reading, `--warn` Scrolling/Idle TV, `--axis` Everything else — **contradicts** the caption "Colour follows the category's direction" for Learning/Reading, Appendix A); 2px `--ink` tick at plan/16. Fixed bar above: "SLEEP 56 / WORK 45 / 15 / YOURS 52" segments, widths = h/168.
- READING column verbatim: "2 h short", "3 h short = 25 days late", "6 h over cap", "1 h short", "2 h short", "3 h over cap", "fine"; `--warn` colour on shortfalls ≥2 h and cap overruns, `--ink2` otherwise [I: threshold inferred from sample].
- Footer stats: "PLANNED 52.0 of 52 / AT THIS PLAN, PYTHON LANDS 12 Sep / AT LAST WEEK'S PACE 14 Oct"; caption: "Bars are lived hours, ticks are your plan. Colour follows the category's direction — over a cap is red, over a protected floor is not."
- Lived >16 h: fill overflows [O missing].

### 4h. Goals progress bars & manage-sheet share bars
- Goals: 7px `--pale` track, `--brand` fill = progress fraction (42/130=32%, 7/12=58%, 156/200=78% [O consistent]); sub "`{n} h|read|km · {w} weeks running`".
- Manage sheet: 6px track, fill = weekHours/168, coloured with the category's hard-coded hex.

## 5. Design tokens

Themes are attribute-scoped custom properties [O], verbatim:

| Token | paper | graphite | blueprint |
|---|---|---|---|
| --bg | #fbfaf8 | #16171a | #eef1f4 |
| --strip | #fff | #1c1e22 | #f8fafb |
| --ink | #1a1614 | #f2f2ef | #14202e |
| --ink2 | #6b625c | #9ca1a9 | #5a6b7d |
| --line | #e4ded6 | #2c2f35 | #cdd6de |
| --line2 | #f0ebe4 | #26282d | #dfe6ec |
| --brand | #8c1c2b | #c8f04a | #2b4a7d |
| --brandink | #ffffff | #16171a | #ffffff |
| --warn | #c8291a | #ff6b4a | #b4531f |
| --warnbg | #f7ecea | #241a17 | #f6ece5 |
| --good | #2b7d5d | #5fc98d | #1f6b52 |
| --navbg | #1a1614 | #16171a | #f8fafb |
| --navink | #f7f4ef | #f2f2ef | #14202e |
| --navdim | #b3aaa3 | #9ca1a9 | #5a6b7d |
| --grid | #eae4dc | #26282d | #dfe6ec |
| --axis | #c9c0b6 | #4a4e56 | #aebbc7 |
| --axisink | #6b625c | #9ca1a9 | #5a6b7d |
| --pale | #f0ebe4 | #26282d | #e3e9ef |
| --veil | rgba(26,22,20,.42) | rgba(0,0,0,.6) | rgba(20,32,46,.42) |

- Font: `Archivo, system-ui, sans-serif`, weights 400/500/600/700, loaded from **fonts.googleapis.com** [O — violates `file://` constraint; vendor or fall back, Appendix A]. `font-variant-numeric: tabular-nums` on all figures.
- Type scale (observed px): 9 · 9.5 · 10 · 10.5 · 11 · 11.5 · 12 · 12.5 · 13 · 14 · 14.5 · 15 · 16 · 17 · 18 · 20 · 22 · 25* · 26(svg) · 30 · 40 · 44. Caps-label style: 600, 9.5–11px, letter-spacing .10–.18em. H1: 700 40–44px, letter-spacing −.035em.
- Spacing: no token scale [O]; recurring values 4/6/8/12/14/16/18/20/22/26/28px; screen gutter 28px; sheet padding 22px; container `max-width:1180px` with 1px side borders.
- Radii: 2 / 3 / 4 px; 50% circles for dots. Shadows: sheets only, `0 18px 50px rgba(0,0,0,.28)`. Breakpoints: none — `flex-wrap` only [O]. Transitions: none defined [O].
- Explanatory styling: the gated line is plain `400 11.5px/1.5 Archivo, color:var(--ink2)` [O].
- Hard-coded colours bypassing tokens [O]: page frame `background:#d9d5cd` (body, outside themes); `a{color:#8c1c2b}` / `a:hover{#c8291a}`; category swatches `#2b7d5d #2b4a7d #a8641d #6b4a7d #5a6b7d #c8291a #7d2b5d #6b6b5a #4a6b8a`; sheet shadow rgba above. Everything else is tokenised.

## 6. Copy and annotations

Verbatim, by screen. (`{…}` = computed at runtime.)

**Header**: `MERIDIAN` · nav `Log / Where it went / Progress / Goals / Plan / Lessons` · `PAPER / GRAPHITE / BLUEPRINT` · `07.06.2026 / W23`.

**Where it went**: `{n} hours logged` · `OF LOGGED TIME` · `{n}%`×3 · `{up} h more · {down} h less · {keep} h upkeep` · `↩ UNDO` · `PICK END DAY` / `{n} DAYS` · `30D 90D YTD ALL` · sr-only `Start date`, `End date` · `{d Mon yyyy} – {d Mon yyyy}` (caption, uppercased) · `{n}% coverage · {n} h unlogged` · `SPLIT` `Category` `Goal` · `SORT` `Descending` `Ascending` · `% OF LOGGED` · `LOGGED HOURS` · chart subs: `across every category`, `never logged` (dead) · donut title: `{n}% of the {n} h in this range are logged` · legend: `More is better` `Less is better` `Upkeep — neither` `Click any band to shade the days it happened.`

**Progress**: `LEARN PYTHON` · `Finishing 14 Oct. 25 days late.` · `Seven hours a week gets you October. Ten gets you September.` · `BANKED 42/130 h` `PACE 7.0 h/wk` `REQUIRED 10.0 h/wk` `SLIPPAGE +25 days` · `HOURS BANKED — PROJECTED` · `logged` `your pace` `needed` · `TARGET 30 SEP` `14 OCT` `42 h` `W17 W23 W29 W35 W41` `130 65 0` · `LEVERS` · `Scrolling −30 m/d  −25 d` `Weekend block +2 h  −15 d` `Idle TV −1 h/wk  −7 d` · `ALL GOALS` · `Learn Python +25 d` `Read 12 books on time` `Run 200 km −12 d`.

**Log**: `SUNDAY 7 JUNE` · `9.5 h accounted for, 14.5 to go` · quick-add `1.5 h` `What did you do?` `Category ▾` `+` · headers `HOURS ACTIVITY CATEGORY COUNTS TOWARD VALUE` · rows: `2.0 h Python — async chapter · Learning · Learn Python` / `1.0 h Dinner with Priya · Family · —` / `4.5 h Client review & follow-ups · Work · —` / `1.5 h Phone, no reason · Scrolling · —` / `0.5 h Walk after lunch · Exercise · Half marathon` · `…` · day labels `Mon…Sun` with `15.0 12.0 16.0 14.0 17.0 13.5 9.5` · `LOGGED THIS WEEK` `97/168 h` · `Bars are hours per day, 18 h scale.`

**Goals**: `GOALS` · `Three open. One slipping.` · `+ New goal` · headers `GOAL TARGET BY PROGRESS LANDS` · rows incl. identity lines `someone who can build their own tools` / `someone who reads instead of scrolls` / `someone who runs in the mornings` · `42 h · 11 weeks running` `7 read · 4 weeks running` `156 km · 19 weeks running` · `14 Oct +25 days` `18 Dec on time` `19 Oct −12 days` · ghost row `Name it · hours · date · Meridian fills this from your log` · footer `Archived goals keep their hours. Nothing is deleted.`

**Plan**: `PLAN — A WEEK` · `52 hours are actually yours` · `Sleep, work and errands take 116. Plan the rest — every hour you add here comes out of another row.` · `Manage categories` · `SLEEP 56 WORK 45 15 YOURS 52` · headers `WHERE THE 52 GO — PLANNED vs LIVED, SAME SCALE / DIRECTION / PLAN / LIVED / READING` · directions `▲ MORE ▼ LESS UPKEEP` · readings `2 h short` `3 h short = 25 days late` `6 h over cap` `1 h short` `2 h short` `3 h over cap` `fine` · `PLANNED 52.0 of 52` `AT THIS PLAN, PYTHON LANDS 12 Sep` `AT LAST WEEK'S PACE 14 Oct` · `Save plan` · `Bars are lived hours, ticks are your plan. Colour follows the category's direction — over a cap is red, over a protected floor is not.`

**Lessons**: `LESSONS` · `What the weeks taught you` · `W23 CLOSE-OUT — 1 OF 3` · `Scrolling took 6 h more than you planned, mostly Thursday and Friday nights. What happened?` · chips `Scrolling` `+ tag` · `Skip` `Save & next` · history: `W22 31 May — Python only happens before 8am. Every evening attempt this month became scrolling.` [Learn Python] · `W20 17 May — Two hours with family beat six hours of "available". Presence is not duration.` [Family] · `W17 26 Apr — Side project archived without guilt. The 38 hours were not wasted, the deadline was invented.` [Side project] · `W14 5 Apr — Logging at night is guesswork. Log it when it ends or don't log it.` [Habit].

**New entry sheet**: `NEW ENTRY — SUN 7 JUNE` · `HOW LONG` `30 m 1 h 2 h 3 h Other` · `ACTIVITY — OPTIONAL` `Async chapter + exercises` · `COUNTS TOWARD` `Learn Python Learn Postgres Half marathon Nothing yet` · `A goal lives inside one category, so picking it fills the category below. Two hours of Postgres would never touch Python.` · `CATEGORY` `FILLED FROM THE GOAL` `Learning locked` `Change` · `SAVING THIS MOVES` `Learn Python 42.0 → 44.0 h` `Lands 14 Oct → 11 Oct` · `Cancel` `Save entry`.

**New goal sheet**: `NEW GOAL` · `I WANT TO BECOME` `someone who…` · `SHORT NAME` `Learn Python` · `FED BY` `Learning` · `HOURS NEEDED` `130` · `BY` `30 Sep 2026` · `IS THAT REACHABLE` `You've given Learning 7.0 h a week for 11 weeks. This needs 10.0 h.` `At 7 h it lands 14 Oct. Meridian will keep both dates in view instead of just the one you typed.` · `Date changes take effect next week, not today.` · `Cancel` `Create goal`.

**New category sheet**: `NEW CATEGORY` · `NAME` `Volunteering` · `COLOUR` (4 swatches) · `DIRECTION — WHAT DOES MORE OF THIS MEAN` · `▲ More — More is better. Can carry goals.` `▼ Less — Less is better. Has a weekly cap.` `— Upkeep — The cost of running a life. Never scored.` · `COUNTS TOWARD` `No goal — logged, never scored` **(this block is dropped in v1 — decision 21)** · `Upkeep is logged but never scored or ranked — haircuts, laundry, commutes. You'll see the hours, never a verdict.` · `Cancel` `Add category`.

**Manage sheet**: `CATEGORIES — 97 H THIS WEEK` · `+ New` · headers `CATEGORY DIRECTION THIS WEEK SHARE OF 168 H ACTIONS` · `edit · archive` · archived row `Side project ARCHIVED 38 h kept to 26 Apr — Out of the plan, still in the history — restore` · `Language app … 0.0 h Never used — safe to delete — delete` · footer `Delete only clears categories with no hours. Anything you've lived gets archived, so past weeks keep adding up to 168.` · `Done`.

**Explanatory-mode annotations**: exactly one gated annotation exists [O] — Progress, behind `showExplainer`: `Projected from logged hours, not from your plan.` No research references exist anywhere in this mockup [O]; the research-cited annotations live only in `uploads/meridian-v4.html` → §13 whether to carry them over.

## 7. Data model implied by the UI

Stored entities (derived fields listed separately):

**Category** — `id` (string) [I], `name` [O], `colour` (hex, from fixed palette) [O], `direction` ∈ `more|less|upkeep` [O], `weekly_plan_hours` (Plan column) [O], `archived` + `archived_on` ("38 h kept **to 26 Apr**" — an effective-to date) [O], `sort` [I]. Uniqueness: name unique per dataset [I]. **No `goal_id` on a category**: Learning feeds both Learn Python and Learn Postgres in the sample, so category→goal is one-to-many and the only link is `Goals.category_id` (decision 21). Rename history (`effective_from` / `replaced_by`) is not shown; v1 renames in place, archive keeps `archived_on` (decision 16). Weekly **cap** for Less categories = that category's planned hours; no separate input (decision 13). Derived: this-week hours, share of 168, lived hours per range.

**Goal** — `id`, `short_name` [O], `identity` ("someone who…") [O], `category_id` (exactly one, "FED BY") [O], `target_amount` (number) [O], `target_unit` ∈ `h | count | km` (sample shows all three [O]) — non-hour units are deferred, v1 is hours-only (decision 14), `by_date` [O], `archived` [I: "Archived goals keep their hours"]. Derived: banked, pace/wk, required/wk, landing date, slippage days, weeks-running streak, progress %.

**Entry** — `id`, `date` (ISO day) [O], `duration_minutes` (mockup shows 0.5 h steps; store integer minutes per constraint) [O], `activity` optional [O], `category_id` required [I: every row has one], `goal_id` optional [O], `value` 1–5 optional [O: dot rows] — **the dots and the VALUE column are cut from v1; the column stays in the workbook, nullable (decision 10)**. **No start/end clock times exist in the mockup** [O] — durations only in v1 (decision 1). No note field beyond `activity`; no felt score [O absent] → §13.

**Plan** — one row per non-fixed category: `category_id`, `planned_hours` [O]; plus the fixed bar `SLEEP 56 / WORK 45 / errands 15`: sleep = 7 × `sleep_hours_per_day` and errands = `errands_hours_per_week` from Settings (never logged); work = the Work category's planned hours (decision 17). "Save plan" implies weekly versioning [I]; goal sheet says "Date changes take effect next week, not today."

**Lesson** — `id`, `week` (ISO week) [O], `date` [O], `text` [O], `tags` (category/goal names) [O]. Close-out prompt: generated from plan deltas [I: "Scrolling took 6 h more than you planned…"], `1 OF 3` implies a queue [O].

**Settings** — `theme` ∈ paper|graphite|blueprint [O], analysis range start/end [O, localStorage `meridian.range`], `show_explainer` bool [O prop], `day_boundary` = 04:00 (decision 2), `week_start` = Monday everywhere including the calendar (decision 18), `sleep_hours_per_day` = 8, `errands_hours_per_week` = 15 (decision 17).

**Profiles** — absent [O] → §13.

### Excel workbook layout [P]

One sheet per entity, header row, string IDs, ISO-8601 text dates, integer minutes:

| Sheet | Columns (order) | Type / constraint | Example |
|---|---|---|---|
| Meta | key, value | `schema_version` required; `app_version` and `exported_at` (ISO datetime) written on every export | `schema_version` · `1` |
| Settings | key, value | theme∈paper/graphite/blueprint; day_boundary HH:MM (default 04:00); sleep_hours_per_day (default 8); errands_hours_per_week (default 15); week_start = monday | `theme` · `paper` |
| Categories | id, name, colour, direction, weekly_plan_hours, weekly_cap_hours, sort, archived, archived_on | direction∈more/less/upkeep; weekly_cap_hours blank ⇒ equals weekly_plan_hours; sort integer; archived∈TRUE/FALSE; archived_on ISO date or blank | `cat_learn` · `Learning` · `#2b4a7d` · `more` · `10` · `` · `5` · `FALSE` · `` |
| Goals | id, short_name, identity, category_id, target_amount, target_unit, by_date, archived | unit∈h/count/km; by_date ISO | `goal_py` · `Learn Python` · `someone who can build their own tools` · `cat_learn` · `130` · `h` · `2026-09-30` · `FALSE` |
| Entries | id, date, duration_min, activity, category_id, goal_id, value, created_at | duration_min integer >0; value 1–5 or blank (no UI in v1); date ISO; created_at ISO datetime | `e_0001` · `2026-06-07` · `120` · `Python — async chapter` · `cat_learn` · `goal_py` · `` · `2026-06-07T09:12:00` |
| Plan | category_id, planned_hours, week_effective_from | hours ≥0; ISO Monday date | `cat_learn` · `10` · `2026-06-08` |
| Lessons | id, iso_week, date, text, tags | tags comma-separated ids | `l_01` · `2026-W22` · `2026-05-31` · `Python only happens before 8am…` · `goal_py` |

Import validates every row (type, enum, FK to Categories/Goals, value range) and reports rejects per constraint doc; `localStorage` working copy under keys prefixed `meridian:` [constraint; mockup's `meridian.range` must be renamed to comply — Appendix A].

## 8. Business rules

Each testable; tag shows provenance.

1. [O] A category has exactly one direction: More (green, may carry goals), Less (red, has a weekly cap), or Upkeep (grey, "logged but never scored or ranked").
2. [O] A goal is fed by exactly one category; logging against the goal fills that category automatically ("A goal lives inside one category… Two hours of Postgres would never touch Python").
3. [O] Only More categories can carry goals ("Can carry goals" appears only on More; category sheet offers "No goal — logged, never scored" otherwise).
4. [O] Projection is straight-line and non-compounding: landing = today + (target − banked) ÷ current pace; "Projected from logged hours, not from your plan."
5. [O] Plan and pace produce two dates kept side by side: "AT THIS PLAN … 12 Sep" vs "AT LAST WEEK'S PACE … 14 Oct"; goal sheet: "Meridian will keep both dates in view instead of just the one you typed."
6. [O] Plan is zero-sum inside discretionary hours: 168 − sleep − work − errands = "YOURS 52"; "every hour you add here comes out of another row"; footer shows "PLANNED 52.0 of 52".
7. [O] Plan changes apply from next week: "Date changes take effect next week, not today."
8. [O] Less categories are judged against a cap ("6 h over cap"); More categories against a floor; "over a cap is red, over a protected floor is not."
9. [I, sample-derived; v1.5 Plan] A shortfall reads as warn-red at ≥2 h, muted below (Exercise "1 h short" is grey). Implement as sampled when Plan ships.
10. [O] Archive, don't delete: archiving keeps history ("38 h kept to 26 Apr", "past weeks keep adding up to 168", "Archived goals keep their hours. Nothing is deleted."). Delete is allowed **only** for categories with zero logged hours ("Delete only clears categories with no hours").
11. [O] Archived categories leave Plan and pickers but remain in historical charts ("Out of the plan, still in the history").
12. [resolved] Value dots are cut from v1 (decision 10); `value` stays a nullable column. Category direction is the value model.
13. [O] Upkeep hours are counted in coverage and shown in the split bar but never scored or ranked.
14. [resolved] Weeks are Monday-first ISO weeks everywhere, calendar included (decision 18). Every "accounted for / to go / coverage / unlogged / of N h" figure uses waking hours = 24 − `sleep_hours_per_day` per day (16 h default; 112 h per week): "9.5 h accounted for, 6.5 to go", "97/112 h". Sleep and errands are Settings defaults, never logged; Work stays a logged Upkeep category. The Plan bar's 168 h breakdown is unchanged because it names sleep explicitly (decision 17). Day boundary 04:00: "today" is the local clock minus 4 h (decision 2).
15. [O] The analysis range is clamped to [first data day, today]; future days are never selectable; an undo of a range change is offered for 6 seconds.
16. [O] Numeric short dates parse day-first (`7/6` = 7 June); display format is `dd.mm.yyyy`.
17. [resolved] Entries store duration only; a day may not exceed 24 − `sleep_hours_per_day` in total; rejected with a visible message, nothing written (decision 17).
18. Savour exclusion, felt-score capture, connection-time metric, stale-context rule for a continuity strip: **no basis in this mockup** [O absent] — all §13.

## 9. Sample data in the mockup

All sample data is hard-coded, partly inside rendering functions (Appendix A). Never a rule.

- Today: Sun 7 Jun 2026 (W23). Data horizon: 1 Jul 2025 (`MINDAY`).
- Categories (JS `CATS` + manage sheet): Work (upkeep, 45 h/wk, #2b7d5d), Scrolling (less, 14, #c8291a), Family (more, 12, #a8641d), Idle TV (less, 8, #7d2b5d), Learning (more, 7, #2b4a7d), Exercise (more, 5, #6b4a7d), Reading (more, 3, #5a6b7d), Everything else (upkeep, 3, #6b6b5a); archived: Side project (38 h kept to 26 Apr); empty: Language app (0 h, #4a6b8a).
- Goals (JS `GOALS`): Learn Python (Learning, share .55), Learn Postgres (Learning, .22), Half marathon (Exercise, .72), Read 24 books (Reading, .78). **Screens disagree**: Goals table shows "Read 12 books" and omits Learn Postgres; entry sheet offers Learn Postgres (Appendix A).
- Goal table sample: Python 130 h by 30 Sep, 42 h, lands 14 Oct (+25 d); Read 12 books by 31 Dec, 7 read, lands 18 Dec; Run 200 km by 31 Oct, 156 km, lands 19 Oct (−12 d).
- Log day sample: the five rows in §6; week 97/168 h; day totals 15/12/16/14/17/13.5/9.5.
- Plan sample: sleep 56, work 45, errands 15, yours 52; per-category plan/lived per §6.
- Lessons: four history rows + one close-out prompt (§6).
- "Where it went" numbers are synthesized per-day by `dayCat()` (deterministic hash of day × category) — not a dataset at all [O].

[P] **Seed dataset for the friend's first open** ("Demo data" badge + "Start fresh" button, §10): the 8 active categories above (drop Side project/Language app); 2 hours-only goals (Learn Python 130 h by +16 weeks; Half-marathon training 60 h by +20 weeks — dates relative to install day; decision 20); 14 days of entries, 4–6/day, using the five log-row archetypes, week totals ≈ 95 h; plan matching §6; 2 lessons. Every v1 screen non-empty; totals arithmetically consistent (entries sum to the week bars; banked hours sum to goal progress).

## 10. Gaps the mockup does not cover

| Gap | Tag |
|---|---|
| First-run flow: import workbook vs start with demo vs start empty; must exist before anything renders | [I] |
| Import validation report UI (per-row rejects, counts, "imported anyway" summary) | [I] |
| Unexported-changes indicator + `beforeunload` warning | [I] |
| Collision: localStorage already holds data AND user imports a workbook | resolved: prompt "Replace local data / Keep local, discard import"; never merge (decision 15) |
| Creating an entry actually saving (all sheets close without writing) — full create path | [I] |
| Editing and deleting entries (`…` menu and `data-fld` are visual only) | [I] |
| Quick-add row commit semantics | resolved: the inline row commits on Enter with duration, activity and category; `+` opens the full sheet for goal-linked or "Other"-duration entries (decision 19) |
| "Other" duration input in entry sheet | [I] |
| Day totals >24 h validation (durations-only model permits it) | [I] |
| Overlapping entries: unrepresentable without start times; becomes the waking-hours cap rule (§8.17) | resolved |
| Timezone/DST: mockup uses pure UTC day numbers; fine for one machine, but "today" must come from local clock | [I] |
| Archiving a category that has entries: confirm dialog, effect on Plan (its planned hours return to the pool) | [I] |
| Archiving/editing a goal (footer copy implies it; no UI) | [I] |
| Empty states: no entries today, empty range, no goals (only ghost row exists), no lessons, zero categories | [I] |
| Very long activity text / category names (grids will overflow) | [I] |
| Keyboard-first fast logging (only date inputs have keys today) | [I] |
| Theme persistence across reloads | [I] |
| Log day navigation (← → are visual; needs real day paging + past-day editing) | [I] |
| Week close-out trigger: when do the "1 OF 3" prompts generate, what are prompts 2–3 | v1.5 Lessons — decide before that phase |
| Progress screen goal picker (screen is fixed to LEARN PYTHON) | [I] |
| Non-hour goal units (books, km): how progress accrues from a time log | deferred; hours-only in v1 (decision 14) |
| Save plan versioning ("next week" rule needs week-stamped plans) | [I] |
| Export: filename, when offered, Chromium direct-save enhancement | [I] |

## 11. Proposed v1 scope

Criterion: helps one friend log a few days and see where time went.

| Item | Ship | Rationale |
|---|---|---|
| Log screen (real create/edit/delete, day paging, week strip) | v1 | The core loop; nothing may be lost |
| New entry sheet (duration presets + Other, activity, goal→category fill; no value dots — decision 10) | v1 | Primary input |
| Where it went (donut, split bar, ribbon chart, calendar range, presets, undo, focus-shading) | v1 | The payoff view; works with days of data |
| Manage categories + New category sheet (create, edit, archive/restore, zero-hour delete) | v1 | Needed on day one to fit the friend's life |
| Goals screen + New goal sheet (create, banked hours, naive landing date) | v1 | Cheap once entries exist; identity line is the product's soul |
| Import / export workbook + validation report + unexported-changes warning + first-run | v1 | Constraint: nothing may be lost |
| Themes (all three) + seed data + start-fresh | v1 | Trivial (token swap); seed makes screens legible |
| Plan screen (plan editing, planned-vs-lived, readings) | v1.5 | Meaningful only after a full lived week |
| Progress screen (projection chart, levers) | v1.5 | Needs ≥2–3 weeks of pace history |
| Lessons (close-out queue + history) | v1.5 | Weekly cadence; a few-day test never triggers it |
| Explanatory annotations carried from v4 | v1.5 | Copy work, zero data risk — if §13 revives the mode chip |
| Felt score, savour, profiles, radial clock, rhythm grid, life-in-weeks, felt-vs-spent, continuity strip | later | Absent from mockup; each is a §13 decision before any build |

## 12. Acceptance criteria for v1 screens

**Log**
- Given a seeded day, when it opens, then rows show hours/activity/category/goal (no VALUE column) and the header sums match ("X h accounted for, (24 − sleep default) − X to go").
- Given the entry sheet with 2 h + goal Learn Python, when Save entry, then an Entries row exists (duration_min 120, category auto-filled from goal), the day header and week bar update, and an unexported-changes flag sets.
- Empty: a day with no entries shows the quick-add row and a zero header, not a blank grid.
- Bad input: duration ≤0 or day total > (24 − sleep default) h is rejected with a visible message; nothing is written.

**Where it went**
- Given entries across a range, when a range is picked (two clicks, preset, or typed date), then donut %, split bar, and chart re-aggregate, and `meridian:range` persists and survives reload.
- Given a chart band click, when focused, then calendar days shade by that node's daily hours and a second click clears.
- Given a range change, when UNDO is clicked within 6 s, then the prior range is restored.
- Empty: a range with zero entries shows an explicit empty state, not a 0-h chart.
- Bad input: `31 Feb`, `foo`, or an out-of-bounds date reverts the field to the last valid value; typed `7/6` lands 7 June (day-first).

**Goals**
- Given a new goal (identity, name, fed-by, 130 h, date), when created, then it appears with 0 progress and the reachability panel used real pace history (or an honest "no history yet").
- Given logged hours against it, then banked and progress % update and landing = today + remaining/pace once ≥1 full week exists.
- Empty: no goals → only the ghost row "Name it…".
- Bad input: target ≤0 or by-date in the past is rejected inline.

**Manage categories**
- Given a category with logged hours, when archive, then it leaves pickers and Plan but past ranges still include it, and its row shows "kept" hours; restore reverses.
- Given a category with 0 h, when delete, then it is removed; with >0 h the delete affordance is absent.
- Empty: zero categories → import/seed prompt.
- Bad input: duplicate or blank name rejected.

**Import / export / shell**
- Import of a valid workbook replaces the working copy after explicit confirm when local data exists, and shows a per-sheet row count.
- Import with 3 malformed rows loads the rest and lists the 3 rejects with sheet+row+reason; nothing fails silently.
- Export downloads an .xlsx that re-imports to an identical state (round-trip test).
- With unexported changes, an indicator is visible and closing the tab warns; after export it clears.
- Theme toggle restyles every screen including all SVG charts with no reload; choice persists.
- Mode/explainer toggle (if shipped per §13) shows/hides the §6 annotation verbatim.

## 13. Decisions required from me — RESOLVED

Every row below is decided: the recommended default is accepted, except **value dots (cut from v1)**, plus six added decisions (17–22). The authoritative list is `docs/DECISIONS.md`; do not reopen these during the build.

| Decision | Why the mockup can't answer | Recommended default [P] | Consequences |
|---|---|---|---|
| Durations only, or start/end times? | Mockup logs "2.0 h" with no clock times; your constraints mention start/end | Durations only for v1; add optional start time later | Durations: fastest logging, no overlap logic, but no time-of-day views ever (radial clock etc. stay impossible). Start/end: richer, slower to log, needs overlap+boundary rules |
| When does the logging day end; how are boundary-crossing entries stored? | No boundary shown; durations attach to one date | Day = calendar date, boundary 04:00; an entry belongs to the day it's logged on; no splitting (durations can't cross) | Midnight: intuitive but punishes night owls; 04:00: late nights count as "yesterday"; splitting only matters if start/end wins above |
| One profile or several; workbook-per-profile or profile_id column? | No profile UI exists in this mockup (v4 only) | Single profile in v1; if revived later, one workbook per profile | Single: zero schema cost. profile_id column: every query filters, easy to leak rows across profiles |
| Which screens ship in v1? | Scope judgment | §11 split | Adding Plan/Progress/Lessons costs build time and shows empty/degenerate views in a few-day test |
| May the friend hand-edit the workbook? | Not observable | Yes — treat Excel as a first-class editor; import validates hard | Yes: validation must be bulletproof (that's §12); No: simpler, but then Excel is just a backup format |
| Target browsers | Not observable | Chromium + Firefox; File System Access direct-save as Chromium-only enhancement | Chromium-only: direct save, less testing; adding Safari/Firefox: download-only export path must stay primary |
| Felt score: none, per entry, per day? | Absent from mockup (v4 had per-day faces) | None in v1 | Per-day: one tap, enables future felt-vs-spent; per-entry: friction in the core loop; none: cleanest test of the direction model |
| What counts as connection time? | Concept absent from mockup | Out of v1; if wanted, a boolean `connection` flag on categories (Family etc.) | Adding it now = one column + one stat; deferring keeps v1 honest to the mockup |
| Initial category list and the value scale | Mockup samples: 8 categories; value = 1–5 dots per entry; your brief says value per category | Ship the 8 sample categories as seed; keep per-entry 1–5 dots exactly as mocked | Per-category value instead would remove the dots from logging and change §7/§8; confirm which model you meant |
| Value dots' role in v1 scoring | Dots are displayed but feed nothing visible | Store, display, don't aggregate in v1 | Aggregating (e.g., avg value per category) is new design not in the mockup |
| Themes: two or three? | Brief says light+dark; mockup ships paper/graphite/blueprint | Ship all three (pure token swap) | Cutting one saves nothing; three needs a 3-way toggle as mocked |
| Explanatory mode | No in-app chip; one gated line via a build-time prop | v1: ship the one line always-on; add a normal/explanatory chip only if v4's research annotations are wanted | Reviving v4 annotations = copy import task + chip UI; skipping keeps the header clean |
| Weekly caps for Less categories | Copy promises "a weekly cap"; no input field exists | Cap = planned hours for that category | Separate cap field = one more input in the category sheet |
| Non-hour goal units (12 books, 200 km) | Table shows them; no accrual UI exists | v1 goals are hours-only; books/km deferred | Supporting counts needs a "log a unit" affordance nowhere in the mockup |
| localStorage vs imported workbook both populated | Not shown | Prompt: "Replace local data / Keep local, discard import"; never silent merge | Merge logic is a v1-killer; explicit choice is testable |
| Category rename history (`effective_from`/`replaced_by`) | Brief names it; mockup only shows archive with an end date | v1: rename edits in place; archive keeps `archived_on` | Full effective-dating adds schema now for a feature no screen displays |

## 14. Non-goals for v1

No server; no accounts; no sync; no mobile layout; no notifications; no integrations; no compounding projections; no Sankey (the ribbon chart is proportional, not a flow); no deleting categories with logged hours; no analytics/telemetry; no start/stop live timer; no clock-time entries (per §13 default); no radial 24-h clock; no 7×24 rhythm grid; no year-in-weeks / life-in-weeks; no felt-vs-spent view; no per-goal 16-week continuity strip; no savour flag; no felt score; no profiles; no explanatory research annotations beyond the one §6 line; no hash routing / deep links; no drag interactions; no network requests of any kind at runtime (fonts vendored or system fallback); no build step.

## Appendix A. Mockup issues

- **Sample data lives inside rendering code**: `CATS`, `GOALS`, `hash()`/`dayCat()` synthesize "Where it went" data per render; Progress/Log/Goals/Plan/Lessons numbers are hard-coded in markup. Nothing reads a store.
- Sample-data contradictions: JS `GOALS` has "Read 24 books" (share .78), Goals screen shows "Read 12 books"; "Learn Postgres" exists in JS + entry sheet but not the Goals table.
- Dead code: `state.src` is permanently `'logged'` — the `'all'` branch, "Unaccounted" node, and renderVals `gapH/pctLogged/topDrainName/topDrainH/upH/downH/keepH/gapPct` are unused; `dayFocus()` contains a no-op `if (x.g.id === id) att = att;`.
- Google Fonts `<link>` (network) breaks the `file://`/offline constraint — vendor Archivo (400–700) or accept system-ui.
- localStorage key is `meridian.range`, not the mandated `meridian:` prefix.
- Calendar header is Sunday-first while every week metric is Monday-first ISO (W23, Mon–Sun bars).
- Plan bar fills contradict the caption's "colour follows the category's direction" (Learning/Reading render `--brand`, not `--good`); Exercise "1 h short" is muted while 2 h shortfalls are red — threshold is implied, not coded.
- Scrolling log row's filled value dot uses `--axis` instead of `--brand` (inconsistent with other rows).
- `data-fld` promises editability (dashed underline, `cursor:text`) with no editor behind it; sheet segmented controls have hard-coded `data-active`.
- All layout styles are inline; only colours are tokenised — theme works, but any spacing/type change is a find-replace.
- `TODAY`/`MINDAY`/`DEFSTART` are hard-coded dates; nothing derives from the real clock.
- Container assumes ≥~1100px viewport; grid templates use fixed px columns with no responsive fallback beyond `flex-wrap`.
- Category swatch hexes are theme-invariant; on graphite (dark) some (e.g. `#2b4a7d`) sit near the background.

## Appendix B. Observations

1. The two-click range picker with a 6-second undo is the best interaction in the mockup — keep its exact feel.
2. "9.5 h accounted for, 14.5 to go" quietly demands 24 h/day accounting; with no Sleep entries the friend will always look 8 h "behind" — the seed data should include sleep or the copy should soften.
3. The ribbon chart's goal split double-counts nothing but explains nothing either; the "No goal" band will dominate real data.
4. Value dots are logged but never pay off anywhere — either aggregate them somewhere or friend feedback will call them busywork.
5. Quick-add's `+` opening a modal contradicts the inline-row affordance beside it.
6. `PICK END DAY` state has no cancel except clicking a day; Escape should abort.
7. Lessons' "1 OF 3" promises a queue the mockup never shows finishing.
