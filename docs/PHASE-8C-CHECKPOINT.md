# Phase 8c Checkpoint — a browser that clears site data — 9 September 2026

v1.3.0. The owner closed Edge, reopened Meridian, and met the first-run screen:
Edge is set to clear cookies and other site data on close, which is where both
the dataset and the linked file handle live. Ten clicks to get back to a state
the app had already written to disk — and one of those clicks was a button that
would have destroyed the workbook.

This phase came from a Word document of screenshots rather than a plan.

## What the screenshots showed

The reopen, click by click: first-run screen → **Start empty** → DATA → **Link
workbook** → four clicks navigating to the folder → **Replace local data** →
**Save changes** (the browser grant) → **Done**. Ten, every session.

Two findings underneath it:

- **The root cause is a browser setting, not Meridian.** Edge → Settings →
  Privacy, search, and services → *Clear browsing data on close* →
  **Cookies and other site data: ON**. That erases `localStorage` and IndexedDB
  together, so the dataset and the handle go at the same moment. Confirmed with
  a throwaway diagnostic page that wrote a marker into both and reported
  "First run" on every launch. A clean Chromium profile keeps both across a
  restart, which is what the 8a spike had measured — so nothing about `file://`
  is at fault.
- **A defect that no test would have caught.** Linking a workbook raised the
  two-way prompt whenever the *file* held data, without ever asking whether the
  *app* did. On the first-run screen that put `Keep local, overwrite the
  workbook` in the brand colour, under Enter, with an empty dataset behind it.
  The owner took the safe option. The layout was pointing at the other one.

## What was built

**The prompt is asked only when there is something to lose** — `linkWorkbook()`
gates on `hasContent(store.getState())`, not on the file. An app holding nothing
opens the workbook and writes nothing. This is decision 37 B's own reasoning ("a
question with one sensible answer is not asked") applied to the moment before
it.

**The two conflict moments lead with opposite buttons** — an outside edit
interrupts work still in the app, so `Keep local` keeps the brand and the
autofocus it has had since DECISION-LOG 274. A link is a file the friend went
and chose, holding data counted in the report below, so `Replace local` leads
there. One `reason` prop, one view, one report.

**A mirror write is a save, not an export** — `exportInfo` carries `saved_at`
beside `exported_at`, and the Data sheet names whichever is newer. Decision 32
is untouched: the write still clears the counter. With no workbook linked
`saved_at` is never set and the line reads exactly as it always has.

**Both pickers share an `id`** — the browser reopens them where the workbook was
last chosen rather than at Documents. That memory lives in the browser profile,
not in site data, which is the whole point of it: it is the one crumb that
survives the clearing that loses everything else. `startIn` stays as the
fallback for the first ever pick.

**"Open a workbook" leads the first-run screen** where `showOpenFilePicker`
exists — its own row above the three original choices, both loading the data and
linking the file. Firefox and Safari see the three they always saw.

**The wipe is named at the moment it is recovered from**, because it cannot be
detected. Meridian holding nothing while the workbook holds a fortnight means
either a browser that cleared site data or a machine meeting the file for the
first time, and the two are indistinguishable from inside the page: everything
that would have been evidence is in the storage that was cleared. So there is no
detector — the `opened` view says what happened and names the Edge setting.

**The tester README** named private windows and nothing else under "nothing
saves between visits". It now names the clear-on-close setting in both browsers,
with the menu path, and the one-click way back.

## The copy, for the owner to change

New strings, in the app's voice, none of them from the mockup:

- The link prompt: **"This workbook already has data in it."** (was reusing
  "Your workbook changed outside Meridian", which was false at that moment)
- The recovery: **"Your workbook is open."** · "Meridian had nothing in it, so
  everything here came from the file. If Meridian is empty every time you start,
  your browser is clearing its data when it closes. In Edge: Settings → Privacy,
  search, and services → Clear browsing data on close → turn off
  'Cookies and other site data'."
- First run: **Open a workbook** · "Pick the .xlsx Meridian keeps up to date.
  Everything in it comes back, and logging saves straight to it."
- The Data sheet's top line: **Saved just now** / **Saved 5 hours ago**

## Test results

- **Unit: 587 pass**, including two new for the timestamp split.
- **e2e: 600 pass** across chromium and msedge, including six new in
  `link.spec.js` — the empty-app link, both prompt defaults, the Saved label,
  the first-run open path, and a picker-less browser keeping its three choices.
- **Responsive: 39** · **zoom: 45**, both with the new `sheet-opened` state at
  every width, zoom and theme.
- **`dist.spec.js`: 4 pass** against the re-cut `meridian-1.3.0.zip`
  (0.57 MB, 63 files).

