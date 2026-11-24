
/*
 * MAGMAHOOKAH — Sticky Filter v4.9, storefront install edition
 * Based on the V4.9 console test approved by store owner.
 * Installation: host this file over HTTPS, connect it to an Ecwid private
 * app as its customJsUrl (requires customize_storefront scope).
 * DO NOT paste JavaScript into Ecwid Design > CSS Themes.
 * Uses the Wix iframe SDK already present in the Ecwid-on-Wix storefront.
 * No new product scrollbars; no inner filter scrollbars; desktop only.
 * Re-initializes when Ecwid replaces the category DOM during navigation.
 */
(function () {
  'use strict';
  var KEY = '__magmaStickyFilterV49';
  try { window[KEY]?.dispose?.(); } catch (_) {}

  var active = null;
  var disposed = false;
  var checks = 0;
  var interval = null;
  var SELECTOR = '.ec-filters.ec-filters--inline.ec-filters--left';
  var TOP = 12, BOTTOM = 22;

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function number(v) { return v == null ? NaN : Number(v); }
  function viewportHeight() {
    // Preserve the size estimate from the owner's successful V4.9 test.
    var a = Number(screen.availHeight) || 800;
    var b = Number(window.outerHeight) || a;
    return Math.max(420, Math.min(a, b) - 85);
  }

  function attach(filter) {
    var grid = filter.closest('.grid__list') || filter.parentElement;
    var wix = window.Wix;
    if (!grid || typeof wix?.addEventListener !== 'function') return null;

    var saved = filter.getAttribute('style');
    var evt = wix.Events?.SCROLL || 'SCROLL';
    function set(k, v) { filter.style.setProperty(k, v, 'important'); }
    function restore() {
      if (saved == null) filter.removeAttribute('style');
      else filter.setAttribute('style', saved);
    }

    // Keep the exact full-length, no-scrollbar behavior from successful V4.9.
    Object.entries({
      position: 'relative', top: '0px', 'align-self': 'start',
      height: 'auto', 'min-height': '0', 'max-height': 'none',
      overflow: 'visible', 'overflow-x': 'visible', 'overflow-y': 'visible',
      transition: 'none', animation: 'none', 'z-index': '5',
      'will-change': 'transform', transform: 'translate3d(0,0,0)'
    }).forEach(function (pair) { set(pair[0], pair[1]); });

    var base = 0, panelHeight = 0, travelLimit = 0;
    var current = 0, target = 0;
    var iframeTop = NaN, lastScroll = NaN;
    var direction = 1, debt = 0, lastWheel = 0;
    var lastFrame = 0, raf = 0, alive = true;
    var measuring = false;

    function measure() {
      base = filter.getBoundingClientRect().top - current;
      panelHeight = filter.offsetHeight;
      travelLimit = Math.max(0,
        grid.getBoundingClientRect().bottom - base - panelHeight - 16);
      current = clamp(current, 0, travelLimit);
      target = clamp(target, 0, travelLimit);
    }

    function retarget() {
      if (!Number.isFinite(iframeTop)) return;
      var natural = iframeTop - debt + base;
      var bottom = viewportHeight() - BOTTOM;
      var available = bottom - TOP;

      if (panelHeight <= available) {
        target = clamp(TOP - natural, 0, travelLimit);
      } else {
        if (direction >= 0) {
          target = Math.max(target, bottom - natural - panelHeight);
        } else {
          target = Math.min(target, TOP - natural);
        }
        // Limit excessive blank space above the sidebar.
        target = Math.min(target, Math.max(0, TOP - natural));
        target = clamp(target, 0, travelLimit);
      }
    }

    function paint(t) {
      raf = 0;
      if (!alive) return;
      var dt = lastFrame ? clamp(t - lastFrame, 1, 40) : 16.7;
      lastFrame = t;
      if (debt && t - lastWheel > 165) {
        debt *= Math.exp(-dt / 160);
        if (Math.abs(debt) < .2) debt = 0;
        retarget();
      }
      var fast = t - lastWheel < 105;
      var delta = target - current;
      var step = clamp(
        delta * (fast ? .97 : 1 - Math.exp(-dt / 14)),
        -dt * (fast ? 4 : 1.9),
         dt * (fast ? 4 : 1.9)
      );
      if (Math.abs(delta) < .25) step = delta;
      current += step;
      set('transform', 'translate3d(0,' + current.toFixed(2) + 'px,0)');
      if (Math.abs(current - target) > .25 || (debt && t - lastWheel > 165)) {
        raf = requestAnimationFrame(paint);
      } else {
        lastFrame = 0;
      }
    }
    function schedule() { if (alive && !raf) raf = requestAnimationFrame(paint); }

    function onWheel(e) {
      if (e.ctrlKey || filter.contains(e.target) ||
          Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.5 ||
          !Number.isFinite(iframeTop)) return;
      var factor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? viewportHeight() : 1;
      var delta = clamp(e.deltaY * factor, -75, 75);
      if (Math.abs(delta) < .35) return;
      if (debt && Math.sign(delta) !== Math.sign(debt)) debt = 0;
      debt = clamp(debt + delta, -115, 115);
      direction = Math.sign(delta);
      lastWheel = performance.now();
      retarget();
      schedule();
    }

    function onScroll(e) {
      var top = number(e?.top), scroll = number(e?.scrollTop), y = number(e?.y);
      var incomingTop = Number.isFinite(top) ? top : y - scroll;
      if (!Number.isFinite(incomingTop)) return;
      var delta = Number.isFinite(lastScroll) && Number.isFinite(scroll)
        ? scroll - lastScroll
        : Number.isFinite(iframeTop) ? iframeTop - incomingTop : 0;
      if (Math.abs(delta) > .25) {
        if (debt && Math.sign(delta) === Math.sign(debt)) {
          debt -= Math.sign(debt) * Math.min(Math.abs(debt), Math.abs(delta));
        } else if (performance.now() - lastWheel > 120) {
          debt = 0;
        }
        if (performance.now() - lastWheel > 115) direction = Math.sign(delta);
      }
      iframeTop = incomingTop;
      if (Number.isFinite(scroll)) lastScroll = scroll;
      retarget();
      schedule();
    }

    measure();
    var listenerId;
    try {
      listenerId = wix.addEventListener(evt, onScroll);
    } catch (err) {
      restore();
      console.warn('[MAGMA] Wix scroll bridge unavailable:', err);
      return null;
    }
    document.addEventListener('wheel', onWheel, {capture: true, passive: true});
    function resize() {
      if (measuring || !alive) return;
      measuring = true;
      requestAnimationFrame(function () {
        measuring = false;
        if (!alive) return;
        measure(); retarget(); schedule();
      });
    }
    window.addEventListener('resize', resize);
    var observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver(resize) : null;
    observer?.observe(filter); observer?.observe(grid);

    console.info('[MAGMA] Approved V4.9 sticky filter enabled.');
    return {
      filter: filter,
      undo: function () {
        if (!alive) return;
        alive = false;
        cancelAnimationFrame(raf);
        observer?.disconnect();
        document.removeEventListener('wheel', onWheel, true);
        window.removeEventListener('resize', resize);
        try { wix.removeEventListener?.(evt, listenerId ?? onScroll); } catch (_) {}
        if (filter.isConnected) restore();
      }
    };
  }

  function refresh() {
    if (disposed) return;
    var filter = document.querySelector(SELECTOR);
    var desktop = window.matchMedia('(min-width: 801px)').matches;
    var wixReady = typeof window.Wix?.addEventListener === 'function';
    if (active && (!filter || filter !== active.filter || !desktop || !wixReady)) {
      active.undo(); active = null;
    }
    if (!active && filter && desktop && wixReady) active = attach(filter);
    checks++;
  }

  function dispose() {
    disposed = true;
    if (interval) clearInterval(interval);
    window.removeEventListener('pagehide', dispose);
    window.removeEventListener('resize', refresh);
    if (active) { active.undo(); active = null; }
    if (window[KEY]?.dispose === dispose) delete window[KEY];
    if (window.magmaStickyUndo === dispose) delete window.magmaStickyUndo;
  }

  window[KEY] = {dispose: dispose};
  window.magmaStickyUndo = dispose; // Emergency rollback for this browser session.
  interval = setInterval(refresh, 1000);
  window.addEventListener('resize', refresh);
  window.addEventListener('pagehide', dispose);
  refresh();
})();

