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

**Both pickers share an `id`** — intended to make the browser reopen them where
the workbook was last chosen rather than at Documents. **It does not work, and
the attempt is recorded rather than the intention**: see the known gaps below.
The picker still opens at Documents.

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

> **9 Sep 2026: gone from local history**, blob and all, in the rewrite below.
> **Still on the remote** until that is force-pushed, and see the note there
> about what a force-push does and does not reach on GitHub.

## The rewrite, written down at last

> **Run on 9 Sep 2026, on the owner's instruction, and it covered three jobs
> rather than two.** The owner also asked for their email out of the documents,
> and redacting it only in the working tree would have left it one `git log -p`
> away — so `--replace-text` went into the same pass. Verified afterwards: 59
> commits, all on the noreply address; `meridian.xlsx` in no revision and its
> blob gone from the object store; no hit for the address in any blob at any
> revision. The one commit that only did the redaction went empty, because its
> parent had been redacted too, and was pruned — 60 commits became 59. **Local
> only. Nothing has been force-pushed, and the repository is still private.**
> The command below is what ran, plus `--replace-text` and `--force`.

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

**What a force-push does not reach.** A force-push replaces the branch, but the
old commits stay in GitHub's object store, fetchable by anyone who knows a SHA,
until GitHub garbage-collects — which it does on its own schedule, not on ours.
While the repository is private nobody outside can learn a SHA, so this is not a
live exposure; the moment it goes public, it could be. The order that matters:
force-push first, then ask GitHub Support to run a GC on the repository, and
only flip Visibility → Public once that is confirmed. The alternative, which
needs no waiting on anyone, is to push the rewritten history to a brand-new
repository and delete this one — nothing carries over but the name, and the
private repo's stars and watchers are nought. Either is the owner's call.

Same reasoning for the draft releases: `meridian-1.3.0.zip` and its predecessor
were built from a tree that never contained the workbook, so the artefacts
themselves are clean. It is only the git objects that need the GC.

## Known gaps

- ~~**The picker's folder memory.**~~ **Closed, as a failure, 9 Sep 2026.** It
  does not work on `file://` and it is not going to. Tried twice at the device:
  with `startIn: 'documents'` beside the `id`, and without it. Edge opened at
  Documents both times. Chromium keys the remembered directory to the origin,
  and a `file://` page has nowhere to keep it — the same wall decision 32 works
  around, and the reason the handle lives in IndexedDB in the first place. The
  `id` is kept because it is free and correct the day this runs over http;
  `startIn` is back because something has to choose and predictable beats
  arbitrary (DECISION-LOG 286, 287). **Reconnecting after a site-data clear
  costs a few folder clicks.** Nothing else was ever on the table: the handle
  that would have made it one click is in the storage being cleared. None of
  this was testable — the real picker cannot be driven (262) and the e2e double
  ignores its options — so it was found the only way it could be, by the owner
  clicking it.
- **The second browser still has no hand pass**, carried over from Phase 8.
  Everything automated runs in both.
- **The Excel-edit path** — EDITED OUTSIDE, Keep local / Replace local — is
  still covered only by tests, by the owner's own choice.
- ~~**The 23 pre-Phase-7 commits and `meridian.xlsx`** are both still in
  history.~~ **Cleared from local history 9 Sep 2026**, along with the owner's
  email in the documents — one rewrite, three jobs. Still on the remote until
  it is force-pushed.

## Where to pick up

v1.3.0 is tagged and pushed; a draft release carries the zip. `main` is clean.
What is waiting:

1. ~~**The rewrite.**~~ **Run 9 Sep 2026; see the note in the section above.**
   All three problems are cleared in local history. What is left is the owner's:
   a force-push over the remote, and the visibility flip.
2. **The friend.** The zip is built, validated and attached to a draft release.
   Publishing it, or handing the file over directly, is the owner's move.
3. **The second browser's hand pass**, carried over from Phase 8 and still not
   done. Everything automated runs in both.
4. ~~**A decision on the version number in the header.**~~ **Taken by the owner,
   9 Sep 2026; shipped in v1.3.1.** The number sits under the wordmark in 9.5px
   dim type. The 7px estimated here was wrong: measured on the built thing, a
   tight two-line brand is 24.5px against the theme toggle's 29.8px, so at 1280
   the header does not grow at all. It costs 12.5px at 360, where the header
   wraps and the brand takes a row of its own. Still open from this item, and
   untouched: `dist/README-for-tester.md` never asks the friend to quote the
   version when something goes wrong.
5. ~~**A zip re-cut.**~~ **Cut, 9 Sep 2026: `dist/meridian-1.3.1.zip`.** One cut
   rather than three, as planned — the picker comments, this checkpoint, the
   changelog correction and the header line. Not tagged and not pushed: v1.3.1
   and what becomes of the draft release are the owner's move.
6. ~~**The Edge setting.**~~ **Turned off by the owner, 9 Sep 2026.** Their
   machine keeps Meridian's data across a browser close again. Everything built
   this phase stands regardless: the friend may have the same setting, and the
   overwrite trap was never conditional on it.
7. **First-render headroom**, unchanged from Phase 8: the 200 ms budget is thin
   on this machine for every build. DECISION-LOG 189 is the fix.

## Commit log

```
de0e6d0 phase 8c: the workbook survives a browser that clears site data
8c7218e phase 8c: v1.3.0, and the owner's workbook stops being tracked
```
