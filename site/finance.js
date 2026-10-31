import { observations, purchasingPower, oilWindow } from './components/finance-model.mjs';

const byId = id => document.getElementById(id);
const money = value => value.toLocaleString('en-IN', {style:'currency',currency:'INR',maximumFractionDigits:2});
const number = value => value.toLocaleString('en-IN', {maximumFractionDigits:2});
const node = (tag, text) => { const e = document.createElement(tag); e.textContent = text; return e; };
const allowedCodes = {growth:'NY.GDP.MKTP.KD.ZG',inflation:'FP.CPI.TOTL.ZG',manufacturing:'NV.IND.MANF.ZS',reserves:'FI.RES.TOTL.CD',cpi:'FP.CPI.TOTL'};
const validStatus = series => series && ['available','retained'].includes(series.status) && typeof series.retrieved_at === 'string' && Number.isFinite(Date.parse(series.retrieved_at));
const sourceState = series => series.status === 'retained' ? 'Saved observations; latest refresh failed.' : 'Published observations; values may be revised.';
function checkLabel(series) {
  return 'Source retrieved ' + new Date(series.retrieved_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}) + '. ' + sourceState(series);
}

function setupIndia(data) {
  for (const key of ['growth','inflation','manufacturing','reserves']) {
    const card = byId('pulse-' + key), series = data.annual?.[key];
    if (!validStatus(series) || series.code !== allowedCodes[key]) continue;
    const rows = observations(series.rows), last = rows.at(-1);
    if (!last || (key === 'reserves' && last.value < 0)) continue;
    card.querySelector('strong').textContent = key === 'reserves' ? 'US$ ' + number(last.value / 1e9) + 'bn' : number(last.value) + '%';
    card.querySelector('[data-period]').textContent = 'Annual observation · ' + last.period;
    card.querySelector('[data-source-state]').textContent = checkLabel(series);
  }
  byId('pulse-status').textContent = 'Annual World Bank WDI observations. Reference years can differ between indicators; this is not a live or monthly release dashboard.';
  const form = byId('inflation-form'), series = data.annual?.cpi;
  if (!validStatus(series) || series.code !== allowedCodes.cpi) throw Error('CPI unavailable');
  const rows = observations(series.rows).filter(row => row.value > 0);
  if (!rows.length) throw Error('CPI unavailable');
  const from = byId('inflation-from'), to = byId('inflation-to');
  for (const select of [from, to]) {
    select.replaceChildren(...rows.map(row => new Option(row.period, row.period)));
    select.disabled = false;
  }
  from.value = rows[Math.max(0, rows.length - 11)].period;
  to.value = rows.at(-1).period;
  byId('inflation-amount').disabled = false;
  byId('inflation-calculate').disabled = false;
  byId('inflation-source-state').textContent = checkLabel(series);
  function calculate(event) {
    event?.preventDefault();
    try {
      const result = purchasingPower(rows, Number(byId('inflation-amount').value), from.value, to.value);
      byId('inflation-equivalent').textContent = money(result.equivalent);
      byId('inflation-change').textContent = number(result.change) + '%';
      byId('inflation-result').textContent = money(Number(byId('inflation-amount').value)) + ' in ' + from.value + ' corresponds to ' + money(result.equivalent) + ' in ' + to.value + ' using the annual average CPI basket.';
    } catch (error) {
      byId('inflation-equivalent').textContent = '—';
      byId('inflation-change').textContent = '—';
      byId('inflation-result').textContent = error.message;
    }
  }
  form.addEventListener('submit', calculate);
  calculate();
}

