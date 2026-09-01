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
  // The sr-only recipe: a 1x1 box with its content clipped away, carrying text
  // that only a screen reader ever reads. It is not a layout box, so a
  // "clipped text" or "overlap" report on one is noise by construction — it is
  // clipped ON PURPOSE, and it is 1x1 so it collides with whatever it sits in.
  // Detected by shape, not by class name, so it holds for any such recipe.
  const isVisuallyHidden = (el) => {
    const s = style(el);
    if (!s.clipPath || s.clipPath === 'none') return false;
    const r = el.getBoundingClientRect();
    return r.width <= 2 && r.height <= 2;
  };

  // What of an element is actually ON SCREEN: its own rect, intersected with
  // every clipping ancestor.
  //
  // A rect is where an element WOULD be, clipping or not, so without this a row
  // that has scrolled under the edge of its own scroll container reads as
  // overlapping whatever is painted beyond it — and a capped sheet with a
  // scrolling body reports its footer colliding with every row below the fold.
  // Passing under its container's edges is the entire point of a scroller.
  //
  // Returns null when nothing of it is on screen.
  // Whether `el` is a containing block for a fixed-position descendant. These
  // properties are the ones that make `position: fixed` resolve against an
  // element instead of the viewport — and therefore the only ones that let an
  // ancestor's overflow clip a fixed box at all.
  const cbForFixed = (el) => {
    const s = style(el);
    return (s.transform && s.transform !== 'none')
      || (s.perspective && s.perspective !== 'none')
      || (s.filter && s.filter !== 'none')
      || (s.backdropFilter && s.backdropFilter !== 'none')
      || /transform|filter|perspective/.test(s.willChange || '')
      || /paint|layout|strict|content/.test(s.contain || '');
  };

  const visibleRect = (el) => {
    const r = el.getBoundingClientRect();
    let left = r.left, top = r.top, right = r.right, bottom = r.bottom;
    // Overflow only clips what it actually contains: a fixed box is clipped by
    // nothing unless an ancestor is its containing block, and an absolute box
    // is clipped only from its containing block upward. Ignoring that reported
    // every fixed dropdown in the app as "clipped" by the first scroller above
    // it, which is exactly the false positive that trains people to stop
    // reading this auditor.
    let pos = style(el).position;
    for (let n = el.parentElement; n && n.nodeType === 1; n = n.parentElement) {
      const s = style(n);
      const isCb = cbForFixed(n);
      let clipsMe;
      if (pos === 'fixed') clipsMe = isCb;
      else if (pos === 'absolute') clipsMe = s.position !== 'static' || isCb;
      else clipsMe = true;

      if (clipsMe && !(s.overflowX === 'visible' && s.overflowY === 'visible')) {
        const b = n.getBoundingClientRect();
        if (b.width !== 0 || b.height !== 0) {
          left = Math.max(left, b.left);
          top = Math.max(top, b.top);
          right = Math.min(right, b.right);
          bottom = Math.min(bottom, b.bottom);
          if (right - left <= TOL || bottom - top <= TOL) return null;
        }
      }

      // Past its containing block, it is laid out like any other descendant.
      if ((pos === 'fixed' && isCb) || (pos === 'absolute' && (s.position !== 'static' || isCb))) {
        pos = 'static';
      }
    }
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  };

  const isVisible = (el) => {
    if (SKIP_TAGS.has(el.tagName)) return false;
    if (!el.getClientRects().length) return false; // display:none, empty inline, closed <details>
    if (isVisuallyHidden(el)) return false;
    if (visibleRect(el) === null) return false;
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
  //
  // The CLIPPED rect again: content inside a horizontally scrolled container
  // legitimately sits to the left of that container's own box, and saying so
  // would flag every scrolled table in the app.
  const offLeft = all
    .filter(isVisible)
    .map((el) => ({ el, r: visibleRect(el) }))
    .filter(({ r }) => r && r.width >= 1 && r.height >= 1 && r.left < -TOL)
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
    // The CLIPPED rect, so a half-scrolled row is compared by the half of it
    // that a person can actually see.
    const r = visibleRect(el);
    if (!r || r.width < 1 || r.height < 1) continue;
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

  // ---------- (iv) no overlay clipped or off screen ----------
  // The class of defect the owner found at the Phase 2 checkpoint: the Log row
  // menu, absolutely positioned inside a table that scrolls horizontally. A box
  // with `overflow-x: auto` ALWAYS clips the other axis too — CSS resolves it to
  // `auto`, there is no clip-one-axis-only — so the menu on the last row was cut
  // off by its own table and grew it a scrollbar.
  //
  // Nothing in checks (i)-(iii) could see it: they audit what is on screen, and
  // this was a thing that had been taken OFF the screen. So overlays say what
  // they are, with `data-overlay`, and the rule is that all of one has to be
  // visible: its own rect, its rect clipped by its ancestors, and the viewport
  // all agree.
  const clippedOverlays = [];
  for (const el of document.querySelectorAll('[data-overlay]')) {
    if (!isVisible(el)) continue;
    const own = el.getBoundingClientRect();
    if (own.width < 1 || own.height < 1) continue;
    const seen = visibleRect(el);
    const lost = {
      top: Math.round(Math.max(0, seen.top - own.top)),
      left: Math.round(Math.max(0, seen.left - own.left)),
      bottom: Math.round(Math.max(0, own.bottom - seen.bottom)),
      right: Math.round(Math.max(0, own.right - seen.right)),
    };
    const clipped = lost.top > TOL || lost.left > TOL || lost.bottom > TOL || lost.right > TOL;
    const offScreen = own.top < -TOL || own.left < -TOL
      || own.bottom > de.clientHeight + TOL || own.right > de.clientWidth + TOL;
    if (clipped || offScreen) {
      clippedOverlays.push({
        el: label(el),
        rect: [Math.round(own.left), Math.round(own.top), Math.round(own.width), Math.round(own.height)],
        lost,
        offScreen,
        viewport: [de.clientWidth, de.clientHeight],
      });
    }
  }

  return {
    pageScroll, offLeft, textOverflow, overlaps, clippedOverlays,
    counts: { elements: all.length, leaves: leaves.length, overlays: document.querySelectorAll('[data-overlay]').length },
  };
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
  for (const o of res.clippedOverlays || []) {
    const why = o.offScreen ? 'reaches outside the viewport' : 'is clipped by an ancestor';
    lines.push(`[${where}] overlay ${why}: ${o.el} rect ${JSON.stringify(o.rect)} lost ${JSON.stringify(o.lost)} viewport ${JSON.stringify(o.viewport)}`);
  }
  return lines;
}

module.exports = { auditInPage, formatAudit };
