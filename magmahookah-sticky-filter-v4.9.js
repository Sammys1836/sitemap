






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




30
