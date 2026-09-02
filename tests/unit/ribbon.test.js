'use strict';

const test = require('node:test');
const assert = require('node:assert');
const ribbon = require('../../src/core/ribbon.js');

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg || ''} ${a} vs ${b}`);
const sum = (xs) => xs.reduce((n, x) => n + x, 0);

/* ---------- layout() (spec §4c; QUALITY-BAR §6: 1, 2, 9 and 20 rows) ---------- */

test('layout() shares the space in proportion and pins small rows to the minimum', async (t) => {
  await t.test('one row takes all of the space', () => {
    assert.deepEqual(ribbon.layout([5], 372, 34), [372]);
  });

  await t.test('two rows split it in proportion', () => {
    const hs = ribbon.layout([3, 1], 400, 34);
    close(hs[0], 300);
    close(hs[1], 100);
  });

  await t.test('nine rows: the small ones are pinned and the rest re-share the remainder', () => {
    // 9 × 56 + 48 = 552 high, 504 available, minus 8 gaps of 9 = 432 of space.
    const vals = [959, 288, 257, 171, 143, 103, 62, 61, 1];
    const hs = ribbon.layout(vals, 432, 34);
    assert.equal(hs.length, 9);
    close(sum(hs), 432, 'the rows always fill the space exactly');
    // The five rows under 34 px at their proportional share are pinned to it;
    // the free rows share what is left and keep their proportions.
    for (let i = 4; i < 9; i++) assert.equal(hs[i], 34, `row ${i} pinned`);
    close(hs[0] / hs[1], 959 / 288);
    close(hs[1] / hs[3], 288 / 171);
    close(hs[0] + hs[1] + hs[2] + hs[3], 432 - 5 * 34);
  });

  await t.test('twenty rows: the space still adds up and every pinned row is exactly 34', () => {
    const vals = Array.from({ length: 20 }, (_, i) => 20 - i);
    const H = Math.max(420, 20 * 56 + 48);
    const space = H - 48 - 9 * 19;
    const hs = ribbon.layout(vals, space, 34);
    assert.equal(hs.length, 20);
    close(sum(hs), space);
    // Values 1..7 are under 34 px at their proportional share and are pinned.
    // The mockup redistributes in ONE pass, so a row just above the line can
    // land a little under it afterwards; that is the mockup's maths, ported.
    for (let i = 13; i < 20; i++) assert.equal(hs[i], 34, `row ${i} pinned`);
    assert.ok(hs.every((h) => h > 0 && Number.isFinite(h)));
    assert.ok(hs[0] > hs[1] && hs[1] > hs[2], 'the free rows keep their order');
  });

  await t.test('rows whose share is under the minimum are pinned, and the space still adds up', () => {
    const hs = ribbon.layout([100, 1, 1], 300, 34);
    assert.equal(hs[1], 34);
    assert.equal(hs[2], 34);
    close(hs[0], 232);
    close(sum(hs), 300);
  });

  await t.test('a zero total gives equal heights rather than dividing by zero', () => {
    assert.deepEqual(ribbon.layout([0, 0, 0, 0], 400, 34), [100, 100, 100, 100]);
  });

  await t.test('when every row is under the minimum nothing is redistributed (mockup)', () => {
    // free === 0, so the mockup keeps the proportional heights as they are.
    const hs = ribbon.layout([1, 1], 40, 34);
    assert.deepEqual(hs, [20, 20]);
  });
});

/* ---------- geometry() ---------- */

const nodes = (vals) => vals.map((v, i) => ({ id: 'n' + i, value: v }));

test('geometry() is the mockup chart() with fixed label columns', async (t) => {
  await t.test('height is max(420, n×56 + 48)', () => {
    assert.equal(ribbon.geometry(nodes([1]), { width: 900 }).H, 420);
    assert.equal(ribbon.geometry(nodes([1, 1, 1, 1, 1, 1, 1, 1]), { width: 900 }).H, 496);
    assert.equal(ribbon.geometry(nodes(Array(20).fill(1)), { width: 900 }).H, 20 * 56 + 48);
  });

  await t.test('at the mockup width the x positions are the mockup constants', () => {
    const g = ribbon.geometry(nodes([1, 2]), { width: 900 });
    assert.equal(g.W, 900);
    assert.equal(g.xL, 176);
    assert.equal(g.xR, 628);
    assert.equal(g.bw, 26);
    assert.equal(g.nameX, 670);
    assert.equal(g.mid, 402);
    assert.equal(g.label.x, 176 - 26 - 14);
    assert.equal(g.rows[0].leader.x1, 628 + 26 + 3);
    assert.equal(g.rows[0].leader.x2, 670 - 8);
  });

  await t.test('only the ribbon span absorbs a different width', () => {
    const g = ribbon.geometry(nodes([1, 2]), { width: 878 });
    assert.equal(g.xL, 176, 'the LOGGED HOURS column is fixed');
    assert.equal(g.xR, 878 - 272, 'the right column is fixed');
    assert.equal(g.nameX, g.xR + 26 + 16);
  });

  await t.test('the width never goes under the floor', () => {
    assert.equal(ribbon.geometry(nodes([1]), { width: 320 }).W, ribbon.MIN_WIDTH);
    assert.equal(ribbon.geometry(nodes([1]), {}).W, 900, 'no width means the mockup viewBox');
  });

  await t.test('the trunk is a contiguous, vertically centred stack; the right side has 9px gaps', () => {
    const g = ribbon.geometry(nodes([3, 1, 1]), { width: 900 });
    const [a, b, c] = g.rows;
    close(a.trunk.y1, b.trunk.y0, 'trunk rows touch');
    close(b.trunk.y1, c.trunk.y0);
    close(a.trunk.y0, (g.H - g.space) / 2, 'the trunk starts at the centred offset');
    close(c.trunk.y1, g.H - (g.H - g.space) / 2, 'and ends symmetrically');
    assert.equal(a.right.y0, 24, 'the right stack starts at PAD');
    close(b.right.y0, a.right.y1 + 9);
    close(c.right.y0, b.right.y1 + 9);
    close(c.right.y1, g.H - 24, 'and ends at H − PAD');
  });

  await t.test('the ribbon is a cubic Bézier pair with both control x at the midpoint', () => {
    const g = ribbon.geometry(nodes([1]), { width: 900 });
    const r = g.rows[0];
    const a = r.trunk, b = r.right;
    assert.equal(r.path,
      `M 176,${a.y0} C 402,${a.y0} 402,${b.y0} 628,${b.y0} L 628,${b.y1}` +
      ` C 402,${b.y1} 402,${a.y1} 176,${a.y1} Z`);
  });

  await t.test('label rows sit where the mockup puts them', () => {
    const g = ribbon.geometry([{ id: 'a', value: 1 }, { id: 'b', value: 1, sub: 'Learning' }], { width: 900 });
    const [plain, withSub] = g.rows;
    assert.equal(plain.nameY, plain.centre + 3);
    assert.equal(withSub.nameY, withSub.centre - 4);
    assert.equal(withSub.subY, withSub.centre + 12);
    assert.equal(plain.pctY, plain.centre - 1);
    assert.equal(plain.hoursY, plain.centre + 15);
    const tc = (g.H - g.space) / 2 + g.space / 2;
    assert.equal(g.label.titleY, tc - 12);
    assert.equal(g.label.totalY, tc + 14);
  });

  await t.test('percentages are of the total, one decimal under ten', () => {
    const g = ribbon.geometry(nodes([959, 61]), { width: 900 });
    assert.equal(g.rows[0].pctText, '94');
    assert.equal(g.rows[1].pctText, '6.0');
    assert.equal(g.total, 1020);
    const given = ribbon.geometry(nodes([50]), { width: 900, total: 200 });
    assert.equal(given.rows[0].pctText, '25');
  });

  await t.test('no nodes is a safe, empty geometry', () => {
    const g = ribbon.geometry([], { width: 900 });
    assert.equal(g.rows.length, 0);
    assert.equal(g.H, 420);
    assert.equal(g.space, g.H - 48);
  });
});

test('pctText follows spec §4c', () => {
  assert.equal(ribbon.pctText(3.04), '3.0');
  assert.equal(ribbon.pctText(9.96), '10.0');
  assert.equal(ribbon.pctText(10), '10');
  assert.equal(ribbon.pctText(46.9), '47');
  assert.equal(ribbon.pctText(0), '0.0');
});

/* ---------- long names (QUALITY-BAR §2: 30-character category names) ---------- */

test('fitText shortens a name to an ellipsis before it would cross its figure', async (t) => {
  const measure = (s) => s.length * 8;   // a fake 8px-per-character face

  await t.test('a name that fits is untouched', () => {
    assert.equal(ribbon.fitText('Everything else', 200, measure), 'Everything else');
  });

  await t.test('a 30-character name is cut with a single ellipsis character', () => {
    const name = 'Reading long novels at night!!';
    assert.equal(name.length, 30);
    const cut = ribbon.fitText(name, 100, measure);
    assert.ok(cut.endsWith(ribbon.ELLIPSIS));
    assert.ok(measure(cut) <= 100);
    assert.ok(cut.length > 1, 'as much of the name as fits is kept');
    assert.equal(cut, 'Reading lon' + ribbon.ELLIPSIS, 'twelve characters of eight pixels fit in 100');
    assert.equal(ribbon.fitText(name, 104, measure), 'Reading long' + ribbon.ELLIPSIS,
      'a trailing space before the ellipsis is dropped');
  });

  await t.test('no room at all is just the ellipsis, never an exception', () => {
    assert.equal(ribbon.fitText('Work', 0, measure), ribbon.ELLIPSIS);
    assert.equal(ribbon.fitText('Work', -5, measure), ribbon.ELLIPSIS);
  });

  await t.test('empty and null are empty', () => {
    assert.equal(ribbon.fitText('', 100, measure), '');
    assert.equal(ribbon.fitText(null, 100, measure), '');
  });

  await t.test('the budget is the right column less the figure and a gap', () => {
    const g = ribbon.geometry(nodes([1]), { width: 900 });
    assert.equal(ribbon.labelBudget(g, 55), 900 - 670 - 55 - 8);
  });
});
