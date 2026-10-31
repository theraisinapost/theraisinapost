/* Source-first World Bank indicators. Never invent, estimate or silently substitute data. */
(() => {
  'use strict';
  const indicators = {
    gdp: 'NY.GDP.MKTP.KD.ZG',
    inflation: 'FP.CPI.TOTL.ZG',
    exports: 'NE.EXP.GNFS.ZS'
  };
  const series = {};
  let selected = 'gdp';
  const chart = document.querySelector('#macro-chart');
  const status = document.querySelector('#macro-status');
  const source = document.querySelector('#macro-source');
  const tabs = [...document.querySelectorAll('[data-macro]')];
  const format = v => new Intl.NumberFormat('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
  const url = code => 'https://api.worldbank.org/v2/country/IND/indicator/' + code + '?format=json&per_page=70';
  const sourceURL = code => 'https://data.worldbank.org/indicator/' + code + '?locations=IN';

  async function getSeries(key) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url(indicators[key]), {signal:controller.signal,cache:'no-store'});
      if (!response.ok) throw Error('World Bank is unavailable');
      const json = await response.json();
      if (!Array.isArray(json) || !Array.isArray(json[1])) throw Error('Unexpected World Bank response');
      const observations = json[1]
        .filter(item => item && /^\d{4}$/.test(String(item.date)) &&
          typeof item.value === 'number' && Number.isFinite(item.value) &&
          item.countryiso3code === 'IND')
        .map(item => ({year: Number(item.date), value: item.value}))
        .sort((a,b) => a.year - b.year);
      if (!observations.length) throw Error('No published observations');
      return observations;
    } finally { clearTimeout(timer); }
  }
  function updateCard(key) {
    const number = document.getElementById('macro-' + key + '-value');
    const when = document.getElementById('macro-' + key + '-date');
    if (!number || !when) return;
    const rows = series[key];
    if (!rows?.length) {
      number.textContent = '—';
      when.textContent = 'Data unavailable';
      return;
    }
    const latest = rows.at(-1);
    number.textContent = format(latest.value) + '%';
    when.textContent = 'Reference year ' + latest.year + ' · World Bank';
  }
  function fallback(rows) {
    const caption = document.createElement('p');
    caption.className = 'market-disclaimer';
    caption.textContent = 'Geistactive chart unavailable; verified annual figures are shown below.';
    const list = document.createElement('ul');
    list.className = 'macro-fallback';
    for (const row of rows.slice(-8)) {
      const item = document.createElement('li');
      item.textContent = row.year + ' · ' + format(row.value) + '%';
      list.appendChild(item);
    }
    chart.replaceChildren(caption,list);
  }
  async function renderChart() {
    const key = selected;
    source.href = sourceURL(indicators[key]);
    const rows = series[key];
    chart.replaceChildren();
    if (!rows) {
      status.textContent = 'World Bank series unavailable. No unverified number is displayed.';
      return;
    }
    const points = rows.slice(-16);
    status.textContent = 'World Bank observations ' + points[0].year + '–' + points.at(-1).year +
      ' · Latest published year, not a live quotation; historical revisions are possible.';
    try {
      const Plot = await import('https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.17/+esm');
      if (key !== selected) return;
      const plot = Plot.plot({
        width: Math.min(900, Math.max(320, chart.clientWidth || 680)),
        height: 290, marginLeft: 58, marginBottom: 44,
        style: {background:'transparent', fontFamily:'Geist, sans-serif', color:'#333'},
        x: {label:'Year', ticks:6, tickFormat: x => String(x)},
        y: {label:'Percent', grid:true},
        marks: [
          Plot.ruleY([0],{stroke:'#ddd'}),
          Plot.lineY(points,{x:'year', y:'value', stroke:'#a41129', strokeWidth:2.3, tip:true}),
          Plot.dot(points,{x:'year', y:'value', fill:'#a41129', r:3.2, tip:true})
        ]
      });
      if (key === selected) chart.replaceChildren(plot);
    } catch (_) { if (key === selected) fallback(points); }
  }
  tabs.forEach(tab=>tab.addEventListener('click',()=>{
    selected = tab.dataset.macro;
    for (const item of tabs) {
      const active = item === tab;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-pressed', String(active));
    }
    renderChart();
  }));
  Promise.allSettled(Object.keys(indicators).map(async key=>{
    series[key] = await getSeries(key);
    updateCard(key);
  })).then(results=>{
    Object.keys(indicators).forEach((key,i)=>{
      if (results[i].status === 'rejected') updateCard(key);
    });
    renderChart();
  });
})();