/*
 * MAGMAHOOKAH — Sidebar cleanup
 * Hide duplicate sidebar Sort by and its leftover bottom divider.
 * The top-right product sorting control is untouched.
 * Wait for Ecwid's asynchronously rendered filter before installing.
 */
(() => {
  'use strict';

  window.magmaSidebarCleanUndo?.();

  const root = '.ec-filters.ec-filters--inline.ec-filters--left';
  const saved = new Map();
  const marked = new Set();
  let stopped = false;
  let frame = 0;
  let scheduled = false;

  const style = document.createElement('style');
  style.id = 'magma-sidebar-sort-cleanup';
  style.textContent = `
    ${root} .magma-sort-gone {
      display: none !important;
    }

    ${root} .magma-search-last {
      border-bottom: 0 !important;
    }

    ${root} .magma-search-last::after {
      content: none !important;
      display: none !important;
    }

    ${root} .magma-end-divider::before,
    ${root} .magma-end-divider::after {
      content: none !important;
      display: none !important;
    }
  `;
  document.head.appendChild(style);

  const text = s => (s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  function heading(panel, name) {
    return [...panel.querySelectorAll('*')].find(el =>
      [...el.childNodes].some(node =>
        node.nodeType === 3 &&
        text(node.textContent) === name
      )
    );
  }

  function branch(el, parent) {
    while (
      el &&
      el.parentElement &&
      el.parentElement !== parent
    ) {
      el = el.parentElement;
    }
    return el;
  }

  function override(el, property, value) {
    if (!saved.has(el)) {
      saved.set(el, el.getAttribute('style'));
    }
    el.style.setProperty(property, value, 'important');
  }

  function mark(el, name) {
    el.classList.add(name);
    marked.add(el);
  }

  function removeDivider(panel, search, input) {
    const panelRect = panel.getBoundingClientRect();
    const inputBottom =
      (input || search).getBoundingClientRect().bottom;

    const start = inputBottom + 8;
    const end = panelRect.bottom - 10;
    if (start >= end) return;

    for (const el of panel.querySelectorAll('*')) {
      if (
        el.closest('.magma-sort-gone') ||
        el === input
      ) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width < panelRect.width * 0.62) continue;

      const topIn = rect.top >= start && rect.top <= end;
      const bottomIn = rect.bottom >= start && rect.bottom <= end;
      if (!topIn && !bottomIn) continue;

      const css = getComputedStyle(el);
      const topBorder =
        topIn &&
        parseFloat(css.borderTopWidth) > 0 &&
        css.borderTopStyle !== 'none';

      const bottomBorder =
        bottomIn &&
        parseFloat(css.borderBottomWidth) > 0 &&
        css.borderBottomStyle !== 'none';

      if (topBorder) override(el, 'border-top', '0');
      if (bottomBorder) override(el, 'border-bottom', '0');
      if (rect.height <= 3 && topIn) {
        override(el, 'visibility', 'hidden');
      }

      if (
        topBorder ||
        bottomBorder ||
        (rect.height <= 3 && topIn)
      ) {
        mark(el, 'magma-end-divider');
      }
    }
  }

  function apply() {
    if (stopped) return;
    const panel = document.querySelector(root);
    if (!panel) return;

    const sort = heading(panel, 'sort by');
    const search = heading(panel, 'search by phrase');
    if (!sort || !search) return;

    let common = sort.parentElement;
    while (common && !common.contains(search)) {
      common = common.parentElement;
    }
    if (!common || common === panel.parentElement) return;

    const sortGroup = branch(sort, common);
    const searchGroup = branch(search, common);
    if (!sortGroup || sortGroup === searchGroup) return;

    const protectedNames = [
      'refine by', 'brand', 'price',
      'category', 'search by phrase'
    ];

    if (protectedNames.some(name => {
      const h = heading(panel, name);
      return h && sortGroup.contains(h);
    })) return;

    mark(sortGroup, 'magma-sort-gone');
    mark(searchGroup, 'magma-search-last');

    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const livePanel = document.querySelector(root);
      if (!livePanel || !livePanel.contains(search)) return;

      const input = [...searchGroup.querySelectorAll('input')]
        .find(el => /keyword|phrase/i.test(el.placeholder || ''));

      removeDivider(livePanel, search, input);
    });
  }

  const observer = new MutationObserver(() => {
    if (scheduled || stopped) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      apply();
    });
  });

  // In a custom Ecwid app the JS may execute before filters are created.
  // Keep watching until Ecwid renders them, including category changes.
  if (document.body) {
    observer.observe(document.body, {childList: true, subtree: true});
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (!stopped) {
        observer.observe(document.body, {childList: true, subtree: true});
        apply();
      }
    }, {once: true});
  }

  const interval = setInterval(apply, 1000);
  apply();

  window.magmaSidebarCleanUndo = () => {
    stopped = true;
    observer.disconnect();
    clearInterval(interval);
    cancelAnimationFrame(frame);

    marked.forEach(el => {
      el.classList.remove(
        'magma-sort-gone',
        'magma-search-last',
        'magma-end-divider'
      );
    });

    saved.forEach((original, el) => {
      if (original === null) {
        el.removeAttribute('style');
      } else {
        el.setAttribute('style', original);
      }
    });

    style.remove();
    delete window.magmaSidebarCleanUndo;
    console.info('[MAGMA] Sidebar cleanup removed.');
  };

  console.info('[MAGMA] Sidebar Sort by + divider cleanup installed.');
})();
