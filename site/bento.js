/* Keep the opening card aligned to the text gutter while the rail spans the
   actual viewport, including on browsers with non-overlay scrollbars. */
(() => {
  'use strict';
  const rails = [...document.querySelectorAll('[data-bento]')];
  if (!rails.length) return;
  let queued = false;
  function measure() {
    const width = document.documentElement.clientWidth;
    for (const rail of rails) {
      const wrap = rail.parentElement.closest('.wrap');
      const offset = Math.max(0, wrap?.getBoundingClientRect().left || 0);
      rail.style.setProperty('--bento-width', width + 'px');
      rail.style.setProperty('--bento-offset', offset + 'px');
    }
    queued = false;
  }
  function resize() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(measure);
  }
  measure();
  window.addEventListener('resize', resize, {passive:true});
  for (const rail of rails) {
    rail.addEventListener('keydown', event => {
      if (event.target !== rail || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
      const step = (rail.firstElementChild?.getBoundingClientRect().width || 304) + gap;
      const left = event.key === 'Home' ? 0 : event.key === 'End' ? rail.scrollWidth - rail.clientWidth
        : rail.scrollLeft + (event.key === 'ArrowRight' ? step : -step);
      rail.scrollTo({left, behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
    });
  }
})();
