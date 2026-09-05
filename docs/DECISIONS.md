# Meridian v1 — product decisions (final)

Status: **all resolved on 30 Aug 2026.** These override `MERIDIAN-SPEC-v1.1.md` §13 wherever they differ. Claude Code does not reopen them; anything not covered here and not purely technical gets asked once, at the start of a phase. **Amended 5 Sep 2026 — 32–35 added (linked workbook).**

| # | Decision | Resolution |
|---|---|---|
| 1 | Durations only, or start/end clock times? | **Durations only.** Entries have a date and a duration in minutes; no clock times, no overlap logic. Consequence accepted: no time-of-day views on this data. |
| 2 | When does the logging day end? | **04:00.** "Today" = local clock minus 4 h; an entry belongs to the day it is logged on. No splitting. |
| 3 | Profiles | **One profile.** No profile UI, no `profile_id` column. |
| 4 | v1 screens | **Amended 3 Sep 2026 — see 25, 26, 27 below.** **Log + New entry sheet; Where it went; Manage categories + New category sheet; Goals + New goal sheet; import/export/first-run; all three themes; seed data.** Plan, Progress, Lessons are v1.5 (nav items present but render a calm "coming after your first full week" state, styled like the app, not a placeholder). |
| 5 | May the friend hand-edit the workbook? | **Yes.** Import validates every row and reports rejects; nothing fails silently. |
| 6 | Target browsers | **Chromium (Chrome/Edge) and Firefox, current versions, desktop.** Download is the primary save path. File System Access direct save is a Chromium-only enhancement, added only in Phase 5 if time allows. |
| 7 | Felt score | **None.** |
| 8 | Connection time | **Out of v1.** |
| 9 | Initial categories | **Seed the 8 sample categories:** Work (upkeep), Scrolling (less), Family (more), Idle TV (less), Learning (more), Exercise (more), Reading (more), Everything else (upkeep) — colours and planned hours per spec §9. |
| 10 | Value dots (1–5 per entry) | **Cut from v1.** No dots in the quick-add row or Log table; the VALUE column is removed and its width goes to ACTIVITY. The `value` column stays in the workbook, always blank. |
| 11 | Themes | **All three** (paper, graphite, blueprint), tokens verbatim from spec §5. Choice persists in localStorage and is applied before first paint. |
| 12 | Explanatory mode | **No chip.** The one gated line ("Projected from logged hours, not from your plan.") ships always-on when Progress ships — now Phase 6, per 27. |
| 13 | Weekly cap for Less categories | **Cap = that category's planned hours.** No separate input; `weekly_cap_hours` column exists, blank means equal to plan. Stands after 26: the cap lives in Manage categories, and is read there. |
| 14 | Non-hour goal units | **Hours only.** `target_unit` is always `h` in v1; the column stays for later. |
| 15 | Local data and an imported workbook both exist | **Prompt: "Replace local data" / "Keep local, discard import".** Never merge. |
| 16 | Category rename history | **Rename in place.** Archive sets `archived_on`; restore clears it. Effective-dated rename chains are deferred to the GitHub version. |
| 17 | Sleep / Work / Errands | **Amended 2 Sep 2026 — see below.** ~~Sleep and errands are Settings defaults (8 h/day, 15 h/week), never logged.~~ **Work is a logged Upkeep category; its 45 h is its planned hours.** Every "accounted for / to go / coverage / unlogged / of N h" figure uses **the whole day: 24 h, and 168 h a week.** |
| 18 | Week start | **Monday everywhere**, including the calendar header (M T W T F S S). ISO week numbers. |
| 19 | How a quick entry commits | **Amended 2 Sep 2026 — see below.** **The inline quick-add row commits on Enter** (duration, activity, category **and goal**). **`+` opens the full sheet** for the projection preview and for editing. Both paths write the same entry shape. |
| 20 | Seed goals | **Two hours-only goals:** Learn Python — 130 h, due 16 weeks after first run; Half-marathon training — 60 h, due 20 weeks after first run. Seed entries make the reachability maths consistent (see spec §9 [P]). |
| 21 | "COUNTS TOWARD" in the New category sheet | **Dropped.** A category feeds many goals; the only link is `Goals.category_id`. The sheet keeps NAME, COLOUR, DIRECTION and the upkeep note. |
| 22 | v1 rendering stack | **Preact 10 + htm + preact/hooks, vendored UMD builds, no build step.** API-compatible with React so the GitHub version is a mechanical port (htm → JSX). Vanilla JS only for the pre-paint theme script and the seed file. |
| 28 | Where the version shows | **One constant, three surfaces.** `src/core/version.js` is the single source, loaded first; the workbook stamps it into every export's `Meta.app_version`. It shows as `MERIDIAN 1.1.0` in the caps-label style in the Data sheet footer and below the three first-run choices, and as `title="Meridian 1.1.0"` on the header wordmark. Nothing else in the header changes. An allowed deviation from the mockup — added to the list QUALITY-BAR §1 names. |
| 29 | Licence and shape | **MIT, `Copyright (c) 2026 RESH`.** The repository goes to GitHub **private** first and is flipped to public by hand. The release artefact is named with the version (`meridian-1.1.0.zip`), attached to a GitHub Release, and **never committed to git**. Firefox and Safari are stated as untested, in plain words. |
| 30 | What the screen shows while a range is being picked | **A pending state, and no half-made pick outlives its screen.** While a pick is open the rail says `PICK END DAY`, and the hours figure, the coverage donut, the direction split, the coverage line and the ribbon all show no answer; the calendar heat and any band focus are cleared; the anchor day is marked as a range start; no preset is lit. Escape still restores the pre-pick range with no undo (122). Nothing ever computes for the anchor day alone (173). The second click lands and re-aggregates; clicking the anchor day again lands a one-day range. **Leaving the screen abandons an open pick** — see the amendment below. |
| 31 | Days the calendar will not accept | **They read as unavailable, and a refused click says so.** A day before the first logged day gets exactly the treatment a future day gets — same class, same tokens, same `aria-disabled` — in all three themes; the rule itself (§8.15, decision 118) is unchanged and is not widened. **The resting cell stays spec §4d verbatim** — transparent, 1px dashed `--line2` — even though `--line2` is the same hex as `--pale` in paper and graphite; making it visibly darker was built, looked at and turned down (see the amendment). What tells you a day cannot be picked is the hover it does not take and the answer it gives a click: any unavailable day, past or future, first click or second, flashes with the 200 ms `--warnbg` hold the typed-date field reverts with and does nothing else — a pick in flight stays open. No toast, no message, no new component. |
| 32 | Linked workbook (fulfils the Chromium enhancement left open in 6) | localStorage stays the live store. The Data sheet offers **Link workbook** (pick an existing .xlsx) and **Create workbook** (save picker, suggested name `meridian.xlsx`); the handle is kept in IndexedDB. Every store mutation that today increments the unexported counter is written to the linked file immediately — no debounce, writes queued, atomic (`createWritable` → `close`). A successful mirror counts as an export (DECISION-LOG 58/59 unchanged). Mirror bytes are the export encoder's bytes. Controls are hidden where `showOpenFilePicker` is absent; the export flow is untouched there. |
| 33 | Session grant | Chromium forgets a `file://` grant per session. The first mutation of a session calls `requestPermission({mode:'readwrite'})` on its own click; if dismissed, the header data control shows **SAVE · n** in brand and its click grants and writes. After a grant the control reads **SAVED · AUTO** and stays clickable as a flush. The `beforeunload` warning (spec §10) is unchanged — it arms only while the counter is non-zero. |
| 34 | Reconnect and external edits | On reconnect, if the file's `lastModified` is later than the recorded last mirror, the decision-15 prompt appears (Replace local / Keep local). Keep overwrites the workbook on the next mutation and the prompt says so. Never merge. |
| 35 | Locked workbook | A write failure (e.g. `NoModificationAllowedError` while Excel holds the file) shows **WORKBOOK LOCKED** in `--warn` on the header control; the counter keeps counting; retry on the next mutation or on click. Nothing is lost — localStorage already has it. |

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

