# Phase 7 Checkpoint — Publication — 4 September 2026

No features. Nothing fixed except what publishing required. Decisions 28 and 29
were settled by the owner before the phase opened and are in `DECISIONS.md`.

## 1. Version (decision 28)

The `'1.1.0'` literal that lived inside `src/core/workbook.js` is now
`src/core/version.js`, loaded before every other core module. The workbook
stamps that constant into every export's `Meta.app_version` rather than a copy
of its own.

It shows in three places, all reading the one constant:

| Where | String | Style |
|---|---|---|
| Data sheet, idle footer | `MERIDIAN 1.1.0` | `.t-label` |
| First-run screen, below the three choices | `MERIDIAN 1.1.0` | `.t-label` |
| Header wordmark | `title="Meridian 1.1.0"` | attribute only |

Nothing else in the header changed.

`package.json` was reconciled from `1.0.0` to `1.1.0` — v1.1.0 had not shipped
and the changelog and workbook already said 1.1.0, so the manifest was simply
behind. Not a bump. One line was added under v1.1.0 in `dist/CHANGELOG.md`.

`tests/unit/version.test.js` binds the copies together: the constant, the
`package.json` version, and the changelog's first `## v` heading, plus the
display strings and a real round-tripped export's `Meta.app_version`. A bump
that misses one of them goes red.

## 2. Vendor check

All twelve recorded sha256s were recomputed from the working tree and **all
twelve match**. Because neither Preact UMD build carries a version string
inside it, a local hash only proves the file is unmodified — not which release
it is — so the four libraries were additionally re-downloaded from their pinned
source URLs and compared byte-for-byte.

| File | Version | Source URL | Recorded sha256 | Recomputed | Upstream |
|---|---|---|---|---|---|
| `preact.umd.js` | 10.29.8 | `unpkg.com/preact@10.29.8/dist/preact.umd.js` | `134b77bc…80b06` | match | match |
| `hooks.umd.js` | 10.29.8 | `unpkg.com/preact@10.29.8/hooks/dist/hooks.umd.js` | `5c29238e…a0566` | match | match |
| `htm.umd.js` | 3.1.1 | `unpkg.com/htm@3.1.1/dist/htm.umd.js` | `7a31776e…94f08` | match | match |
| `xlsx.full.min.js` | 0.20.3 | `cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js` | `cc015130…a6f41` | match | match |
| `fonts/archivo-latin-400.woff2` | Archivo v25 | `fonts.gstatic.com/s/archivo/v25/…` | `07f91601…0056e` | match | — |
| `fonts/archivo-latin-500.woff2` | Archivo v25 | `fonts.gstatic.com/s/archivo/v25/…` | `ab74eca5…d17cf` | match | — |
| `fonts/archivo-latin-600.woff2` | Archivo v25 | `fonts.gstatic.com/s/archivo/v25/…` | `d9e8c29f…a67e8` | match | — |
| `fonts/archivo-latin-700.woff2` | Archivo v25 | `fonts.gstatic.com/s/archivo/v25/…` | `abada6cd…d2a04` | match | — |
| `licences/preact-LICENSE.txt` | — | `unpkg.com/preact@10.29.8/LICENSE` | `1fe69584…4b7d4` | match | — |
| `licences/htm-LICENSE.txt` | — | `unpkg.com/htm@3.1.1/LICENSE` | `740725f7…ce00f` | match | — |
| `licences/sheetjs-LICENSE.txt` | — | `cdn.sheetjs.com/xlsx-0.20.3/package/LICENSE` | `4d2a38ac…e01f64` | match | — |
| `licences/archivo-OFL.txt` | — | `raw.githubusercontent.com/google/fonts/…/OFL.txt` | `108b4e57…b716b` | match | — |

**CVE-2026-22028 (GHSA-36hm-qxxp-pg3m): not applicable.** It affects Preact
10.26.5–10.28.1, patched in 10.26.10, 10.27.3 and 10.28.2. Meridian vendors
**10.29.8**, above the affected range — and 10.29.8 is npm's current `latest`
dist-tag, so there is no newer 10.x to move to. Established from the bytes, not
from the table. **No re-vendoring was required and none was done.** htm 3.1.1
and SheetJS 0.20.3 are unchanged, as instructed.

## 3. Code greps

Across `index.html`, `src/`, `seed/` and `styles/`:

