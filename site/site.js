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

  // This is always an IST desk clock, regardless of the reader's device timezone.
  const tz = 'Asia/Kolkata';
  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz, hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23'
  });
  const dateFormat = new Intl.DateTimeFormat('en-IN', { timeZone:tz, weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const clock = document.getElementById('analog-clock');
  if (clock) {
    const dial = document.createElement('div');
    dial.className = 'clock-indices';
    dial.setAttribute('aria-hidden', 'true');
    for (let mark = 0; mark < 60; mark++) {
      const index = document.createElement('span');
      index.className = mark % 5 === 0 ? 'dial-mark dial-mark-major' : 'dial-mark';
      index.style.setProperty('--angle', `${mark * 6}deg`);
      dial.appendChild(index);
    }
    clock.prepend(dial);
  }
  const hourHand = document.getElementById('clock-hour');
  const minuteHand = document.getElementById('clock-minute');
  const secondHand = document.getElementById('clock-second');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hands = [
    {element:hourHand, duration:43200},
    {element:minuteHand, duration:3600},
    {element:secondHand, duration:60}
  ];

  function timeInIndia(now) {
    const parts = Object.fromEntries(timeParts.formatToParts(now)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, Number(part.value)]));
    return {hour:parts.hour || 0, minute:parts.minute || 0,
      second:parts.second || 0, fraction:now.getMilliseconds()/1000};
  }

  // All three hands sweep on the compositor, synchronized to India Standard
  // Time, instead of stepping once per second or running a 60fps JS timer.
  // Negative animation delays position the hands at their real-world phase.
  function synchronizeHands(now = new Date()) {
    if (!clock) return;
    const p=timeInIndia(now);
    const elapsed=p.second+p.fraction;
    const phases=[
      (p.hour % 12)*3600+p.minute*60+elapsed,
      p.minute*60+elapsed,
      elapsed
    ];
    clock.classList.remove('clock-running');
    hands.forEach(({element,duration},index)=>{
      if (!element) return;
      element.style.animationDelay=`-${phases[index]}s`;
      // Motion-disabled readers still see an accurate clock on the next tick.
      element.style.transform=motionPreference.matches
        ? `translateX(-50%) rotate(${(phases[index]/duration)*360}deg)`
        : '';
    });
    if (!motionPreference.matches) {
      // Restart after tab suspension to correct for browser throttling.
      void clock.offsetWidth;
      clock.classList.add('clock-running');
    }
  }

  function tick() {
    const now=new Date();
    const p=timeInIndia(now);
    const h=p.hour, m=p.minute;
    if (motionPreference.matches) {
      const elapsed=p.second+p.fraction;
      const phases=[(h%12)*3600+m*60+elapsed, m*60+elapsed, elapsed];
      hands.forEach(({element,duration},index)=>{
        if (element) element.style.transform=`translateX(-50%) rotate(${phases[index]/duration*360}deg)`;
      });
    }
    const digital=document.getElementById('digital-clock');
    if (digital) digital.textContent=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} IST`;
    const dateNode=document.getElementById('desk-date');
    if (dateNode) {
      dateNode.textContent=dateFormat.format(now);
      // A datetime reflects the newsroom's local calendar day, not UTC.
      const dateParts=new Intl.DateTimeFormat('en-CA',{
        timeZone:tz, year:'numeric',month:'2-digit',day:'2-digit'
      }).formatToParts(now);
      const dateMap=Object.fromEntries(dateParts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
      dateNode.dateTime=`${dateMap.year}-${dateMap.month}-${dateMap.day}`;
    }
    if (clock) clock.setAttribute('aria-label',
      `Analog clock, ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} India Standard Time`);
  }

  synchronizeHands();
  tick();
  if (clock) {
    setInterval(tick, 1000);
    document.addEventListener('visibilitychange',()=>{
      if (document.visibilityState==='visible') { synchronizeHands();tick(); }
    });
    const onMotionChange=()=>{synchronizeHands();tick();};
    if (motionPreference.addEventListener) motionPreference.addEventListener('change',onMotionChange);
    else motionPreference.addListener(onMotionChange);
  }

  // Weather is always explicitly for New Delhi, not inferred from the visitor's location.
  const weatherNode = document.getElementById('new-delhi-weather');
  const emojiNode = document.getElementById('weather-emoji');
  if (weatherNode) {
    const weatherEndpoint = 'https://api.open-meteo.com/v1/forecast?latitude=28.6139&longitude=77.2090&current=temperature_2m,weather_code,is_day&timezone=Asia%2FKolkata';
    const weatherCodes = (code, isDay) => {
      if (code === 0) return [isDay ? '☀️' : '🌙', 'Clear'];
      if ([1, 2].includes(code)) return [isDay ? '🌤️' : '☁️', 'Partly cloudy'];
      if (code === 3) return ['☁️', 'Cloudy'];
      if ([45, 48].includes(code)) return ['🌫️', 'Fog'];
      if ([51, 53, 55, 56, 57].includes(code)) return ['🌦️', 'Drizzle'];
      if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return ['🌧️', 'Rain'];
      if ([71, 73, 75, 77, 85, 86].includes(code)) return ['❄️', 'Snow'];
      if ([95, 96, 99].includes(code)) return ['⛈️', 'Storm'];
      return ['🌡️', 'Conditions'];
    };
    async function refreshWeather() {
      try {
        const controller = new AbortController();
        const abort = setTimeout(() => controller.abort(), 9000);
        let response;
        try { response = await fetch(weatherEndpoint, {signal:controller.signal, cache:'no-store'}); }
        finally { clearTimeout(abort); }
        if (!response.ok) throw Error('Weather unavailable');
        const data = await response.json();
        const temperature = data?.current?.temperature_2m;
        const code = data?.current?.weather_code;
        if (!Number.isFinite(temperature) || !Number.isFinite(code)) throw Error('Invalid weather payload');
        const [emoji, label] = weatherCodes(code, data?.current?.is_day !== 0);
        if (emojiNode) emojiNode.textContent = emoji;
        weatherNode.textContent = `${Math.round(temperature)}°C · ${label}`;
        weatherNode.title = 'Current modeled conditions in New Delhi; source: Open-Meteo';
      } catch (_) { if (emojiNode) emojiNode.textContent = '🌡️'; weatherNode.textContent = 'Weather unavailable'; }
    }
    refreshWeather();
    setInterval(refreshWeather, 15 * 60 * 1000);
  }
})();
