/**
 * Optional, source-backed chart primitive for future stories.
 * This module is not imported by the homepage or current RSS archive.
 * No invented data or external fetches occur until an editor explicitly
 * calls renderEditorialChart with sourced rows.
 *
 * Observable Plot: ISC license, pinned to v0.6.17 via jsDelivr.
 */
const PLOT_URL = 'https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.17/+esm';
const COLOR = '#171717';

export async function renderEditorialChart({
  container, rows, xKey, yKey, title, sourceName, sourceUrl,
  type = 'line', unit = '', description = ''
}) {
  if (!(container instanceof HTMLElement)) throw new TypeError('Provide a chart container element.');
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Verified data rows are required.');
  if (![xKey, yKey, title, sourceName, sourceUrl].every(value => typeof value === 'string' && value.trim())) {
    throw new TypeError('Chart fields, title and attribution are required.');
  }
  if (!/^https:\/\//.test(sourceUrl)) throw new TypeError('The source must have an HTTPS URL.');
  if (!['line', 'bar'].includes(type)) throw new TypeError('Use a line or bar chart.');

  const points = rows.map((row, index) => {
    const numeric = Number(row[yKey]);
    if (!row[xKey] || !Number.isFinite(numeric) || row[yKey] == null || row[yKey] === '') {
      throw new TypeError('Invalid numeric chart data at row ' + (index + 1));
    }
    return { label: String(row[xKey]), value: numeric };
  });

  // Lazy-load only on pages containing a verified chart.
  const Plot = await import(PLOT_URL);
  const mark = type === 'bar'
    ? Plot.barY(points, { x: 'label', y: 'value', fill: COLOR, tip: true })
    : Plot.lineY(points, { x: 'label', y: 'value', stroke: COLOR, strokeWidth: 2.2, tip: true });

  const chart = Plot.plot({
    width: Math.max(320, Math.min(840, container.clientWidth || 700)),
    height: 290, marginLeft: 54, marginBottom: 50,
    style: { background: 'transparent', fontFamily: 'Inter, system-ui, sans-serif', color: '#222' },
    x: { label: null },
    y: { grid: true, label: unit || null },
    marks: [Plot.ruleY([0], { stroke: '#e5e5e5' }), mark]
  });

  const figure = document.createElement('figure');
  figure.className = 'editorial-chart';
  const heading = document.createElement('figcaption');
  heading.textContent = title;
  figure.append(heading, chart);
  if (description) {
    const note = document.createElement('p');
    note.className = 'editorial-chart-note';
    note.textContent = description;
    figure.append(note);
  }
  const attribution = document.createElement('a');
  attribution.href = sourceUrl;
  attribution.rel = 'noopener noreferrer';
  attribution.target = '_blank';
  attribution.className = 'editorial-chart-source';
  attribution.textContent = 'Source: ' + sourceName;
  figure.append(attribution);
  container.replaceChildren(figure);
  return figure;
}
