# vendor/

Nothing in this directory is fetched at runtime. Every file here is loaded from disk over `file://`
by `index.html` — there are no CDN links, no `fetch()` calls, no Google Fonts `<link>`, and no
network access of any kind once the app is open. The files were downloaded once, at the versions
pinned below, and are committed to the repository so the app runs offline from a zip. To re-verify
an unmodified checkout, run `sha256sum -c` against the checksums in the tables below, or from the
repository root:

```
cd vendor && sha256sum -c SHA256SUMS   # if you generate one from the tables below
```

All checksums recorded here were measured from the files as committed, so this README is
self-consistent evidence: if a file changes, its recorded hash stops matching.

Retrieved 2026-08-31. Total vendored: 1054310 bytes across 12 files.

**Re-verified 2026-09-04 (Phase 7).** All twelve recorded sha256s were recomputed from the working
tree and match. The four libraries were additionally re-downloaded from the pinned source URLs
below and compared byte-for-byte, so the versions in the table are proven upstream identities, not
just self-consistent local hashes — which matters because neither Preact UMD build carries a
version string inside it.

### CVE-2026-22028 (GHSA-36hm-qxxp-pg3m) — not applicable

Affects Preact 10.26.5 through 10.28.1; patched in 10.26.10, 10.27.3 and 10.28.2. **Meridian
vendors 10.29.8**, above the affected range, and 10.29.8 is also the current `latest` dist-tag on
npm — there is no newer 10.x to move to. `preact.umd.js` and `hooks.umd.js` were both confirmed
identical to `unpkg.com/preact@10.29.8/...` at re-verification, so the version is established from
the bytes rather than from this table. **No re-vendoring was required and none was done.** htm 3.1.1
and SheetJS 0.20.3 are unchanged.

## Load order

These are classic `<script src>` tags. Only one edge is load-bearing: **preact before hooks**. `htm.umd.js` and `xlsx.full.min.js` read nothing at load time and may go anywhere.

```
1. vendor/preact.umd.js
2. vendor/hooks.umd.js
3. vendor/htm.umd.js
4. vendor/xlsx.full.min.js
```