### 25 — Lessons is a journal, not a weekly close-out

Added on 3 Sep 2026, at the Phase 5 checkpoint, when the owner revisited
decision 4.

**Was:** a weekly close-out queue — a prompt the app generated from the
difference between the plan and the week ("Scrolling took 6 h more than you
planned…", "W23 CLOSE-OUT — 1 OF 3", Skip / Save & next) — followed by a
history of past lessons with tags. Spec §10 left open when the queue fires and
what prompts 2 and 3 are.

**Now:** a free-form journal. The owner writes whatever they like — a lesson, a
musing, a piece of philosophy — with or without a title, whenever they like;
the app generates nothing. Lessons show as cards sized by what is in them, as
many as fit the screen: pinned cards always, and the rest chosen by a fill that
rotates between newest, oldest and random from one visit to the next, with a
small label saying which and a click to move it on. A search shows every match,
with no limit. A card can be pinned, archived or deleted. Archived cards leave
the wall entirely — nothing is shown faded — and a *View archived* switch shows
them with restore and delete-for-good. A card may carry tags naming a goal or
a category, as the data already allows.

**Why:** the close-out trigger and the second and third prompts were never
decided, and a journal has no trigger. It is also usable from the first
minute, which a weekly close-out never is in a few-day test. The owner's own
words: lessons "should be independent of anything".

**Not taken:** a visit-count split — half the most visited, half the least. In
the first weeks every card has been seen zero or one times, so the split means
nothing. Visit-based resurfacing can be added once there is enough history for
it to mean something. (Refined 3 Sep 2026: an earlier draft of this decision
filled the wall with half recent, half old; the owner chose the rotating fill
and content-sized cards instead.)

**Consequences:** spec §6's Lessons copy, `deck-06-lessons.png`, business rule
§8's close-out prompt and §10's open row are superseded; Appendix B item 7 is
moot. The Lessons workbook sheet keeps `id`, `iso_week`, `date`, `text`, `tags`
and gains `title`, `pinned` and `archived`; an older workbook without them
imports untitled, unpinned and live. No queue or skip state is needed.

### 26 — there is no Plan screen; Goals is the plan

**Was:** a Plan screen of weekly planned-versus-lived hours per category,
zero-sum inside 168 − sleep − work − errands ("52 hours are actually yours"),
a Save plan with next-week versioning, readings ("3 h short", "6 h over cap"),
and two landing dates side by side — at this plan, at last week's pace.

**Now:** planning is setting a goal — a target and a date — and logging against
it. The Plan nav item is removed; the app has five screens. The weekly cap for
a Less category keeps its meaning through the category's planned hours
(decision 13), edited in Manage categories as now, and the Manage row's THIS
WEEK column says "over cap" when a Less category is past it.

**Why:** everything the screen promised that matters already lives in Goals: a
required rate against real pace ("You've given Learning 7.0 h a week. This
needs 10.0 h.") and a landing date, which is decision 5's pair of dates kept
in view. What remained was the 168-hour budget — which decision 17's
amendment had already made uncomputable, since without a sleep figure
168 − 45 − 15 is 108, not 52 — plus the zero-sum rule, plan versioning and a
dozen details the mockup never settled. "Why make it more complicated?"

**Consequences:** spec §4g, §6's Plan copy, rules §8.6, §8.7 and §8.9, the
plan halves of §8.5 and §8.8, and `deck-05-plan.png` are superseded. Decision
13 stands. The Plan workbook sheet stays so a workbook round-trips, but nothing
reads it; `errands_hours_per_week` stays dormant. Decision 12's explainer
line still ships on Progress — it is still true.

### 27 — Progress projects from the second logged day, marked early until the seventh

**Was:** no landing date until a goal had seven distinct logged days (the
`MIN_LOGGED_DAYS` rule from Phase 1), and Progress deferred to v1.5 because it
"needs ≥2–3 weeks of pace history".

**Now:** the banked line — hours adding up — draws from the first entry. From
the second distinct logged day, pace is hours so far ÷ days so far × 7, and the
projection line and landing date show with the label "early estimate — N days".
From the seventh day the whole-week rule already built takes over and the label
goes. The Goals table, the New goal sheet's reachability panel and the entry
sheet's preview use the same rule and the same label, so no two screens ever
disagree about a date.

The chart is the screen, and it carries every live goal at once: each goal is
a line in its own colour, banked history solid to today and the projection on
to its landing, with its target marked. A list beside the chart names each
goal with its colour and its figures, and switches it off and on. With no live
goals there is no chart, only a line saying so. A goal already reached keeps
its history and projects nothing, so a screen whose goals are all reached
shows the timeline and the histories with no projection. Whatever sits beside
or above the chart serves it, or is removed.

**Why:** a blank screen for a week is worse than an honest early guess. The
seven-day gate existed because two days can swing a date by months; the label
carries that warning instead of hiding the date.

**Consequences:** spec §4e's hard-coded chart becomes computed — the axes
range from the first logged day to the later of the target date and the
landing date, and to the target's hours — and its four stat blocks and hero
sentence are computed from pace and required. This also retires the mockup's
own sample figures, which contradict rule §8.4: at 42 h banked and 7.0 h a
week the app lands on 3 September, 27 days early, not 14 October, 25 days
late. The LEVERS panel is not built: nothing in the data model says an hour
not scrolled becomes an hour learned. The mockup's single-goal hero sentence,
stat blocks and ALL GOALS list fold into the goal list beside the chart; the
"which goal" picker spec §10 asks for is that list. The owner's Phase 4 answer that a young goal shows "— /
after a week of logging" is superseded by the early estimate and its label;
that copy now covers only a goal with fewer than two logged days.

### 30 — a half-made pick does not outlive its screen

Added at the owner's bug report after Phase 7, on 4 September 2026.

**Was:** the whole Where-it-went view survived a trip to another screen, a pick
waiting for its second day included. That was deliberate — see the reasoning in
`DECISION-LOG.md` #117 — and it was never tested, because "Where it went" is the
default screen and no test had ever left it and come back.

**Now:** the range, the undo, the split, the sort and the focus still survive a
screen change. A pick waiting for its second day does not. The screen is never
entered on a half-made pick, so the first click on the calendar always starts a
new range and the second always lands it.

**Why:** because it read as the app ignoring clicks. Coming back to the screen
with a pick still open, the click the owner meant as "start here" *finished* the
stale pick and painted a full set of figures for a range they had not chosen;
the click they meant as "end here" then opened a new pick and blanked the screen.
Every click after that was off by one — land, anchor, land, anchor — which from
the outside is "the second click does not land, and the old figures stay up
during a pick". Both reported symptoms were this one cause.

**Consequences:** the pick is abandoned in the click that **leaves**, so no
half-made pick is ever held while its screen is not on show. The copy still
fading out is drawn from a snapshot of the view taken before it was abandoned,
so it keeps showing what it showed rather than redrawing at full opacity in the
first frames of the fade (`DECISION-LOG.md` #232). Opening a pick also clears
the focus, so a band focused against the old range cannot dim the new one the
moment it lands — which takes the two-click pick out from under decision 121
rather than changing that rule, since there is no focus left for it to judge by
the time the pair lands.

**Two deviations from the wording of this decision, both deliberate.** The
blanked panel keeps the copy decision 173 built for it — the heading *Pick the
second day.* and a panel naming the anchor day and saying either direction works
— rather than reusing the generic empty-range state. The generic copy
("Nothing logged in this range.") is a statement about data and would be untrue
mid-pick, where the screen is asking a question. And the focus is cleared when
the pick **opens**, not merely hidden while it is open.

### 31 — an unavailable day does not borrow the brand hover

Added at the owner's report after Phase 7, on 5 September 2026.

**Was:** spec §4d gives every hovered cell `--brand`, and decision-log #130 kept
hover alive on unavailable cells deliberately, so the mockup's day numerals
would still come up there. Both halves applied to every cell alike.

**Now:** hovering an unavailable day — before the first logged day or after
today — shows the numerals and nothing else. No `--brand` fill, and the
numeral keeps `--ink` rather than taking `--brandink`. An available day keeps
the brand hover verbatim.

**Why:** hovered, the two were pixel-identical. A day before the first logged
day filled solid brand with a white numeral under the pointer — which is the
app's strongest "this is clickable" signal — and then refused the click. The
numerals are the useful half of that hover and they stay; the fill was the half
that lied.

**Consequences:** a deviation from spec §4d's "hover = `--brand`" and from the
hover half of #130, **for unavailable cells only**, added to the list
QUALITY-BAR §1 keeps. The rest of #130 is untouched: cells stay `aria-disabled`
buttons rather than `disabled` ones, precisely so a real pointer still reaches
them — which is what makes the refusal flash possible at all, and is how the
owner reached the dead click in the first place.

**On the treatment itself — tried, and withdrawn.** `--line2` and `--pale` are
the *same hex* in paper (`#f0ebe4`) and graphite (`#26282d`), and 1.03:1 apart
in blueprint: the resting unpickable day is outlined in exactly the colour an
available one is filled with, both sitting around 1.1:1 against `--bg`. The
first build of decision 31 lifted it to `--ink2` at the `.45` opacity
`.btn:disabled` and `.seg__btn:disabled` use — 1.00:1 to 1.70:1 against `--pale`
on paper, 1.00 to 1.97 on graphite, 1.03 to 1.70 on blueprint.

**The owner saw it rendered and turned it down.** The resting calendar stays
quiet: `.cal__fill--off` is spec §4d verbatim, byte-identical to what it was
before this session, and the numbers above are recorded rather than fixed. The
two signals that a day cannot be picked are the ones that answer a pointer — the
brand hover it does not take, and the flash it gives a click. `tokens.test.js`
now pins the spec treatment, so neither a future contrast "fix" nor a token edit
can move it without going red.
