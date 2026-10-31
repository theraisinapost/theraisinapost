(() => {
  'use strict';
  const panel = document.getElementById('mobile-menu-panel');
  const bar = document.getElementById('mobile-nav-bar');
  const opener = document.querySelector('[data-mobile-menu-open]');
  const closer = document.querySelector('[data-mobile-menu-close]');
  if (!panel || !bar || !opener || !closer) return;
  const inertNodes = [...document.querySelectorAll('main, body > header, body > footer, body > .market-strip')];
  let previousFocus = null;
  const open = () => !panel.hidden;
  function closeMenu(restore = true) {
    if (!open()) return;
    panel.hidden = true;
    document.body.classList.remove('mobile-menu-open');
    opener.setAttribute('aria-expanded', 'false');
    opener.setAttribute('aria-label', 'Open menu');
    inertNodes.forEach(node => {node.inert = false});
    if (restore) (previousFocus || opener).focus({preventScroll:true});
  }
  function openMenu() {
    if (open()) return;
    previousFocus = document.activeElement;
    panel.hidden = false;
    document.body.classList.add('mobile-menu-open');
    opener.setAttribute('aria-expanded', 'true');
    opener.setAttribute('aria-label', 'Menu open');
    bar.classList.remove('is-concealed');
    inertNodes.forEach(node => {node.inert = true});
    closer.focus({preventScroll:true});
  }
  opener.addEventListener('click', openMenu);
  closer.addEventListener('click', () => closeMenu());
  panel.querySelectorAll('a').forEach(a => a.addEventListener('click', () => closeMenu(false)));
  document.addEventListener('keydown', e => {
    if (!open()) return;
    if (e.key === 'Escape') {e.preventDefault();closeMenu();return}
    if (e.key !== 'Tab') return;
    const items = [...panel.querySelectorAll('a[href],button:not([disabled])')].filter(el => el.getClientRects().length);
    const first = items[0], last = items[items.length-1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {e.preventDefault();last.focus()}
    else if (!e.shiftKey && document.activeElement === last) {e.preventDefault();first.focus()}
  });
  const media = window.matchMedia('(max-width: 780px)');
  media.addEventListener?.('change', () => {if (!media.matches){closeMenu(false);bar.classList.remove('is-concealed')}});
  let lastY = window.scrollY, queued = false;
  window.addEventListener('scroll', () => {
    if (queued || !media.matches || open()) return;
    queued = true;
    window.requestAnimationFrame(() => {
      const y = window.scrollY;
      if (y < 80 || y < lastY - 5) bar.classList.remove('is-concealed');
      else if (y > 150 && y > lastY + 5) bar.classList.add('is-concealed');
      lastY = y;queued = false;
    });
  }, {passive:true});
})();