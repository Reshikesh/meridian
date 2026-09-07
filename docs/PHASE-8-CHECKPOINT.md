# Phase 8 Checkpoint — the linked workbook — 7 September 2026

v1.2.0. The friend can point Meridian at a spreadsheet on their own computer,
and from then on every entry, category, goal and lesson is written into that
file as they log. `docs/PHASE-8A-SPIKE.md` is the measurement this was built on;
it changed decisions 34 and 35 before a line of it was written.

## What the spike changed, before the build

- The grant is per browser session and cannot be persisted — so the app asks
  once per session, on the first mutation's own click.
- A write attempted without a grant does not fail, it **hangs** on the browser's
  prompt (118 s and 193 s in two runs). Nothing is written while the permission
  is `prompt`.
- The locked-file error is `InvalidStateError`, not `NoModificationAllowedError`,
  and **Excel does not hold an open workbook at all** — so WORKBOOK LOCKED is
  keyed to any failure, and is tested with a failing handle rather than Excel.
- Our own writes move `lastModified` a few milliseconds either side of our
  clock, so the record is the file's own value, read back after each write.
- Five concurrent writes all report success and leave an arbitrary one on disk.
  The queue is a correctness requirement.

## What was built

**`src/core/link.js`** — six states (`unsupported`, `unlinked`, `needs-grant`,
`auto`, `edited-outside`, `locked`), a reducer, one label and one action. No DOM,
no File System Access API: 39 unit tests cover every transition, the label's
order of precedence and the rule that a control reading SAVED · AUTO opens the
Data sheet rather than raising a prompt.

**`src/ui/link.js`** — the handle in IndexedDB, the record in
`localStorage['meridian:link']`, the pickers, the permission, and the write:

1. the counted mutation's hook fires inside its own click or Enter;
2. `queryPermission` — `prompt` stops here and shows **SAVE · n**;
3. `getFile().lastModified` — newer than our record stops here and shows
   **EDITED OUTSIDE**, writing nothing;
4. encode through the export encoder, `createWritable` → `write` → `close`,
   queued so two writes never overlap;
5. record the file's own `lastModified`, `markExported` — counter 0,
   **SAVED · AUTO**;
6. any rejection is **WORKBOOK LOCKED** (except `NotAllowedError`, which means
   the grant went and belongs to SAVE · n); the counter keeps counting and the
   next mutation retries.

**The three collision moments (decision 37)** — the ask when linking a file that
already holds a dataset; the silent adopt on reconnect when nothing local is at
stake, with the import report only if rows were rejected; and the mid-session
stop, which offers Keep local / Replace local unless the file cannot be read at
all, in which case it is written over and said so.

**The header** — one label, in precedence order: NOT SAVING (185) → WORKBOOK
LOCKED / EDITED OUTSIDE in `--warn` → SAVE · n in the live colour → SAVED · AUTO
→ the export label this app has always shown. All of it inside the 232 px
budget (63); `12 unexported changes` is still the widest string it can hold.

**The Data sheet** — a WORKBOOK block under the export note: Link workbook,
Create workbook (opening at Documents), or the file's name, when it was last
written, and Unlink. The block does not exist where `showOpenFilePicker` is
absent, so Firefox and Safari see the sheet they always saw.

## The copy, for the owner to change

New strings, in the app's voice. Nothing here comes from the mockup, so every
line is a choice that can be overruled:

- Data sheet: **WORKBOOK** · "Meridian can keep a spreadsheet on your computer
  up to date as you log." · `Link workbook` · `Create workbook` · `Unlink`
- Linked: `meridian.xlsx · written 2 min ago`
- Ungranted: "Your browser asks once each time you open Meridian. Click Allow
  and logging saves straight to the file."
- Locked: "The last save did not reach the file. Meridian still has everything,
  and will try again with your next change."
- The prompt: "Your workbook changed outside Meridian." / "Keep local rewrites
  the workbook now, with what is in Meridian. Replace local loads the workbook
  and drops what is in this browser." · `Keep local, overwrite the workbook`
  (brand) · `Replace local data`
- Adopted: "Your workbook had changed, so Meridian opened what it holds."
- Unreadable: "Your workbook could not be read, so Meridian has written it
  fresh."
- Header: `SAVED · AUTO`, `SAVE · 3`, `EDITED OUTSIDE`, `WORKBOOK LOCKED`

## Test results

- **Unit: 585 pass** (`node --test`), including 39 new for the state machine and
  the store's hook, and one asserting the mirror's bytes decode to exactly what
  Export's bytes decode to.
- **e2e: 588 pass**, clean in one run across chromium and msedge, including 15 new in
  `link.spec.js` — linking, the grant, a dismissal, the leave warning, a failing
  write and its retry, an outside edit answered both ways, an unreadable file,
  both reconnects, linking a workbook that already holds data, and a
  Firefox-shaped browser seeing none of it.
- **Responsive matrix: 39 pass** · **zoom matrix: 45 pass**, both with five new
  states — the linked Data sheet, SAVE · n, WORKBOOK LOCKED, EDITED OUTSIDE and
  the conflict sheet — at every width, zoom and theme.