`vendor/xlsx.full.min.js` joined the list in Phase 1, when the workbook import/export landed. It sits in the vendor block, ahead of `src/`, rather than after the app: measured load with it in place is ~160 ms, and `src/ui/app.js` renders at load, so deferring the parse past the first render would buy nothing while risking a core module reaching for a namespace that is not there yet. It is read through `window.XLSX` in the browser and handed to `src/core/workbook.js` as a parameter, never as a global (see `docs/DECISION-LOG.md` #34).

**Warning — `hooks.umd.js` must never run before `preact.umd.js`.** The hooks UMD wrapper ends with
`t((n||self).preactHooks={},n.preact)`: it reads `n.preact` and hands it straight to the factory,
which immediately dereferences `.options` on it. If Preact has not run first, `n.preact` is
`undefined` and the script throws at load time:

```
TypeError: Cannot read properties of undefined (reading 'options')
```

Because that throw happens *before* the assignment completes, `window.preactHooks` is never
created. It stays `undefined`, later scripts still execute, and the app dies at the first hook with
`Cannot read properties of undefined (reading 'useState')` — pointing at a component file rather
than at the real cause, which is the script order in `index.html`. Verified empirically against
these exact files, both orders.

`htm.umd.js` and `xlsx.full.min.js` have no dependencies and are order-independent — each was
verified to load standalone into an empty global. Only the preact → hooks edge is load-bearing.

## Files

| File | Version | Global | Source URL | Licence | Bytes | sha256 |
|---|---|---|---|---|---|---|
| `preact.umd.js` | 10.29.8 | `window.preact` | https://unpkg.com/preact@10.29.8/dist/preact.umd.js | MIT | 11443 | `134b77bc803fa38661dc1b1e44e96eb0bb6a1a00edbb96d34dcde421b2e80b06` |
| `hooks.umd.js` | 10.29.8 | `window.preactHooks` | https://unpkg.com/preact@10.29.8/hooks/dist/hooks.umd.js | MIT | 3800 | `5c29238e5dc99df306d7f7fff038591a397cfcfabb59f81fbdef43d670aa0566` |
| `htm.umd.js` | 3.1.1 | `window.htm` | https://unpkg.com/htm@3.1.1/dist/htm.umd.js | Apache-2.0 | 1364 | `7a31776e04bd4afde0d4308177d26f377716fcf7e4bd70be590746d6aa594f08` |
| `xlsx.full.min.js` | 0.20.3 | `window.XLSX` | https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js | Apache-2.0 | 951904 | `cc015130aa8521e7f088f88898eba949ccdcbfb38df0bd129b44b7273c3a6f41` |
| `fonts/archivo-latin-400.woff2` | Archivo v25 | — | https://fonts.gstatic.com/s/archivo/v25/k3k6o8UDI-1M0wlSV9XAw6lQkqWY8Q82sJaRE-NWIDdgffTTNDNZ9xdp.woff2 | OFL-1.1 | 14700 | `07f9160163da2ec0f6376ef9d27a2bb8163f98019ba798da4baafb154e30056e` |
| `fonts/archivo-latin-500.woff2` | Archivo v25 | — | https://fonts.gstatic.com/s/archivo/v25/k3k6o8UDI-1M0wlSV9XAw6lQkqWY8Q82sJaRE-NWIDdgffTTBjNZ9xdp.woff2 | OFL-1.1 | 14600 | `ab74eca5ad115fe4cfec82ba641e5d37e4d92c58dfb1bfc1e464e9039c9d17cf` |
| `fonts/archivo-latin-600.woff2` | Archivo v25 | — | https://fonts.gstatic.com/s/archivo/v25/k3k6o8UDI-1M0wlSV9XAw6lQkqWY8Q82sJaRE-NWIDdgffTT6jRZ9xdp.woff2 | OFL-1.1 | 13820 | `d9e8c29fdd348edde2a4f9aae438e569dd165bbbdebda78495824a2d9aaa67e8` |
| `fonts/archivo-latin-700.woff2` | Archivo v25 | — | https://fonts.gstatic.com/s/archivo/v25/k3k6o8UDI-1M0wlSV9XAw6lQkqWY8Q82sJaRE-NWIDdgffTT0zRZ9xdp.woff2 | OFL-1.1 | 14508 | `abada6cd4c92a9a706f6d7ed3189f322ff43dd78b9402c7d1137465b861d2a04` |

All four WOFF2 files were confirmed to begin with the magic bytes `77 4f 46 32` (`wOF2`), and each
reports the expected `OS/2.usWeightClass` (400, 500, 600, 700 respectively), matching its filename.

## Licence texts

| File | Bytes | sha256 | Fetched from |
|---|---|---|---|
| `licences/preact-LICENSE.txt` | 1087 | `1fe6958409c8c257a70c587a18b6f7f412b179b456630790d30b2ec9a8e4b7d4` | https://unpkg.com/preact@10.29.8/LICENSE |
| `licences/htm-LICENSE.txt` | 11341 | `740725f7252e750af735d0028cc534970772f513331e9f68150fede8fb3ce00f` | https://unpkg.com/htm@3.1.1/LICENSE |
| `licences/sheetjs-LICENSE.txt` | 11355 | `4d2a38ac35cda06a555c84074a819d413339cd3691b822cae50f8f322fe01f64` | https://cdn.sheetjs.com/xlsx-0.20.3/package/LICENSE |
| `licences/archivo-OFL.txt` | 4388 | `108b4e57c9c796d3d38d0428ca7ee39de47ad93187302718d9b2d8864b9b716b` | https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/OFL.txt |

## Notes

**(a) `preact.umd.js` is the `umd:main` entry — do not substitute another build.** This is the file
whose wrapper assigns `(n||self).preact={}`. Two nearby files are wrong for our purposes and must
not be swapped in:

- `dist/preact.min.js` — what a bare `unpkg.com/preact` URL resolves to. This is the ESM/`module`
  build; it does not create `window.preact`.
- `dist/preact.min.umd.js` — a different UMD artefact.

If Preact is ever re-vendored, fetch the fully versioned `.../preact@<version>/dist/preact.umd.js`
path explicitly and re-confirm the wrapper contains `(n||self).preact=`.

**(b) Source maps are deliberately not vendored.** `preact.umd.js` and `hooks.umd.js` each end with
a `//# sourceMappingURL=` comment naming a `.map` file that is not present. This is inert: source
maps are only requested by DevTools when it is open with source maps enabled, never by the page
itself, so the app makes no request for them at runtime. **Do not delete these comments** (it would
change the file hashes recorded above for no benefit) and do not download the `.map` files.

**(c) Archivo — these are STATIC instances, not the variable font.** Google Fonts serves a variable
font to modern browsers. A variable font would be a single file with a weight axis; we need four
fixed weights, so the static instances were obtained by requesting the css2 API with a legacy
Chrome 60 User-Agent, which predates variable-font support and therefore triggers the static
fallback:

```
curl -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36" \
  "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700&display=swap"
```

The four `/* latin */` `src: url(...)` entries in that response are the URLs in the table above.
Re-running the command reproduces those exact URLs.

They were verified static by parsing each WOFF2 table directory: the tables present are
`GDEF GPOS GSUB OS/2 STAT cmap gasp glyf loca head hhea hmtx maxp name post prep`, with **no
`fvar`, `gvar`, `avar` or `cvar`** — i.e. no axis, no variation deltas, so nothing to interpolate.
(`STAT` is present and is expected: a static instance carries it to declare its own position on the
family's design axis. It does not make the font variable.) Note also that the `name` table reports a
cosmetic full name of the form "Archivo SemiBold Regular", an artefact of how Google generates
static instances from the variable source; `usWeightClass` is authoritative and correct, and
`@font-face` declares `font-weight` explicitly, so the internal name is never consulted.

**(d) Latin subset only — 230 codepoints.** Each file's `cmap` contains exactly 230 mapped
codepoints (ASCII + Latin-1 + typographic punctuation), spanning U+000D to U+FEFF, matching the
subset's declared `unicode-range`:

```
U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308,
U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD
```

**Archivo has no glyph for the following at any subset**, confirmed absent from the `cmap` of all
four vendored files:

| Codepoint | Character | Name |
|---|---|---|
| U+25B2 | ▲ | Black up-pointing triangle |
| U+25BC | ▼ | Black down-pointing triangle |
| U+25BE | ▾ | Black down-pointing small triangle |
| U+21A9 | ↩ | Leftwards arrow with hook |
| U+2713 | ✓ | Check mark |

In addition, **U+2192 → is stripped from every Google subset**. The latin `unicode-range` above
deliberately includes U+2191 ↑ and U+2193 ↓ but omits U+2192 →; it is absent from the `cmap`, and
no other subset restores it.

All six of these characters fall back to `system-ui`. **This matters for Log and Plan copy in later
phases**: any direction indicator, breadcrumb, tick or return affordance using these characters will
render in a different typeface, at a different weight and metric, than the surrounding Archivo text.
Prefer a drawn SVG mark or a CSS shape where the design calls for one of these.

**(e) SheetJS is no longer published to npm.** Versions from 0.20.0 onward are distributed only from
`cdn.sheetjs.com`; `npm install xlsx` resolves to a stale, deprecated package. Always fetch the
pinned CDN URL in the table above. The vendored file self-reports `XLSX.version === "0.20.3"`.

Emergency fallback only, if `cdn.sheetjs.com` is unreachable — the last npm-published release:

```
https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js
881727 bytes
sha256 c9506197caf809a075b6dee1da0d36fb19da7158ffe8a88e7b0c96c5d8623c99
```

This is an older release and is not equivalent; treat it as a stopgap and restore 0.20.3 when the
CDN is available.
