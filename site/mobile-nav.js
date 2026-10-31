(() => {
  'use strict';
  const menu = document.getElementById('mobile-menu-panel');
  const opener = document.getElementById('mobile-menu-open');
  if (!menu || !opener) return;
  const closeButton = menu.querySelector('[data-mobile-menu-close]');
  const mobile = window.matchMedia('(max-width: 780px)');
  const bar = document.getElementById('mobile-nav-bar');
  let lastFocus = null;
  const focusables = () => [...menu.querySelectorAll('a[href],button:not([disabled])')].filter(node => node.getClientRects().length);
  const setOpen = open => {
    if (open && !mobile.matches) return;
    if (open) { lastFocus = document.activeElement; bar?.classList.remove('is-concealed'); }
    menu.dataset.open = String(open);
    menu.hidden = !open;
    menu.inert = !open;
    menu.setAttribute('aria-hidden', String(!open));
    opener.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('mobile-menu-open', open);
    if (open) {
      closeButton?.focus();
    } else if (lastFocus) {
      lastFocus.focus({preventScroll:true});
      lastFocus = null;
    }
  };
  menu.dataset.open = 'false';
  menu.hidden = true;
  menu.inert = true;
  document.documentElement.classList.add('shell-ready');
  opener.addEventListener('click', () => setOpen(true));
  closeButton?.addEventListener('click', () => setOpen(false));
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', event => {
    if (menu.dataset.open !== 'true') return;
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); return; }
    if (event.key !== 'Tab') return;
    const nodes = focusables();
    if (!nodes.length) return;
    if (event.shiftKey && document.activeElement === nodes[0]) {event.preventDefault();nodes[nodes.length - 1].focus();}
    else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) {event.preventDefault();nodes[0].focus();}
  });
  mobile.addEventListener('change', event => {
    if (!event.matches && menu.dataset.open === 'true') setOpen(false);
    if (!event.matches) bar?.classList.remove('is-concealed');
  });
  // Reveal on upward scroll, tuck the floating header away when reading downward.
  let scrollAnchor = window.scrollY;
  let scrollScheduled = false;
  window.addEventListener('scroll', () => {
    if (!mobile.matches || scrollScheduled || menu.dataset.open === 'true') return;
    scrollScheduled = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      const delta = y - scrollAnchor;
      if (y < 80) {
        bar?.classList.remove('is-concealed');
        scrollAnchor = y;
      } else if (delta > 12 && y > 180) {
        bar?.classList.add('is-concealed');
        scrollAnchor = y;
      } else if (delta < -10) {
        bar?.classList.remove('is-concealed');
        scrollAnchor = y;
      }
      scrollScheduled = false;
    });
  }, {passive:true});
})();