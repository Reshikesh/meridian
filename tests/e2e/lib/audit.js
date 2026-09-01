// The three automated responsive checks from QUALITY-BAR §2.
// Runs entirely inside the page as one page.evaluate() and returns plain JSON,
// so Playwright can print an actionable failure instead of "expected true".
//
// Every skip rule below exists to stop a false positive that would train the
// team to ignore this auditor. audit-selfcheck.spec.js proves, on fixtures,
// that the checks still fire — do not relax a rule without adding a fixture
// case that still fails.

const auditInPage = () => {
  const TOL = 1; // px: sub-pixel layout rounding

  // ---------- shared helpers ----------
  const SKIP_TAGS = new Set(['HTML', 'HEAD', 'SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'TEMPLATE', 'NOSCRIPT', 'BR', 'SOURCE', 'TRACK', 'PARAM']);
  const FORM_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'OPTGROUP']);

  const cs = new WeakMap();
  const style = (el) => {
    let s = cs.get(el);
    if (!s) { s = getComputedStyle(el); cs.set(el, s); }
    return s;
  };

  const label = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    if (el.className && typeof el.className === 'string') s += '.' + el.className.trim().split(/\s+/).join('.');
    for (const a of ['data-screen', 'data-s', 'data-nav', 'data-theme-btn', 'data-testid']) {
      if (el.hasAttribute(a)) s += `[${a}="${el.getAttribute(a)}"]`;
    }
    const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
    return t ? `${s} “${t.slice(0, 40)}${t.length > 40 ? '…' : ''}”` : s;
  };

  // Visible = renders a box right now. Walks ANCESTORS for display/visibility/
  // opacity/content-visibility, because getComputedStyle does not propagate
  // `display:none` down to descendants — a child of a hidden screen still
  // reports its own `display: block`.
  const isVisible = (el) => {
    if (SKIP_TAGS.has(el.tagName)) return false;
    if (!el.getClientRects().length) return false; // display:none, empty inline, closed <details>
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const s = style(n);
      if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
      if (parseFloat(s.opacity) === 0) return false;
      if (s.contentVisibility === 'hidden') return false;
    }
    return true;
  };

  const inSvg = (el) => el.closest && el.closest('svg') !== null && el.tagName !== 'svg';

  const all = Array.from(document.body.querySelectorAll('*'));

  // ---------- (i) no horizontal page scroll ----------
  const de = document.documentElement;
  // Compare against clientWidth (the layout viewport), NOT window.innerWidth:
  // headed Edge on Windows reserves a 15 px scrollbar, so innerWidth is 15 px
  // too generous and a real overflow slips through. Headless reserves 0, where
  // the two are equal and this is simply the stricter of the pair.
  const pageScroll = {
    scrollWidth: de.scrollWidth,
    innerWidth: window.innerWidth,
    clientWidth: de.clientWidth,
    scrollbar: window.innerWidth - de.clientWidth,
    ok: de.scrollWidth <= de.clientWidth + TOL,
  };
  // Name the widest offenders so a failure points at a box, not just a number.
  pageScroll.offenders = pageScroll.ok ? [] : all
    .filter(isVisible)
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.right > de.clientWidth + TOL || r.left < -TOL)
    .sort((a, b) => b.r.right - a.r.right)
    .slice(0, 8)
    .map(({ el, r }) => ({ el: label(el), left: Math.round(r.left), right: Math.round(r.right) }));

  // ---------- (i-b) nothing pushed off the LEFT edge ----------
  // scrollWidth only grows to the RIGHT, so a box that overflows leftward is
  // invisible to check (i) — and the offender list above only runs once (i) has
  // already failed. A flex group with `flex: none` in a viewport narrower than
  // its own content does exactly this: it hangs off the left edge and its first
  // child is clipped by the window, with no scrollbar to show for it. Found in
  // the header's theme toggle at 360px/150% zoom, which the width-and-zoom
  // matrix reaches.
  const offLeft = all
    .filter(isVisible)
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width >= 1 && r.height >= 1 && r.left < -TOL)
    .sort((a, b) => a.r.left - b.r.left)
    .slice(0, 8)
    .map(({ el, r }) => ({ el: label(el), left: Math.round(r.left), right: Math.round(r.right) }));

  // ---------- (ii) no clipped text ----------
  // Only elements that render glyphs themselves (a DIRECT non-whitespace text
  // node). Without that, every wrapper inherits its child's overflow and the
  // report is a wall of duplicates.
  const rendersText = (el) => {
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.nodeValue.trim() !== '') return true;
    }
    return false;
  };
  const isScrollContainer = (s) =>
    s.overflowX === 'auto' || s.overflowX === 'scroll' || s.overflow === 'auto' || s.overflow === 'scroll';
  const isIntentionalTruncation = (el, s) => {
    if (s.textOverflow && s.textOverflow !== 'clip') return true;       // …ellipsis (or a custom string)
    if (s.webkitLineClamp && s.webkitLineClamp !== 'none') return true; // multi-line clamp
    if (el.hasAttribute('data-allow-clip')) return true;                // explicit opt-out, used sparingly
    return false;
  };

  const textOverflow = [];
  for (const el of all) {
    if (FORM_TAGS.has(el.tagName)) continue; // a text input legitimately scrolls its value
    if (inSvg(el)) continue;                 // <text> has no clientWidth semantics
    if (!rendersText(el) || !isVisible(el)) continue;
    const s = style(el);
    if (isScrollContainer(s) || isIntentionalTruncation(el, s)) continue;
    if (el.scrollWidth > el.clientWidth + TOL) {
      textOverflow.push({
        el: label(el),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        overflowX: s.overflowX,
        whiteSpace: s.whiteSpace,
      });
    }
  }

  // ---------- (iii) no overlapping leaves ----------
  // "Leaf" = no element children, so a parent is never flagged against its own
  // child. Pairs are compared only within the same painted group.
  //
  // Layer = nearest ancestor-or-self with position:fixed (veil, sheet card,
  // dropdown). Different layers are painted over each other ON PURPOSE, so they
  // are never compared. `absolute` does NOT open a layer — absolutely
  // positioned siblings colliding is exactly the bug this check is for.
  const layerOf = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (style(n).position === 'fixed') return n;
    }
    return null;
  };
  // Sticky things ride over in-flow content by design once the page scrolls.
  const isSticky = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (style(n).position === 'sticky') return true;
    }
    return false;
  };

  const leaves = [];
  for (const el of all) {
    if (el.children.length !== 0) continue;
    if (SKIP_TAGS.has(el.tagName) || inSvg(el)) continue;
    if (!isVisible(el)) continue;
    const s = style(el);
    if (s.pointerEvents === 'none') continue;            // decorative rules, focus rings, gradients
    if (el.hasAttribute('data-allow-overlap')) continue; // explicit opt-out
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    leaves.push({ el, r, layer: layerOf(el), sticky: isSticky(el) });
  }

  leaves.sort((a, b) => a.r.top - b.r.top);
  const overlaps = [];
  for (let i = 0; i < leaves.length && overlaps.length < 20; i++) {
    const a = leaves[i];
    for (let j = i + 1; j < leaves.length; j++) {
      const b = leaves[j];
      if (b.r.top >= a.r.bottom - TOL) break; // sweep: list is sorted by top
      if (a.layer !== b.layer) continue;      // different fixed overlay layers
      if (a.sticky !== b.sticky) continue;    // sticky rides over in-flow content
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w > TOL && h > TOL) {
        overlaps.push({
          a: label(a.el), b: label(b.el),
          overlap: { w: Math.round(w), h: Math.round(h) },
          aRect: [Math.round(a.r.left), Math.round(a.r.top), Math.round(a.r.width), Math.round(a.r.height)],
          bRect: [Math.round(b.r.left), Math.round(b.r.top), Math.round(b.r.width), Math.round(b.r.height)],
        });
        if (overlaps.length >= 20) break;
      }
    }
  }

  return { pageScroll, offLeft, textOverflow, overlaps, counts: { elements: all.length, leaves: leaves.length } };
};

