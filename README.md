# Meridian

A time tracker that records where your hours went, and projects when your goals land.

Time is the one resource you cannot earn more of, and most trackers spend their
effort on the wrong question — what you were doing, minute by minute, as though
the record itself were the point. Meridian keeps durations only: a date, a
length, a category. Every category carries a direction — **More**, **Less** or
**Upkeep** — so the app knows which way you wanted a number to move before it
shows it to you. Goals are fed by one category each, and their landing dates are
drawn in a straight line from the pace you have actually kept, not from the plan
you meant to keep. It runs from a folder on your own machine and never makes a
network request.

![The Log screen: a day of entries as durations, with the keyboard-first
quick-add row at the top.](docs/readme/log.png)

## Get it

1. Download the zip from [Releases](../../releases).
2. Unzip it somewhere you will find again.
3. Open the folder and double-click `index.html`.

That is the whole installation. There is nothing to install, no account to
create, and no network involved — the app makes no requests at all, and works
with the machine offline. Everything it needs, including its fonts and its two
libraries, is in the folder you unzipped.

## The five screens

- **Log** — a day's entries as durations, typed without leaving the keyboard.
- **Where it went** — a calendar and three charts over any range you pick.
- **Progress** — every live goal on one chart: hours banked so far, and the line on to its landing date.
- **Goals** — what each goal needs a week, against the pace you are keeping.
- **Lessons** — a journal, for whatever the numbers do not hold.

One rule worth knowing before you start: **the day changes over at 04:00, not
midnight**, so something logged at 1 a.m. counts as the previous day — the day
you were actually still living.

## Your data

Your entries live in this browser's storage, on this machine. Nothing is sent
anywhere, and there is no copy of it but yours. That cuts both ways:

- **Clearing your browser data deletes it.** So does using a different browser, or a different profile, or a private window — each is a separate storage area, and Meridian will look empty in one while your data sits in another.
- **Export to `.xlsx` from the Data sheet, regularly.** That file is the only backup that exists. It is an ordinary spreadsheet: open it, read it, edit it, import it back.
- **On `file://`, storage is shared by origin.** Every local HTML page opened in the same browser shares one storage area with Meridian, so another local page could in principle read or overwrite what Meridian has saved. Nothing on the internet can reach it. Be deliberate about what other HTML files you open from disk in the same browser.

## Browsers

Meridian is machine-tested in **Chromium** — that is where the automated suite
runs, and it is the browser the app is verified against. **Edge** passed the
suite on v1.0.0. **Firefox and Safari have not been tested**; they may work,
but nobody has checked, and no claim is made here that they do.

## Version

The version is in three places: the footer of the **Data** sheet, the bottom of
the first-run screen, and the tooltip on the wordmark. All three read
`MERIDIAN 1.1.0` from one constant.

Every workbook you export carries that same version in its **Meta** sheet, so a
file always says which build wrote it.

## A note for security scanners

Meridian vendors **SheetJS 0.20.3**, fetched from `cdn.sheetjs.com` and
committed to `vendor/` with its sha256 recorded in
[`vendor/README.md`](vendor/README.md).

SheetJS stopped publishing to npm after 0.19. The npm package named `xlsx` is
frozen at 0.18.5 and carries advisories that were fixed in later releases.
Because scanners match on the package name, **Snyk and `npm audit` may report
those 0.18.5 advisories against the vendored 0.20.3 file, which does not have
them**. This is a known false positive and the SheetJS documentation's own
advice is to suppress it. The version actually shipped here is verifiable: the
file self-reports `XLSX.version === "0.20.3"`, and its hash is recorded and
re-verified against the pinned CDN URL.

## For developers

The app itself has **zero dependencies** and no build step — `index.html` opened
from disk is the whole program. The tooling below is only for the tests.

```bash
npm ci
```

```bash
node --test "tests/unit/**/*.test.js"
```

```bash
npx playwright test
```

`npm run package` cuts the release zip. It is **Windows PowerShell only** — it
shells out to `Compress-Archive` — so it will not run on macOS or Linux as
written.

`docs/` holds the reasoning rather than the code: the spec, the product
decisions and their amendments, the quality bar the build is held to, the phase
plan, and the audit and checkpoint reports.

## Licence

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 RESH.

Third-party components are vendored under their own licences, each recorded with
its version, source URL and checksum in [`vendor/README.md`](vendor/README.md):
Preact (MIT), htm (Apache-2.0), SheetJS (Apache-2.0) and the Archivo typeface
(SIL Open Font License 1.1). Their full licence texts are in
`vendor/licences/`.
