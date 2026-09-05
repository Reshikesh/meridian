# Phase 8a — spike report (5 Sep 2026)

Report only; no product code was written. Everything below was measured on this
machine, not read in a specification.

## What ran

- **Edge 152.0.4191.53** (Chromium 152), headed, driven by Playwright with a
  persistent profile, so "restart the browser" means launching the same profile
  again. **Chrome is not installed on this machine** — the registered browsers
  are Edge and Firefox — so every Chromium number below is Edge's.
- **Firefox 155** for the feature check, in its own throwaway profile.
- **Excel 16.0** (Office 16), opened and driven over COM, plus a stand-in
  lock-holder that opens the file with `FileShare.Read` / `FileShare.None`.
- A harness page (`harness.html`) loaded from `file://` that exposes the API
  under test, and a UI Automation helper for the parts the page cannot reach:
  the native picker and the permission bubble are browser UI, outside the page.
  Both live in this session's scratchpad, with the driver scripts `s1`–`s12`.

## The questions 8a asked

### A handle in IndexedDB, across a browser restart — **yes**

From `file://`, Edge reports `origin: "file://"`, `isSecureContext: true`, and
`showOpenFilePicker`, `showSaveFilePicker`, `createWritable`, `queryPermission`
and `requestPermission` all present. IndexedDB opens and a picked
`FileSystemFileHandle` structured-clones into it. Launching the same profile
again and reading it back gives a live handle (`instanceof FileSystemFileHandle`,
name intact). Two independent runs, one of them on a profile that had never
granted anything.

**No re-pick-per-session fallback is needed.** Decision 32's IndexedDB store
stands.

### `requestPermission({mode:'readwrite'})` from a submit-button click — **yes**

Called from a real form-submit handler it opens the prompt and resolves.
Wording in Edge, verbatim:

> **Allow this site to edit spike-workbook.xlsx?**
> file:/// will be able to edit spike-workbook.xlsx
> [ **Allow** ] [ **Don't Allow** ]

The origin reads as a bare `file:///`. Chrome's wording is likely to differ
(Chrome has used "Edit file"); untested here, see the open question.

### `queryPermission` after a restart — **`prompt`, every time**

| when | `queryPermission({mode:'readwrite'})` |
|---|---|
| straight after `showOpenFilePicker` | `prompt` (the open picker grants read only) |
| straight after `showSaveFilePicker` | **`granted`** — no prompt at all |
| after the grant, same session | `granted` |
| after a page reload, same browser session | `granted` — no second prompt |
| after the browser restarts | `prompt` — the grant is gone |

So decision 33's premise is exactly right: a grant lasts a browser session, and
Create workbook needs no grant on the session that created it.

### Dismissing the prompt

Escape resolves `requestPermission` with **`prompt`**, not `denied`, and
`queryPermission` still says `prompt`: the dismissal is not sticky and the next
ask prompts again. Clicking **Don't Allow** did the same thing — resolved
`prompt`, re-askable — so on Edge a refusal is not recorded either.

While the bubble is up the promise simply stays pending (5.7 s when it was
Escaped, 118 s and 193 s in two runs where a person answered it late).

### Writing while the file is held — **`InvalidStateError`, not `NoModificationAllowedError`**

With another program holding the file against writers (`FileShare.Read`, and
also `FileShare.None`), `createWritable()` rejects with, verbatim:

> `InvalidStateError: An operation that depends on state cached in an interface
> object was made but the state had changed since it was read from disk.`

The message is about staleness; the cause is the lock. Reads (`getFile()`)
still work while held. When the holder lets go, the very next write succeeds
with no re-read and no new grant — decision 35's "retry on the next mutation"
works as written.

**But Excel does not hold the workbook.** Modern Excel reads an `.xlsx` into
memory, releases the handle and leaves a `~$` marker; `FileShare.None` succeeds
against the file while the workbook sits open on screen, and mirror writes
succeed the whole time. The lock window is only the moment Excel loads or
saves. So the acceptance step "workbook open in Excel, log → WORKBOOK LOCKED"
will **not** reproduce as written (see the open questions).

### `lastModified` — safe to compare, if we record the right number

- Our own write moves it: measured `file.lastModified − our clock at close` of
  **−3 ms** in one run and **+94 ms** in another. A wall-clock comparison would
  self-trigger decision 34 in one of those two.
- The value is stable across repeated `getFile()` calls with no write between.
- An Excel save moves it plainly: +4404 ms and a different size.

**Change for 34:** after each mirror write, record the file's own
`(await handle.getFile()).lastModified`, not `Date.now()`. Then reconnect
compares like with like and never fires on our own writes.

### A write with no grant does not fail — it hangs

`createWritable()` on a handle whose permission is `prompt` raises the prompt
itself and the promise stays pending until a person answers. Measured 118 s and
193 s. So the mirror must ask `queryPermission` first and take the
**SAVE · n** path; it must never fire a write hoping for the best, or the queue
stalls behind an unanswered bubble.

### Concurrent writes lose data — the queue is load-bearing

Five `write()` calls fired at once on one handle: all five resolved `ok`, and
the file was left holding **write #2**. The same five in sequence: all `ok`,
file holds #5, ~110 ms each. Decision 32's "writes queued" is a correctness
requirement, not a nicety.

### Firefox 155 — the feature check must name the picker

```
showOpenFilePicker  undefined     FileSystemFileHandle        function
showSaveFilePicker  undefined     FileSystemWritableFileStream function
queryPermission     undefined     createWritable              function
```

`FileSystemFileHandle` exists in Firefox (for the origin-private file system),
so **a `FileSystemFileHandle in window` check would wrongly show the Link
controls there.** Decision 32 already names the right check —
`showOpenFilePicker` — and 8b must use exactly that.

## Two things nobody asked about, that change the build

### Chromium marks every file we write as coming from the internet

After a mirror write the workbook carries a `Zone.Identifier` stream:

```
[ZoneTransfer]
ZoneId=3
ReferrerUrl=file:///…/index.html
HostUrl=about:internet
```

Excel therefore opens the linked workbook in **Protected View** — the yellow
"Enable Editing" bar — from the first mirror onwards. Nothing is lost and the
data is intact, but the friend meets that bar every time they open their own
workbook. It cannot be turned off from the page. It belongs in the README in
plain words.

### Chromium refuses whole folders

Picking a file under `%LOCALAPPDATA%` (and the other blocked system paths) is
refused after the pick, with a dialog reading "file:/// can't open files in this
folder because it contains system files". A tester who keeps their workbook in
`AppData` cannot link it. Worth one line in the tester README; nothing to build.

## Do decisions 32–35 hold?

| # | verdict |
|---|---|
| 32 | **Holds.** IndexedDB carries the handle; `createWritable` → `close` is atomic and ~110 ms for a 16 KB workbook; the queue is required (five at once lose data); the feature check must be `showOpenFilePicker`, which is what it says. Add: mirrored files get a mark of the web. |
| 33 | **Holds.** Grant is per browser session and survives page reloads inside it; the submit-button click works; a dismissal is not sticky. Add: a write with no grant hangs on the prompt rather than failing, so the mirror must check `queryPermission` first and go to SAVE · n instead of writing. On Edge, "Don't Allow" behaves like a dismissal. |
| 34 | **Holds, with one correction.** Compare the file's own `lastModified`, recorded from `getFile()` after each mirror write, against the file's `lastModified` on reconnect. Wall-clock comparison self-triggers. |
| 35 | **Shape holds, detail is wrong.** The error is `InvalidStateError` with a message about cached state, not `NoModificationAllowedError`. 8b should treat *any* write rejection as WORKBOOK LOCKED except `NotAllowedError`, which means the grant is gone and belongs to 33's SAVE · n. Retry-on-next-mutation works. |

## For 8b

- The e2e plan is sound: **Playwright cannot reach the picker** — no
  `filechooser` event and no CDP `Page.fileChooserOpened` for
  `showOpenFilePicker` — so stubbing the pickers through `addInitScript` is the
  only way. The stub must also carry `queryPermission` / `requestPermission`,
  because the permission bubble is equally out of reach.
- `src/core/link.js` needs a `locked` state entered on any write rejection
  other than `NotAllowedError`, and a `needs-grant` state entered when
  `queryPermission` says `prompt` — before any write is attempted.
- The mirror records `lastModified` from the file itself after every write.

## Open questions for the owner (product)

1. **Chrome is not on this machine.** Either it gets installed before the 8b
   checkpoint, or v1.2.0 says "tested in Edge" and Chrome rides on being the
   same engine. Chrome's prompt wording differs from Edge's.
2. **The Excel acceptance step cannot pass as written**, because an open
   workbook is not a held file. Suggested replacement: *open the workbook in
   Excel, type in a cell and save while the app is running → the app keeps
   mirroring; reload and reconnect → the decision-15 prompt appears.* The
   WORKBOOK LOCKED state stays built and tested, driven by a real lock in the
   e2e suite rather than by Excel.
3. **Protected View**: accepted as a cost of linking, and explained in the
   README?

## Reproducing

The harness, the UI Automation helper, the Excel driver and the twelve run
scripts are in this session's scratchpad under `spike/`, with each run's raw
JSON beside it. `C:\Projects\meridian-spike-8a\` holds the 16 KB fixture
workbook and can be deleted.