- **`dist.spec.js`** against the re-cut `meridian-1.2.0.zip` (0.57 MB, 63 files).
- **Timed project: 4 pass.** First render with 2,000 entries reads 191 ms
  against its 200 ms budget — thin enough to be worth explaining. It is not this
  phase: the commit before Phase 8, run through the same harness on the same
  afternoon, reads **187 ms**, and an A/B alternating both builds run-for-run in
  one browser puts Phase 8 **4 ms faster** than the baseline. Two more script
  tags cost nothing measurable. What has changed is the machine — Phase 7
  recorded 171-185 ms — and both builds now produce individual runs above 200,
  so this test will flake for anyone until there is more headroom. The backlog
  already names the fix: load SheetJS on demand (DECISION-LOG 189), worth about
  50 ms. The budget has not been touched; raising it would hide the next real
  regression.

## What the review shots changed

Looking at them found two defects, both fixed:

- **The import report's heading has read "106 rows read.Nothing rejected." since
  Phase 1** — htm drops the whitespace between two expressions. It has been
  wrong on every import this app has ever done; the conflict prompt reuses the
  component, which is how it surfaced.
- **Focus never moved to the decision.** The Data sheet's report, adopted and
  conflict views all arrive after the busy state, and the sheet focuses its
  default only when it opens — so Enter on a two-way destructive choice hit the
  close button. The Data sheet now focuses `[data-autofocus]` whenever the view
  changes, which fixes the import report along with the new prompt.

And one thing worth the owner's eye:

- **`SAVE · n` is in `--navink`, not `--brand`.** Decision 33 says brand;
  `--brand` on the paper header is 1.98:1 (DECISION-LOG 7), which is the
  measurement that made every header accent `--navink` in the first place. So
  SAVE · n uses the live colour the unexported counter has always used, and the
  two warn states keep `--warn`, which reads clearly on the header. Easy to
  change if you want it louder.
- **The Data sheet's top line reads "Exported just now" while linked**, because
  a successful write counts as an export (decision 32). True, and the WORKBOOK
  block under it says what actually happened — but it is the export flow's
  vocabulary describing something else.

## A flake, and what it was

`header-save-n` — the matrix state that shows SAVE · n — failed twice under
twelve workers and passed every time it was run alone. It reached the state by
reloading and letting the app reconnect into a session with no grant, which is a
race: under load the app came back up granted, wrote, and the state under test
never appeared. The rig now reaches the same state without a reload, by asking
once and being refused, and waits on the adapter's own state rather than on a
label that two different states can show. The reload path stays covered in
`link.spec.js`, which also now waits on the state rather than the label.

A third followed on the reconnect test: five seconds is not long enough for
IndexedDB, a file read and a workbook parse when twelve workers share the
machine, so that poll now has twenty. After it, the suite ran clean in one go —
588 across both browsers, nothing failed.

Worth saying plainly: all three failures were the test rig, not the app. No run
ever wrote a file it should not have.

## Known gaps and deviations

- **The real picker and the real permission bubble are not exercised by any
  test**, because neither can be reached from Playwright or CDP (262). The e2e
  drives a double; the real thing was driven by hand through Windows UI
  Automation in the 8a spike, in both Chrome 152 and Edge 152.
- **An unreadable workbook is dealt with at the click**, not at the write, so
  the friend meets one extra click before "written it fresh" (273). Decoding on
  the write path would mean a synchronous parse inside logging an entry.
- **Protected View** is accepted (decision 36) and explained in both READMEs.
  Nothing in the page can prevent it.
- **The 23 pre-Phase-7 commits still carry `[redacted]`.** Untouched,
  as before; it blocks going public, not this phase.

## For the owner, at the device

Chrome and Edge, one run each:

1. DATA → **Create workbook** → save as `meridian.xlsx` in Documents. Log an
   entry; the file changes within the same second and the header reads
   SAVED · AUTO.
2. Close the browser and reopen the app. Log an entry → **one prompt** → click
   **Allow** (not Enter — Don't Allow holds the focus ring). Every later entry,
   category, goal and lesson writes with no prompt.
3. Do it again and dismiss the prompt: header reads **SAVE · 1**, the file does
   not move, and closing the tab makes the browser warn. Click the control →
   granted, written, SAVED · AUTO.
4. Open the workbook in Excel, type in a cell, save. Log an entry → **EDITED
   OUTSIDE**, and the file still holds your typing. Click → Keep local rewrites
   it; try the sequence again and take Replace local to see your Excel edit
   arrive in the app.
5. With everything saved, close the app, edit a cell in Excel, save, reopen →
   your edit is simply there, with no prompt.
6. Read the Protected View paragraph in the README against what Excel actually
   shows you.

## Commit log

```
dbf045b docs: decisions 32–35 and Phase 8 plan
acc0552 docs: phase 8a spike findings
6304c91 docs: phase 8a addendum, the same sequence in Chrome 152
d69c8a2 docs: decisions 34 and 35 amended, 36 added, 8a findings logged
d6e3855 docs: decision 37, the three moments the app and the file disagree
4f2b3aa phase 8: the linked workbook state machine, pure and tested
5fbf8d3 phase 8: the store's mirror hook and the linked workbook record
284865b phase 8: the linked workbook — adapter, header states, Data sheet block
683c0b0 phase 8: e2e for the linked workbook, both browsers green
82c9fbc phase 8: version 1.2.0, the Saving sections, matrix states and the log
```