**On the full run's twelve failures.** One full-suite run reported 12 failing,
all msedge, all `Test timeout exceeded` — no assertion, no clipped text, no
overlap. It also took 6.4 hours against 21.7 minutes for the same suite earlier
that day, so the machine was starved. Re-running exactly those twelve plus the
rest of their files: 58/58 in 4.9 minutes. A separate run had
`shots.spec.js › the linked workbook, every state` fail in msedge and pass
alone; it passed in the next full run. Both were the rig under load, not the
app, and the pattern matches the flakes Phase 8 documented. No run ever wrote a
file it should not have.

## What the screenshots changed

Looking at them found one defect a test would never have reported:

- **The lead card first spanned the options grid** (`grid-column: 1 / -1`),
  which stops `auto-fit` collapsing empty tracks. The grid resolved five 240px
  columns at 1280 and the three original cards stopped filling the row they have
  filled since Phase 1. Nothing asserts that a row is full. Moved out of the
  grid; the three are the layout they were.

And one guard carried across:

- **An unreadable pick on the first-run screen** would have opened a Data sheet
  offering to export a dataset that does not exist. `handleFile` already had
  that guard; `linkWorkbook` now has it too.

## The owner's workbook was in git history

`meridian.xlsx` — the owner's real logged time — was committed in `662d71d`, the
last commit of the previous session. `.gitignore` covered `data/*.xlsx` only, so
a workbook at the repository root walked past it. Phase 7's audit checked for
exactly this and found nothing, because the file was created the day after.

Untracked here (`git rm --cached`, the file itself untouched on disk) and
`*.xlsx` added to `.gitignore`. **It is still in history, and on the remote** —
the repository is private, so it is not public, but removing it is a rewrite and
belongs in the same pass as the commit re-author rather than a second one.

## The rewrite, written down at last

Phase 7 §4 says the command "is handed to the owner" but no command was ever
written into any document. Here it is, now covering both jobs. **Run this from
the repository root, with no other work in progress.** `git filter-repo` is not
installed on this machine; install it first.

```bash
pip install git-filter-repo
```

Write the identity map to `../meridian-mailmap.txt` (outside the repository, so
the rewrite does not see it):

```
Reshikesh <22979164+Reshikesh@users.noreply.github.com> <[redacted]>
```

Then, in one pass — re-author the 23 commits and strip the workbook from every
revision:

```bash
git filter-repo --mailmap ../meridian-mailmap.txt --path meridian.xlsx --invert-paths
```

`filter-repo` deliberately drops the remote, so put it back and force-push both
the branch and the rewritten tags:

```bash
git remote add origin https://github.com/Reshikesh/meridian.git
git push --force origin main
git push --force --tags origin
```

Check it took — this should print only the noreply address, and nothing at all:

```bash
git log --format='%ae' | sort | uniq -c
git log --all --oneline -- meridian.xlsx
```

**What this breaks.** Every commit SHA changes. Both draft releases point at
tags whose SHAs move, so check they still resolve and re-attach the zips if they
do not. Any other clone of this repository must be deleted and re-cloned rather
than pulled. Nothing else depends on the old hashes.

## Known gaps

- **The picker's folder memory is unverified.** The `id` should make Chromium
  reopen the picker where the workbook was last chosen, and that memory should
  survive site-data clearing because it lives in the browser profile. Neither
  half is provable from a test — the real picker cannot be driven (262) — and
  neither has been checked by hand. If it turns out not to survive, the cost is
  a few folder clicks and nothing else.
- **The second browser still has no hand pass**, carried over from Phase 8.
  Everything automated runs in both.
- **The Excel-edit path** — EDITED OUTSIDE, Keep local / Replace local — is
  still covered only by tests, by the owner's own choice.
- **The 23 pre-Phase-7 commits and `meridian.xlsx`** are both still in history.
  One rewrite, above, clears both.

## Where to pick up

v1.3.0 is tagged and pushed; a draft release carries the zip. `main` is clean.
What is waiting:

1. **The rewrite.** The command is above. It is the only thing blocking the
   repository going public, and it now clears two problems rather than one.
2. **The friend.** The zip is built, validated and attached to a draft release.
   Publishing it, or handing the file over directly, is the owner's move.
3. **Two hand checks at the device** — the picker's folder memory across a
   browser restart, and the second browser's pass.
4. **The Edge setting**, if the owner wants their own machine to stop doing
   this: Settings → Privacy, search, and services → Clear browsing data on close
   → turn off Cookies and other site data. The other four toggles can stay on.
5. **First-render headroom**, unchanged from Phase 8: the 200 ms budget is thin
   on this machine for every build. DECISION-LOG 189 is the fix.

## Commit log

```
de0e6d0 phase 8c: the workbook survives a browser that clears site data
8c7218e phase 8c: v1.3.0, and the owner's workbook stops being tracked
```
