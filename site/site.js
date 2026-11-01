(() => {
  'use strict';
  // Visible quotes load as their card enters view; no disclosure is required.
  const ticker = document.querySelector('[data-market-ticker]');
  if (ticker) {
    const loadQuotes = () => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = 'https://widgets.tradingview-widget.com/w/en/tv-ticker-tape.js';
      document.head.appendChild(script);
    };
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        observer.disconnect();
        loadQuotes();
      });
      observer.observe(ticker);
    } else loadQuotes();
  }

  // Keep off-screen charts dormant; each provider embed is mounted only once.
  const charts = [...document.querySelectorAll('[data-market-chart]')];
  let chartsLoaded = false;
  function mountChart(host) {
    if (host.dataset.mounted) return;
    host.dataset.mounted = 'true';
    const widget = document.createElement('tv-mini-chart');
    widget.setAttribute('symbol', host.dataset.marketChart);
    widget.setAttribute('theme', 'light');
    widget.setAttribute('time-frame', '1M');
    widget.setAttribute('show-time-scale', 'true');
    widget.setAttribute('transparent', 'true');
    widget.appendChild(host.querySelector('.market-chart-fallback'));
    host.appendChild(widget);
    if (!chartsLoaded) {
      chartsLoaded = true;
      const script = document.createElement('script');
      script.type = 'module';
      script.src = 'https://widgets.tradingview-widget.com/w/en/tv-mini-chart.js';
      document.head.appendChild(script);
    }
  }
  if ('IntersectionObserver' in window) {
    const chartObserver = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        chartObserver.unobserve(entry.target);
        mountChart(entry.target);
      }
    }, {threshold:0.05});
    charts.forEach(host => chartObserver.observe(host));
  } else charts.forEach(mountChart);

  const search = document.getElementById('article-search');
  const buttons = [...document.querySelectorAll('[data-filter]')];
  const rows = [...document.querySelectorAll('.article-row')];
  const label = document.getElementById('result-label');
  const empty = document.getElementById('empty-state');
  const clear = document.getElementById('clear-filters');
  let category = 'All';
  const normalize = value => (value || '').toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  function applyFilters() {
    if (!search) return;
    const query = normalize(search.value.trim());
    let matching = 0;
    for (const row of rows) {
      const haystack = normalize([row.dataset.title, row.dataset.summary, row.dataset.category].join(' '));
      const show = (category === 'All' || row.dataset.category === category) && (!query || haystack.includes(query));
      row.hidden = !show;
      if (show) matching++;
    }
    for (const btn of buttons) {
      const selected = btn.dataset.filter === category;
      btn.classList.toggle('active', selected);
      btn.setAttribute('aria-pressed', String(selected));
    }
    if (label) label.textContent = `${matching} ${matching === 1 ? 'article' : 'articles'} in the current view`;
    if (empty) empty.hidden = matching > 0;
  }
  for (const btn of buttons) btn.addEventListener('click', () => { category = btn.dataset.filter; applyFilters(); });
  for (const link of document.querySelectorAll('[data-nav-filter]')) link.addEventListener('click', () => {
    category = link.dataset.navFilter;
    if (search) search.value = '';
    applyFilters();
  });
  if (search) {
    search.addEventListener('input', applyFilters);
    document.addEventListener('keydown', event => {
      const t = event.target;
      const isTyping = t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (event.key === '/' && !isTyping && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        document.getElementById('archive')?.scrollIntoView({behavior:'smooth',block:'start'});
        search.focus({preventScroll:true});
      }
      if (event.key === 'Escape' && t === search) { search.value = ''; applyFilters(); search.blur(); }
    });
  }
  if (clear && search) clear.addEventListener('click', () => { category = 'All'; search.value = ''; applyFilters(); search.focus(); });
  const requestedSection = new URLSearchParams(window.location.search).get('section');
  if (['The Power Brief', 'Business', 'Governance'].includes(requestedSection)) category = requestedSection;
  applyFilters();

  // The masthead retains only the publication date in India time.
  const dateNode = document.getElementById('desk-date');
  if (dateNode) {
    const now = new Date();
    const options = {timeZone:'Asia/Kolkata',weekday:'long',day:'numeric',month:'long',year:'numeric'};
    dateNode.textContent = new Intl.DateTimeFormat('en-IN',options).format(now);
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA',{
      timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'
    }).formatToParts(now).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
    dateNode.dateTime = `${parts.year}-${parts.month}-${parts.day}`;
  }
})();
