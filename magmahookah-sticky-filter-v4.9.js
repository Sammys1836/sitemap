




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

/*
 * MAGMAHOOKAH — Category single-scrollbar fix V2 (persistent addon)
 * Append this block to the END of magmahookah-sticky-filter-v4.9.js.
 * Do not replace the existing V4.9 sticky script or Sort-by cleanup.
 * Preserves the browser-tested Category V2 scrolling behavior and re-applies
 * it when Ecwid changes category pages without a full browser reload.
 */
(() => {
  'use strict';

  const KEY = '__magmaCategorySingleScrollbarV2';
  window[KEY]?.dispose?.();

  let active = null;
  let observer = null;
  let interval = null;
  let queued = false;
  let stopped = false;

  const PANEL = '.ec-filters.ec-filters--inline.ec-filters--left';
  const CATEGORY = '.ec-filter--category';
  const CHECKBOX = 'input[type="checkbox"], [role="checkbox"]';
  const LISTS = '.ec-form-choice-group, .ec-filter__items-inner, .ec-filter__items';

  function apply() {
    if (stopped) return;
    if (!window.matchMedia('(min-width: 801px)').matches) return;

    const panel = document.querySelector(PANEL);
    const section = panel?.querySelector(CATEGORY);
    if (!section) {
      if (active && !active.section.isConnected) {
        active.undo();
        active = null;
      }
      return;
    }

    const visible = el =>
      el.getBoundingClientRect().width > 0 &&
      getComputedStyle(el).display !== 'none';

    let choices = [...section.querySelectorAll(CHECKBOX)].filter(visible);
    if (choices.length < 3) {
      choices = [...section.querySelectorAll('.ec-form-choice-group__item')].filter(visible);
    }
    if (choices.length < 3) return;

    const lastChoice = choices[choices.length - 1];
    if (
      active && active.section === section && active.scroller.isConnected &&
      active.lastChoice === lastChoice && active.choiceCount === choices.length &&
      getComputedStyle(active.scroller).overflowY === 'auto'
    ) return;

    if (active) {
      active.undo();
      active = null;
    }

    // This is the exact list-selection approach from the confirmed V2 test.
    const possible = [...section.querySelectorAll(LISTS)]
      .filter(el => choices.every(choice => el.contains(choice)));
    possible.sort((a, b) => a.contains(b) ? 1 : b.contains(a) ? -1 : 0);
    let scroller = possible[0];

    if (!scroller) {
      scroller = choices[0].parentElement;
      while (scroller && !choices.every(choice => scroller.contains(choice))) {
        scroller = scroller.parentElement;
      }
    }

    if (!scroller || scroller === section || !section.contains(scroller)) {
      console.warn('[MAGMA] Category list could not be isolated. Skipped.');
      return;
    }

    const saved = new Map();
    function set(el, property, value) {
      if (!saved.has(el)) saved.set(el, el.getAttribute('style'));
      el.style.setProperty(property, value, 'important');
    }

    // Release conflicting scrollbar/height restrictions only within Category.
    const wrappers = [...section.querySelectorAll(LISTS)];
    wrappers.forEach(el => {
      set(el, 'max-height', 'none');
      set(el, 'height', 'auto');
      set(el, 'min-height', '0');
      set(el, 'overflow-y', 'visible');
      set(el, 'overflow-x', 'visible');
      set(el, 'padding-bottom', '0');
      set(el, 'scroll-padding-bottom', '0');
    });

    for (const el of section.querySelectorAll('*')) {
      if (el === scroller || wrappers.includes(el)) continue;
      if (el.querySelectorAll(CHECKBOX).length < 3) continue;
      const css = getComputedStyle(el);
      if (
        el.clientHeight < 45 ||
        !['auto', 'scroll'].includes(css.overflowY) ||
        el.scrollHeight <= el.clientHeight + 5
      ) continue;
      set(el, 'max-height', 'none');
      set(el, 'height', 'auto');
      set(el, 'overflow-y', 'visible');
      set(el, 'overflow-x', 'visible');
    }

    // Only this checkbox list scrolls; no wheel interception or sidebar changes.
    set(scroller, 'box-sizing', 'border-box');
    set(scroller, 'height', 'auto');
    set(scroller, 'max-height', '270px');
    set(scroller, 'overflow-y', 'auto');
    set(scroller, 'overflow-x', 'hidden');
    set(scroller, 'overscroll-behavior-y', 'contain');
    set(scroller, 'padding-bottom', '0');
    set(scroller, 'scroll-padding-bottom', '0');
    set(scroller, 'scrollbar-width', 'thin');
    set(scroller, 'scrollbar-color', '#ff1747 #211e24');

    active = {
      section, scroller, lastChoice, choiceCount: choices.length,
      undo() {
        saved.forEach((original, el) => {
          if (original === null) el.removeAttribute('style');
          else el.setAttribute('style', original);
        });
      }
    };
    console.info('[MAGMA] Category V2: single-scrollbar fix applied.');
  }

  function schedule() {
    if (stopped || queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply();
    });
  }

  function dispose() {
    stopped = true;
    observer?.disconnect();
    if (interval) clearInterval(interval);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('pagehide', dispose);
    if (active) active.undo();
    active = null;
    if (window[KEY]?.dispose === dispose) delete window[KEY];
    if (window.magmaCategorySingleScrollbarUndo === dispose) {
      delete window.magmaCategorySingleScrollbarUndo;
    }
  }

  window[KEY] = {dispose};
  window.magmaCategorySingleScrollbarUndo = dispose;

  function start() {
    if (stopped) return;
    observer = new MutationObserver(schedule);
    observer.observe(document.body, {childList: true, subtree: true});
    interval = setInterval(apply, 1200);
    window.addEventListener('resize', schedule);
    window.addEventListener('pagehide', dispose);
    schedule();
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, {once: true});
})();

