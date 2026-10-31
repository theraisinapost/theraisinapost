(() => {
  'use strict';
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
  function tick() {
    const now = new Date();
    const p = Object.fromEntries(timeParts.formatToParts(now).filter(x => x.type !== 'literal').map(x => [x.type, Number(x.value)]));
    const h = p.hour || 0, m = p.minute || 0, s = p.second || 0;
    const hour = document.getElementById('clock-hour'), minute = document.getElementById('clock-minute'), second = document.getElementById('clock-second');
    if (hour) hour.style.transform = `translateX(-50%) rotate(${(h % 12 + m / 60 + s / 3600) * 30}deg)`;
    if (minute) minute.style.transform = `translateX(-50%) rotate(${(m + s / 60) * 6}deg)`;
    if (second) second.style.transform = `translateX(-50%) rotate(${s * 6}deg)`;
    const digital = document.getElementById('digital-clock');
    if (digital) digital.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} IST`;
    const dateNode = document.getElementById('desk-date');
    if (dateNode) { dateNode.textContent = dateFormat.format(now); dateNode.dateTime = now.toISOString(); }
    if (clock) clock.setAttribute('aria-label', `Analog clock, ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} India Standard Time`);
  }
  tick();
  if (clock) setInterval(tick, 1000);

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
