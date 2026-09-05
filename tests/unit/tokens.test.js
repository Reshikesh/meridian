'use strict';

/* Token table audit — QUALITY-BAR §7: "Text contrast meets 4.5:1 for body and
   labels and 3:1 for large headings in every theme (automated check on the
   token table)."

   Reads styles/tokens.css directly, so it fails if a token is ever edited. */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CSS = fs.readFileSync(
  path.join(__dirname, '..', '..', 'styles', 'tokens.css'), 'utf8');

function parseThemes(css) {
  const themes = {};
  for (const block of css.matchAll(/:root\[data-theme="(\w+)"\]\s*\{([^}]*)\}/g)) {
    const tokens = {};
    for (const decl of block[2].matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
      tokens[decl[1]] = decl[2].trim();
    }
    themes[block[1]] = tokens;
  }
  return themes;
}

function channels(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.substr(i, 2), 16));
}

// WCAG 2.1 relative luminance.
function luminance(hex) {
  const linear = channels(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a, b) {
  const l1 = luminance(a);
  const l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const THEMES = parseThemes(CSS);
const THEME_IDS = ['paper', 'graphite', 'blueprint'];

const TOKENS = ['--bg', '--strip', '--ink', '--ink2', '--line', '--line2',
  '--brand', '--brandink', '--warn', '--warnbg', '--good', '--navbg', '--navink',
  '--navdim', '--grid', '--axis', '--axisink', '--pale', '--veil'];

test('all three themes define all nineteen tokens (spec §5)', () => {
  assert.deepEqual(Object.keys(THEMES).sort(), [...THEME_IDS].sort());
  for (const id of THEME_IDS) {
    for (const token of TOKENS) {
      assert.ok(THEMES[id][token], `${id} is missing ${token}`);
    }
  }
});

/* Text pairs the app actually renders. Every one clears 4.5:1 in every theme. */
const TEXT_PAIRS = [
  ['--ink', '--bg'],        // body text on the page
  ['--ink2', '--bg'],       // labels, captions, empty-state notes
  ['--ink', '--strip'],     // text on a strip band
  ['--ink2', '--strip'],    // the empty-state note sits here
  ['--navink', '--navbg'],  // header, hovered nav
  ['--navdim', '--navbg'],  // header, resting nav and the date stamp
  ['--brandink', '--brand'],// active nav and theme pills
  ['--brand', '--bg'],
  ['--good', '--bg'],
  ['--axisink', '--bg'],
  ['--ink', '--pale']
];

test('body and label text meets 4.5:1 in every theme', async (t) => {
  for (const [fg, bg] of TEXT_PAIRS) {
    await t.test(`${fg} on ${bg}`, () => {
      for (const id of THEME_IDS) {
        const ratio = contrast(THEMES[id][fg], THEMES[id][bg]);
        assert.ok(ratio >= 4.5,
          `${id}: ${fg} (${THEMES[id][fg]}) on ${bg} (${THEMES[id][bg]}) is ${ratio.toFixed(2)}:1`);
      }
    });
  }
});

/* Three pairs in the spec's own token table fall just under 4.5:1, all of them
   on blueprint. The tokens are verbatim from spec §5 and CLAUDE.md forbids
   changing them, so this is recorded rather than fixed — and pinned, so it
   cannot quietly get worse or spread to another theme.

   None of these pairs is rendered anywhere in Phase 0; --warn text arrives with
   validation messages in Phase 2. Reported to the owner at the checkpoint. */
const KNOWN_BELOW_4_5 = [
  { fg: '--warn', bg: '--bg', theme: 'blueprint', ratio: 4.41 },
  { fg: '--warn', bg: '--warnbg', theme: 'blueprint', ratio: 4.30 },
  { fg: '--ink2', bg: '--pale', theme: 'blueprint', ratio: 4.48 }
];

test('the known sub-4.5:1 pairs are exactly these three, and none is below 3:1', async (t) => {
  for (const known of KNOWN_BELOW_4_5) {
    await t.test(`${known.fg} on ${known.bg} (${known.theme})`, () => {
      const ratio = contrast(THEMES[known.theme][known.fg], THEMES[known.theme][known.bg]);
      assert.ok(Math.abs(ratio - known.ratio) < 0.01,
        `expected ${known.ratio}:1, measured ${ratio.toFixed(2)}:1`);
      assert.ok(ratio >= 3, `${ratio.toFixed(2)}:1 has dropped below the 3:1 floor`);
      assert.ok(ratio < 4.5, `${ratio.toFixed(2)}:1 now passes — remove it from KNOWN_BELOW_4_5`);
    });
  }

  await t.test('the same pairs pass in paper and graphite', () => {
    for (const known of KNOWN_BELOW_4_5) {
      for (const id of ['paper', 'graphite']) {
        const ratio = contrast(THEMES[id][known.fg], THEMES[id][known.bg]);
        assert.ok(ratio >= 4.5,
          `${id}: ${known.fg} on ${known.bg} is ${ratio.toFixed(2)}:1`);
      }
    }
  });
});

/* The theme-toggle group's 1px border is near-invisible on graphite (1.34:1) and
   blueprint (1.41:1), because both themes use a --navbg close to --line. On
   paper the header is dark and the border reads clearly. That is verbatim from
   the mockup, not a regression; pinned here so a future token edit cannot change
   it without a test failing. */
test('the theme-toggle border ratio against the header is recorded, not fixed', () => {
  const measured = THEME_IDS.map((id) =>
    +contrast(THEMES[id]['--line'], THEMES[id]['--navbg']).toFixed(2));
  assert.deepEqual(measured, [13.45, 1.34, 1.41]);
});

/* src/core/colour.js decides whether a category swatch needs the 1px --line
   outline QUALITY-BAR §7 asks for on graphite, which means it has to know each
   theme's --bg. It carries its own copy of those three values because it must
   run in the browser with no access to the stylesheet; this is the assertion
   that stops the copy drifting from the source. */
test('colour.THEME_BG matches --bg in tokens.css', () => {
  const colour = require('../../src/core/colour.js');
  for (const id of THEME_IDS) {
    assert.equal(colour.THEME_BG[id], THEMES[id]['--bg'], id);
  }
  assert.deepEqual(Object.keys(colour.THEME_BG).sort(), [...THEME_IDS].sort());
});

/* Decision 31. An unpickable calendar day used to be outlined in --line2, which
   is the SAME HEX as --pale in paper and graphite and within 1.03:1 of it in
   blueprint — so a day before the first logged one was drawn in exactly the
   colour an available day is filled with, and the refusal read as a bug rather
   than as a rule. This reads the token back out of components.css, so neither
   the stylesheet nor the token table can drift into that state again. */
const COMPONENTS = fs.readFileSync(
  path.join(__dirname, '..', '..', 'styles', 'components.css'), 'utf8');

// The selector may share its rule with others on following lines, so find the
// declaration block rather than assuming the brace sits on the same line.
function ruleBlock(css, selector) {
  const at = css.indexOf('\n' + selector);
  assert.notEqual(at, -1, `components.css has no ${selector} rule`);
  const open = css.indexOf('{', at);
  return css.slice(open, css.indexOf('}', open));
}

test('the unavailable calendar day is not drawn in the available day colour', () => {
  const block = ruleBlock(COMPONENTS, '.cal__fill--off');
  const token = /border:[^;]*var\((--[\w-]+)\)/.exec(block);
  assert.ok(token, '.cal__fill--off must take its border colour from a token');
  const ink = token[1];

  for (const id of THEME_IDS) {
    const theme = THEMES[id];
    assert.ok(theme[ink], `${id} has no ${ink}`);
    assert.notEqual(theme[ink].toLowerCase(), theme['--pale'].toLowerCase(),
      `${id}: an unavailable day is outlined in ${ink}, the same colour --pale fills an available one with`);
    // Comfortably clear of the 1.11-1.22:1 --line2 gave, in every theme.
    const vsBg = contrast(theme[ink], theme['--bg']);
    assert.ok(vsBg >= 3, `${id}: ${ink} on --bg is ${vsBg.toFixed(2)}:1, too faint to read as a state`);
    const vsPale = contrast(theme[ink], theme['--pale']);
    assert.ok(vsPale >= 2.5, `${id}: ${ink} against --pale is ${vsPale.toFixed(2)}:1`);
  }
});

/* The refusal flash is the typed-date revert, on a cell: the same two
   properties, so the app has one way of saying "no" (decision-log #135). */
test('the refused-day flash uses the same tokens as the reverted date field', () => {
  const cell = ruleBlock(COMPONENTS, '.cal__fill--refused');
  const field = ruleBlock(COMPONENTS, '.rail__input--reverted');
  for (const token of ['--warnbg', '--warn']) {
    assert.ok(cell.includes('var(' + token + ')'), `.cal__fill--refused must use ${token}`);
    assert.ok(field.includes('var(' + token + ')'), `.rail__input--reverted must use ${token}`);
  }
});