/*
 * MAGMAHOOKAH — Hide redundant Category filter on Shisha Tobacco and Hookahs
 * Only Ecwid categories 191136590 (Shisha) and 191486349 (Hookahs).
 * Keep Brand, Price, Search, sidebar sticky v4.9, Category V2 on other pages.
 * CSS-only visibility toggle: filters and product data are not changed.
 * Add this AFTER the existing v4.9 + Sort cleanup + Category V2 blocks.
 */
(() => {
  'use strict';

  const KEY = '__magmaShishaRedundantCategoryV1';
  window[KEY]?.dispose?.();

  const CATEGORY_IDS_WITH_DUPLICATE_FILTERS = new Set([191136590, 191486349]);
  const HTML_FLAG = 'magma-shisha-hide-duplicate-category';
  const STYLE_ID = 'magma-shisha-hide-duplicate-category-style';
  let disposed = false;
  let subscribed = false;
  let lastPage = null;
  let poll = null;
  let style = null;

  function ensureStyle() {
    if (disposed) return;
    style = document.getElementById(STYLE_ID);
    if (style) return;
    style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html.${HTML_FLAG}
      .ec-filters.ec-filters--inline.ec-filters--left
      .ec-filter--category {
        display: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function showOrHide(categoryId, pageType) {
    if (disposed) return;
    ensureStyle();
    const hide = pageType === 'CATEGORY' &&
      CATEGORY_IDS_WITH_DUPLICATE_FILTERS.has(Number(categoryId));
    document.documentElement.classList.toggle(HTML_FLAG, hide);
  }

  // Official Ecwid storefront API gives the exact category id (no URL guessing).
  function onPageLoaded(page) {
    if (disposed) return;
    lastPage = page || null;
    showOrHide(page?.categoryId, page?.type);
  }

  function onPageLoad() {
    // Clear the flag promptly when navigating away from either targeted category.
    // OnPageLoaded sets it again once the destination is known.
    if (!disposed) document.documentElement.classList.remove(HTML_FLAG);
  }

  function subscribe() {
    if (disposed || subscribed) return;
    const api = window.Ecwid;
    if (!api?.OnPageLoaded || typeof api.OnPageLoaded.add !== 'function') {
      return;
    }
    try {
      api.OnPageLoaded.add(onPageLoaded);
      api.OnPageLoad?.add?.(onPageLoad);
      subscribed = true;
    } catch (err) {
      console.warn('[MAGMA] Shisha filter: Ecwid page listener unavailable.', err);
    }
  }

  // If custom JS runs after Ecwid's first page event, use only an unambiguous
  // current category URL or the category's exact on-page title as fallback.
  // Never infer a category from navigation links, breadcrumbs, or product names.
  function initialFallback() {
    if (disposed || lastPage) return;
    const href = window.location.href;
    const id = href.match(/-c(\d+)(?=$|[/?#&])/i)?.[1];
    if (id) {
      showOrHide(id, 'CATEGORY');
      return;
    }

    const title = document.querySelector(
      '.ec-store.ec-store__category-page h1, ' +
      '.ec-store.ec-store__category-page .ec-page-title'
    );
    const label = title?.textContent?.replace(/\s+/g, ' ').trim().toLowerCase();
    if (label === 'hookah tobacco & shisha' ||
        label === 'hookah tobacco and shisha') {
      showOrHide(191136590, 'CATEGORY');
    } else if (label === 'hookahs') {
      showOrHide(191486349, 'CATEGORY');
    }
  }

  function start() {
    if (disposed) return;
    ensureStyle();
    subscribe();
    initialFallback();
    poll = setInterval(() => {
      if (!subscribed) subscribe();
      if (!lastPage) initialFallback();
    }, 1200);
  }

  function dispose() {
    disposed = true;
    if (poll) clearInterval(poll);
    document.documentElement.classList.remove(HTML_FLAG);
    // Ecwid may not support removing individual event listeners. The
    // disposed guard makes callbacks from older injections inert.
    style?.remove();
    if (window[KEY]?.dispose === dispose) delete window[KEY];
  }

  window[KEY] = {
    dispose,
    status: () => ({
      apiSubscribed: subscribed,
      pageType: lastPage?.type || 'not-received',
      categoryId: lastPage?.categoryId ?? null,
      hideDuplicateCategory: document.documentElement.classList.contains(HTML_FLAG)
    })
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, {once: true});
  } else {
    start();
  }
})();




30