// One human-readable line per finding, tagged with `where` (width/theme/screen)
// so a single run reports every problem at once.
function formatAudit(res, where) {
  const lines = [];
  if (!res.pageScroll.ok) {
    lines.push(`[${where}] horizontal page scroll: scrollWidth ${res.pageScroll.scrollWidth} > clientWidth ${res.pageScroll.clientWidth} (innerWidth ${res.pageScroll.innerWidth}, scrollbar ${res.pageScroll.scrollbar})`);
    for (const o of res.pageScroll.offenders) lines.push(`    widest: ${o.el} (left ${o.left}, right ${o.right})`);
  }
  for (const o of res.offLeft || []) {
    lines.push(`[${where}] element off the left edge: ${o.el} (left ${o.left}, right ${o.right})`);
  }
  for (const t of res.textOverflow) {
    lines.push(`[${where}] clipped text: ${t.el} scrollWidth ${t.scrollWidth} > clientWidth ${t.clientWidth} (overflow-x: ${t.overflowX}, white-space: ${t.whiteSpace})`);
  }
  for (const o of res.overlaps) {
    lines.push(`[${where}] overlap ${o.overlap.w}x${o.overlap.h}px: ${o.a} ${JSON.stringify(o.aRect)} vs ${o.b} ${JSON.stringify(o.bRect)}`);
  }
  return lines;
}

module.exports = { auditInPage, formatAudit };
