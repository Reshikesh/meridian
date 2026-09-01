'use strict';

/* QUALITY-BAR §7: a category swatch under 3:1 against the theme's own --bg is
   drawn with a 1px --line outline rather than being changed. This suite pins
   the maths and — with tokens.test.js — the fact that THEME_BG still matches
   styles/tokens.css. */

const test = require('node:test');
const assert = require('node:assert');
const colour = require('../../src/core/colour.js');

/* The nine fixed category hexes of spec §5 / §9. */
const SWATCHES = ['#2b7d5d', '#c8291a', '#a8641d', '#7d2b5d', '#2b4a7d',
  '#6b4a7d', '#5a6b7d', '#6b6b5a', '#4a6b8a'];

test('parseHex', async (t) => {
  await t.test('reads a six-digit hex with or without the hash', () => {
    assert.deepEqual(colour.parseHex('#2b4a7d'), [43, 74, 125]);
    assert.deepEqual(colour.parseHex('2b4a7d'), [43, 74, 125]);
  });

  await t.test('expands a three-digit hex', () => {
    assert.deepEqual(colour.parseHex('#fff'), [255, 255, 255]);
  });

  await t.test('is case-insensitive and tolerates surrounding space', () => {
    assert.deepEqual(colour.parseHex('  #2B4A7D '), [43, 74, 125]);
  });

  await t.test('refuses anything that is not a hex', () => {
    for (const bad of ['', 'red', '#12345', '#1234567', 'rgb(0,0,0)', null, undefined, 42]) {
      assert.equal(colour.parseHex(bad), null, String(bad));
    }
  });
});

test('contrastRatio', async (t) => {
  await t.test('black on white is the 21:1 maximum', () => {
    assert.ok(Math.abs(colour.contrastRatio('#000000', '#ffffff') - 21) < 1e-9);
  });

  await t.test('a colour against itself is 1:1', () => {
    assert.ok(Math.abs(colour.contrastRatio('#2b4a7d', '#2b4a7d') - 1) < 1e-9);
  });

  await t.test('is symmetric', () => {
    const a = colour.contrastRatio('#2b4a7d', '#16171a');
    const b = colour.contrastRatio('#16171a', '#2b4a7d');
    assert.ok(Math.abs(a - b) < 1e-12);
  });

  await t.test('is null when either colour is unreadable', () => {
    assert.equal(colour.contrastRatio('nonsense', '#ffffff'), null);
    assert.equal(colour.contrastRatio('#ffffff', 'nonsense'), null);
  });
});

test('needsOutline', async (t) => {
  await t.test('no swatch needs an outline on paper', () => {
    for (const hex of SWATCHES) {
      assert.equal(colour.needsOutline(hex, 'paper'), false, hex);
    }
  });

  await t.test('no swatch needs an outline on blueprint', () => {
    for (const hex of SWATCHES) {
      assert.equal(colour.needsOutline(hex, 'blueprint'), false, hex);
    }
  });

  /* The reason the rule exists: on graphite the three dark purples and blues
     sit almost on the background — spec Appendix A names #2b4a7d, and it is the
     worst of them at 2.03:1. Recorded as a list rather than a count, so a token
     edit that changes which ones qualify shows up as a named diff. */
  await t.test('the dark swatches need one on graphite', () => {
    const needed = SWATCHES.filter((hex) => colour.needsOutline(hex, 'graphite'));
    assert.deepEqual(needed, ['#7d2b5d', '#2b4a7d', '#6b4a7d']);
  });

  await t.test('the ones just over the line are left alone', () => {
    // 3.23:1 and 3.27:1 — above 3, so outlining them would be the rule
    // reaching past what QUALITY-BAR §7 actually asks for.
    assert.equal(colour.needsOutline('#c8291a', 'graphite'), false);
    assert.equal(colour.needsOutline('#5a6b7d', 'graphite'), false);
  });

  await t.test('an unknown theme or an unreadable colour answers no', () => {
    assert.equal(colour.needsOutline('#2b4a7d', 'sepia'), false);
    assert.equal(colour.needsOutline('nonsense', 'graphite'), false);
    assert.equal(colour.needsOutline(null, 'graphite'), false);
  });

  await t.test('the threshold is the 3:1 of a non-text graphic', () => {
    assert.equal(colour.MIN_RATIO, 3);
  });
});