function drawOil(svg, rows, label) {
  svg.replaceChildren();
  if (!rows.length) return;
  const NS = 'http://www.w3.org/2000/svg';
  function shape(tag, attrs, text) {
    const el = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
    if (text !== undefined) el.textContent = text;
    svg.append(el);
  }
  const dates = rows.map(row => Date.parse(row.period + 'T00:00:00Z'));
  let low = Math.min(...rows.map(row => row.value)), high = Math.max(...rows.map(row => row.value));
  const padding = (high - low || 1) * .12;
  low -= padding; high += padding;
  const x = i => 72 + (dates[i] - dates[0]) / (dates.at(-1) - dates[0] || 1) * 716;
  const y = value => 248 - (value - low) / (high - low) * 220;
  for (let i = 0; i < 4; i++) {
    const value = low + (high - low) * i / 3;
    shape('line', {x1:72,x2:788,y1:y(value),y2:y(value),stroke:'#ececec'});
    shape('text', {x:62,y:y(value)+4,'text-anchor':'end',fill:'#595959','font-size':12}, number(value));
  }
  shape('polyline',{points:rows.map((row,i) => x(i).toFixed(1)+','+y(row.value).toFixed(1)).join(' '),fill:'none',stroke:'#171717','stroke-width':2});
  for (const i of [0, rows.length - 1]) shape('text',{x:x(i),y:280,'text-anchor':i ? 'end' : 'start',fill:'#595959','font-size':12},rows[i].period);
  svg.setAttribute('aria-label',label+' daily spot history in US dollars per barrel, '+rows[0].period+' to '+rows.at(-1).period);
}

function setupOil(data) {
  const selector = byId('oil-benchmark'), range = byId('oil-range');
  let selectedRows = [];
  function render() {
    const key = selector.value, series = data.oil?.[key];
    selectedRows = [];
    byId('oil-history-chart').replaceChildren();
    byId('oil-history-rows').replaceChildren();
    byId('oil-history-latest').textContent = '—';
    byId('oil-history-period').textContent = 'No observations available';
    byId('oil-csv').disabled = true;
    if (!['brent','wti'].includes(key) || !validStatus(series)) {
      byId('oil-history-status').textContent = 'Historical source unavailable. Open the EIA source below.';
      return;
    }
    selectedRows = oilWindow(observations(series.rows,'daily'), Number(range.value));
    if (!selectedRows.length) {
      byId('oil-history-status').textContent = 'No validated observations in this range.';
      return;
    }
    const last = selectedRows.at(-1), age = (Date.now() - Date.parse(last.period + 'T00:00:00Z')) / 86400000;
    const label = key === 'brent' ? 'Brent' : 'WTI';
    byId('oil-history-latest').textContent = 'US$ ' + number(last.value);
    byId('oil-history-period').textContent = label + ' · observed ' + last.period + ' · per barrel';
    byId('oil-history-status').textContent = selectedRows.length + ' daily observations. ' + checkLabel(series) + (age > 10 ? ' Latest observation is more than 10 days old.' : '') + ' Range ends at the latest available observation.';
    drawOil(byId('oil-history-chart'), selectedRows, label);
    for (const row of selectedRows.slice(-20).reverse()) {
      const tr = document.createElement('tr');
      tr.append(node('td',row.period),node('td',number(row.value)));
      byId('oil-history-rows').append(tr);
    }
    byId('oil-csv').disabled = false;
  }
  selector.addEventListener('change', render);
  range.addEventListener('change', render);
  byId('oil-csv').addEventListener('click', () => {
    if (!selectedRows.length) return;
    const csv = 'date,benchmark,usd_per_barrel,source\n' + selectedRows.map(row => [row.period,selector.value,row.value,'US EIA via datasets/oil-prices'].join(',')).join('\n') + '\n';
    const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const a = document.createElement('a');
    a.href = url; a.download = selector.value + '-spot-history.csv'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  render();
}

if (byId('inflation-form') || byId('oil-history-chart')) {
  fetch('data/finance.json', {cache:'no-store'})
    .then(response => {if (!response.ok) throw Error('Snapshot unavailable'); return response.json();})
    .then(data => {
      if (data.schema !== 1) throw Error('Snapshot unavailable');
      if (byId('inflation-form')) setupIndia(data);
      if (byId('oil-history-chart')) setupOil(data);
    }).catch(() => {
      if (byId('pulse-status')) byId('pulse-status').textContent = 'Some economic observations are unavailable. Open the source links for published data.';
      if (byId('inflation-result')) byId('inflation-result').textContent = 'Published CPI observations unavailable. Calculation is disabled.';
      if (byId('oil-history-status')) byId('oil-history-status').textContent = 'Historical source unavailable. Open the EIA source below.';
    });
}
