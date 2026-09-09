# Meridian

**A free, offline time tracker that shows where your hours actually went — and
projects when your goals will land.**

No account, no server, no network requests. Download, unzip, double-click
`index.html`. Your data stays in your browser and in a spreadsheet you own.

![Meridian's Log screen: one day's time entries as durations, with a
keyboard-first quick-add row at the top and a week of hours along the
bottom.](docs/readme/log.png)

![Meridian's Where it went screen: a fortnight of tracked hours split by
category in a flow chart, each band coloured by whether you wanted more of that
category, less of it, or neither, beside a calendar of logged
days.](docs/readme/went.png)

## Get it

**[Download the latest release](../../releases/latest)**, unzip it, and
double-click `index.html`.

That is the whole installation: nothing to install, no account to create, no
build step, and it works with the machine offline. The fonts and the two
libraries are in the folder you unzipped.

Cloning this repository works too — the root **is** the app. The `dist/` folder
here holds only the changelog and the tester's notes; the runnable build is the
release zip.

## How it works

Meridian records **durations, not clock times**: a date, a length, a category.
Every category carries a direction — **More**, **Less** or **Upkeep** — so the
app knows which way you wanted a number to move before it shows it to you.
Goals are fed by one category each, and their landing dates are drawn in a
straight line from the pace you have actually kept, not the plan you meant to
keep.

The day changes over at **04:00, not midnight**, so something logged at 1 a.m.
counts as the previous day — the day you were actually still living.

## The five screens

- **Log** — a day's entries, typed without leaving the keyboard.
- **Where it went** — a calendar and three charts over any range you pick.
- **Progress** — every goal on one chart: hours banked, and the line on to its landing date.
- **Goals** — what each goal needs a week, against the pace you are keeping.
- **Lessons** — a journal, for whatever the numbers do not hold.

## Your data

Your entries live in this browser's storage, on this machine. Nothing is sent
anywhere and there is no copy of it but yours. That cuts both ways:

- **Clearing your browser data deletes it.** So does a different browser, a different profile, or a private window — each is a separate storage area, and Meridian will look empty in one while your data sits in another.
- **Export to `.xlsx` regularly.** That file is the only backup that exists. It is an ordinary spreadsheet: open it, read it, edit it, import it back.
- **On `file://`, storage is shared by origin.** Another local HTML page opened in the same browser could in principle read or overwrite what Meridian saved. Nothing on the internet can reach it.

## Saving

**Export.** The Data sheet writes an `.xlsx` and your browser downloads it.
Works everywhere; the header counts what you have changed since the last one.

**A linked workbook — Chrome and Edge only.** Point Meridian at a spreadsheet
once, and every entry, category, goal and lesson is written straight into that
file as you go. The header reads **SAVED · AUTO** and there is nothing to
remember to press.

Three things worth knowing about a linked workbook:

- **Your browser asks once a session.** The first change after opening Meridian raises *Allow this site to edit meridian.xlsx?* — **click Allow**, rather than pressing Enter, which lands on Don't Allow. Dismiss it and the header reads **SAVE · 3** in red until you click it. Nothing is lost while it waits.
- **Excel opens the file in Protected View**, because a browser wrote it. It is harmless. To stop it for good: **File → Options → Trust Center → Trust Center Settings → Trusted Locations**.
- **Edit the workbook yourself and Meridian notices.** Nothing is written over: the header says **EDITED OUTSIDE**, and clicking it asks whether to keep what is in Meridian or take what is in the file.

Firefox and Safari have no file picker, so none of this appears there and
Export works as it always has.

## Browsers

Machine-tested in **Chromium** and **Edge**, both running the full automated
suite including the linked workbook; **Chrome 152** was checked by hand.
**Firefox and Safari are untested** — they may work, but nobody has checked, and
no claim is made here that they do. Neither has the file picker, so neither
offers a linked workbook.

## Version

One constant, four places: under the header wordmark, in the **Data** sheet
footer, on the first-run screen, and in the wordmark's tooltip. Every workbook
you export carries the same version in its **Meta** sheet, so a file always says
which build wrote it.

## A note for security scanners

Meridian vendors **SheetJS 0.20.3** from `cdn.sheetjs.com`, with its sha256
recorded in [`vendor/README.md`](vendor/README.md).

SheetJS stopped publishing to npm after 0.19, so the npm package named `xlsx` is
frozen at 0.18.5 with advisories that were fixed in later releases. Scanners
match on the package name, so **Snyk and `npm audit` may report those 0.18.5
advisories against the vendored 0.20.3 file, which does not have them** — a
known false positive, and SheetJS's own advice is to suppress it. The file
self-reports `XLSX.version === "0.20.3"`, and its hash is re-verified against
the pinned CDN URL.

## For developers

The app has **zero dependencies** and no build step — `index.html` opened from
disk is the whole program. There is no root lockfile because there is nothing to
lock; the tooling below is only for the tests.

Unit tests need no install at all:

```bash
npm run test:unit
```

Playwright installs inside `tests/e2e`, so the app stays dependency-free:

```bash
npm run e2e:setup
```

```bash
npm run test:e2e
```

`npm run package` cuts the release zip. It is **Windows PowerShell only** — it
shells out to `Compress-Archive`.

`docs/` holds the reasoning rather than the code: the spec, the product
decisions, the quality bar, the phase plan and the checkpoint reports.

## Licence

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 RESH.

Vendored components keep their own licences, each recorded with its version,
source URL and checksum in [`vendor/README.md`](vendor/README.md):
Preact (MIT), htm (Apache-2.0), SheetJS (Apache-2.0) and the Archivo typeface
(SIL Open Font License 1.1). Their full licence texts are in
`vendor/licences/`.
