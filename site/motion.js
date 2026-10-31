/* Progressive, accessibility-conscious reveal effects. Never hide content
   without a functioning observer, and never animate for reduced-motion users. */
(() => {
  'use strict';
  if (!('IntersectionObserver' in window) ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const targets=[...document.querySelectorAll(
    '.research-teaser-grid a, .intel-home-links a, .commodity-grid > *, '+
    '.macro-cards > *, .obs-metrics > div, .article-row, .intel-home-links a'
  )].slice(0,75);
  if (!targets.length) return;
  let observer;
  try {
    observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if (!entry.isIntersecting) return;
        entry.target.classList.add('motion-visible');
        observer.unobserve(entry.target);
      });
    },{threshold:0.06,rootMargin:'0px 0px 32px 0px'});
    targets.forEach((target,index)=>{
      target.style.setProperty('--motion-delay',(index%3)*45+'ms');
      target.classList.add('motion-pending');
      observer.observe(target);
    });
  } catch (_) {
    targets.forEach(target=>{
      target.classList.remove('motion-pending');
      target.style.removeProperty('--motion-delay');
    });
    if (observer) observer.disconnect();
  }
  // While the tab is backgrounded, never leave hidden blocks inaccessible on
  // resuming from a paused observer or browser-throttled rendering context.
  document.addEventListener('visibilitychange',()=>{
    if (document.visibilityState==='visible') {
      for (const target of targets) {
        if (target.classList.contains('motion-pending') &&
            target.getBoundingClientRect().top < window.innerHeight) {
          target.classList.add('motion-visible');
          observer.unobserve(target);
        }
      }
    }
  });
})();
