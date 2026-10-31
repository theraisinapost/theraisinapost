/* Calculations on published observations; no fetching or estimated data. */
export function observations(rows, frequency = 'annual') {
  const pattern = frequency === 'annual' ? /^\d{4}$/ : /^\d{4}-\d{2}-\d{2}$/;
  const today = new Date().toISOString().slice(0, 10);
  const unique = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row.period !== 'string' || !pattern.test(row.period) ||
        typeof row.value !== 'number' || !Number.isFinite(row.value)) continue;
    const date = frequency === 'annual' ? row.period + '-01-01' : row.period;
    const parsed = new Date(date + 'T00:00:00Z');
    if (date > today || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) continue;
    if (unique.has(row.period) && unique.get(row.period) !== row.value) throw Error('Conflicting observations');
    unique.set(row.period, row.value);
  }
  return [...unique].sort(([a], [b]) => a.localeCompare(b)).map(([period, value]) => ({period, value}));
}

export function purchasingPower(rows, amount, from, to) {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) throw Error('Enter an amount above zero and no more than ₹1 trillion.');
  if (!/^\d{4}$/.test(from) || !/^\d{4}$/.test(to) || Number(to) < Number(from)) throw Error('Choose an end year on or after the start year.');
  const start = rows.find(row => row.period === from), end = rows.find(row => row.period === to);
  if (!start || !end || start.value <= 0 || end.value <= 0) throw Error('Both years need published positive CPI observations.');
  const ratio = end.value / start.value;
  return {equivalent: amount * ratio, change: (ratio - 1) * 100};
}

export function oilWindow(rows, years) {
  if (!rows.length || ![1, 5, 10].includes(years)) return [];
  const last = new Date(rows.at(-1).period + 'T00:00:00Z');
  const year = last.getUTCFullYear() - years, month = last.getUTCMonth();
  const day = Math.min(last.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  const start = new Date(Date.UTC(year, month, day));
  return rows.filter(row => row.period >= start.toISOString().slice(0, 10));
}