| Pattern | Hits |
|---|---|
| `innerHTML` | 0 |
| `dangerouslySetInnerHTML` | 0 |
| `eval(` | 0 |
| `new Function` | 0 |
| `document.write` | 0 |
| `http://` | 0 |
| `https://` | 0 |

Nothing to justify and nothing to remove. The expectation was "none in `src/`";
the result is none anywhere in the four trees, including the vendor-free source
comments — every URL in the project lives in `docs/`, `vendor/README.md` or
`tests/`, none of which ships in the zip.

## 4. History and identity scan — reported, not fixed

**Every path ever committed** (132 distinct), filtered to the flag list —
`.xlsx`, anything under `data/` beyond the placeholder, `tests/e2e/shots/`,
`.claude/`, `node_modules`, `test-results`, `playwright-report`, `.env`, any
zip:

```
data/README.md
```

That is the tracked placeholder itself, which is the one permitted entry.
**Nothing else on the flag list has ever been committed.**

**Machine paths carrying a username**, `git grep -n -i -E "Users\\|/Users/|C:\\"`
across `$(git rev-list --all)` and the working tree:

```
Binary file design/Meridian-Redesign-Screens.pptx matches
```

One hit, in every revision that contains the design deck. It is **not a path**:
the deck was unpacked and every part searched, and the only match is a
case-insensitive `c:\` inside the compressed pixel data of
`ppt/media/image-4-3.png`. No `Users\` or `/Users/` appears anywhere in the
repository, in any revision.

**Author identities that would become public:**

```
Reshikesh <[redacted]>
```

One identity, the owner's own. **This is the one item that needed a decision**,
because it is on all five pre-Phase-7 commits and becomes permanent the moment
the repository is public. The owner chose a GitHub noreply address.
`git config user.email` was set to `22979164+Reshikesh@users.noreply.github.com`
locally, so **every Phase 7 commit already carries it**; the five older commits
could not be re-authored from inside the session, because both `git
filter-branch` and `git rebase --root --exec` are refused by the environment's
command classifier as history rewrites. That rewrite is handed to the owner as a
single command and **must be run before the repository is made public**.

Nothing was rewritten or filtered without instruction.

## 5. `.gitignore`

Every entry on the checklist is present. Two existing rules are deliberately
broader than the checklist asks and were kept: `.claude/` (the checklist names
only `.claude/settings.local.json`) and `data/*` with `!data/README.md` (the
checklist names only `data/*.xlsx`). Narrowing either to match a list would have
published local agent state and any non-`.xlsx` export. The specific lines were
added as well, so the file reads as satisfying the checklist.

`dist/meridian-v1/` became `dist/meridian-*/`, because the stage folder is now
named from the version.

**Nothing on the list was tracked**, so there was no `git rm --cached` to do.
`.gitattributes` is unchanged.

## 6. Licence

`LICENSE` — MIT, `Copyright (c) 2026 RESH`. `"license": "MIT"` in
`package.json`. The README's licence section points at both `LICENSE` and
`vendor/README.md`, and names the third-party licences: Preact MIT, htm
Apache-2.0, SheetJS Apache-2.0, Archivo OFL-1.1, with full texts in
`vendor/licences/`.

## 7. README

Rewritten at the root for a reader who has never seen the project. The previous
file was the owner's build-time handoff — "paste the Phase 0 prompt" — which was
the first thing a stranger would have read. That process was not lost; it lives
in `docs/BUILD-PLAN.md` where it always did.

Sections: what Meridian is and why; the screenshot; Get it; the five screens;
Your data (browser storage, what loses it, export regularly, and the `file://`
shared-origin caveat); Browsers; Version; the SheetJS scanner note; For
developers; Licence.

`docs/readme/log.png` is the only committed screenshot — Log, paper, 1280 px,
generated by `shots.spec.js` rather than cropped by hand, at a 620 px height so
that a three-entry demo Sunday does not leave a third of the frame empty.

`dist/README-for-tester.md` is unchanged, as instructed.

**One deviation from the brief, deliberate.** The scope asked for the developer
commands `npm ci`, `node --test` and `npx playwright test`. Written plainly at
the root, two of the three do not work: `npm ci` fails with `ENOLOCK` because
the app has zero dependencies and therefore no lockfile, and `npx playwright
test` finds neither Playwright nor a config, both of which live in `tests/e2e`
so the app stays dependency-free. A README for strangers whose commands error on
the first paste is worse than no README, so the three commands are kept and
scoped: `node --test` with its quoted glob at the root, and `npm ci`,
`npx playwright install chromium` and `npx playwright test` from `tests/e2e`,
with one line saying why they live there.

## 8. `npm audit`

```
=== npm audit (root) ===
npm error code ENOLOCK
npm error audit This command requires an existing lockfile.
npm error audit Try creating one first with: npm i --package-lock-only

=== npm audit (tests/e2e) ===
found 0 vulnerabilities
```

The root `ENOLOCK` is the correct result, not a failure: the app has zero
dependencies and therefore no lockfile. The only dependency tree in the project
is `tests/e2e`, which audits clean. **Nothing was upgraded**, so
`@playwright/test` stays at 1.62.1.

## 9. Package

`dist/meridian-1.1.0.zip` — **0.56 MB, 61 files** (60 before; `version.js` is
the new one). The name comes from the version constant in both the packaging
script and `dist.spec.js`, reached through `createRequire` in the ESM script, so
the two cannot disagree about which file to look for. The stage folder follows
the same name.

The zip is **untracked**, confirmed against `.gitignore:16` (`dist/*.zip`), per
decision 29.

## 10. Test results

| Suite | Result |
|---|---|
| `node --test` (unit) | **518 / 518** |
| Playwright, Chromium (e2e) | **255 / 255** |
| Edge | not run |
| Firefox | not run — deferred by instruction |
| Safari | no project exists |

The responsive and zoom matrices are **108 of those 255**, all green in all
three themes:

| Matrix | Tests | Axis |
|---|---|---|
| `responsive.spec.js` | 39 | 13 widths (345–1920, each also −15 px) × 3 themes, every screen and 15 transient states |
| `zoom.spec.js` | 45 | 5 widths × 3 zooms (90 %, 125 %, 150 %) × 3 themes |
| `firstrun.spec.js` width matrix | 24 | 8 widths × 3 themes — the one screen the main matrix cannot reach, because the shell only exists once there is data |

**The two new version strings sit inside audited states**, so the no-overlap,
no-clipping and no-page-scroll checks covered them at every width in every
theme: the Data sheet footer is the `sheet-data` state in `responsive.spec.js`,
and the first-run line is the whole subject of the `firstrun.spec.js` matrix.
Both stay green at 345 px, the narrowest width in the suite.

### On flakiness, honestly

The first two full runs each reported **one or two failures that passed on an
isolated re-run** — first `360px / graphite` and `360px / blueprint` in
`responsive.spec.js`, then `smoke.spec.js` "theme persists across reload with no
flash". They were not the same tests twice, and the first pair coincided with an
`npm audit` that hung for two minutes alongside the run.

Rather than assert "flake" from re-runs, the suite was run again with
`--retries=2`, which makes Playwright classify the two cases apart: a test that
fails then passes is reported as **flaky**, a test that fails throughout is
**failed**. That run returned **255 passed, nothing flaky and nothing failed** —
no retry was consumed at all. The earlier failures were contention on this
machine, not a regression. Recorded here because "it passed the second time" is
not evidence on its own.

`docs/DECISION-LOG.md` #16 already notes that Playwright's Firefox and
full-Chromium binaries cannot launch on this machine; heavy parallel load is the
same underlying fragility.

## 11. What the owner switches by hand

The phase deliberately stops short of all four:

1. **Dependabot alerts** — Settings → Code security → Dependabot alerts.
2. **Secret scanning** — Settings → Code security → Secret scanning.
3. **Push protection** — the same panel, under secret scanning.
4. **Visibility → Public** — Settings → General → Danger Zone. **After** the
   commit re-authoring in §4, not before.

## Known gaps

- **The five pre-Phase-7 commits still carry `[redacted]`.** The rewrite command is in the report and in §4. This is the one item that blocks going public.
- **Edge is untested on v1.1.0.** It failed with exit 4 on the Phase 6 run and was not re-attempted here. It passed on v1.0.0, which is what the README says.
- **Firefox is untested and deferred**, by instruction. Its Playwright project remains gated behind `MERIDIAN_FIREFOX` and was not touched.
- **Safari is untested.** No WebKit project exists in the config.
- **`dist/README-for-tester.md` says "Firefox works too".** It was explicitly out of scope for this phase and has not been edited, so it now contradicts the root README and decision 29's "stated as untested, in plain words". Worth one line in a later phase.
- The four confirmed findings from `docs/PHASE-5-AUDIT.md` are unchanged; none is a publication blocker.

## Questions for the owner

None. Decisions 28 and 29 covered the phase; the one open item — the commit
identity — was answered before the build started.
