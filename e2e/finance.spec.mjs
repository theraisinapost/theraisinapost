import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';

const codes = {growth:'NY.GDP.MKTP.KD.ZG',inflation:'FP.CPI.TOTL.ZG',manufacturing:'NV.IND.MANF.ZS',reserves:'FI.RES.TOTL.CD',cpi:'FP.CPI.TOTL'};
function fixture() {
  const record = rows => ({status:'available',retrieved_at:'2025-03-01T00:00:00Z',rows});
  return {schema:1,annual:Object.fromEntries(Object.entries(codes).map(([key,code]) => [key,{...record([{period:'2000',value:100},{period:'2010',value:120}]),code}])),
    oil:{brent:record([{period:'2020-04-20',value:20},{period:'2024-02-01',value:70},{period:'2024-03-01',value:80},{period:'2025-02-01',value:90}]),wti:record([{period:'2020-04-20',value:-36.98},{period:'2024-03-01',value:70},{period:'2025-02-01',value:80}])}};
}

test('annual economy cards keep their reference year and the inflation calculator uses actual index ratios', async ({page}) => {
  await page.route('**/data/finance.json',r=>r.fulfill({json:fixture()}));
  await page.goto('/india-data/');
  await expect(page.locator('#pulse-growth')).toContainText('Annual observation · 2010');
  await expect(page.locator('#pulse-status')).toContainText('not a live or monthly');
  await page.locator('#inflation-amount').fill('1000');
  await page.locator('#inflation-from').selectOption('2000');
  await page.locator('#inflation-to').selectOption('2010');
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await expect(page.locator('#inflation-equivalent')).toHaveText('₹1,200.00');
  await expect(page.locator('#inflation-change')).toHaveText('20%');
  await page.locator('#inflation-from').selectOption('2010');
  await page.locator('#inflation-to').selectOption('2000');
  await page.getByRole('button',{name:'Compare',exact:true}).click();
  await expect(page.locator('#inflation-equivalent')).toHaveText('—');
  await expect(page.locator('#inflation-result')).toContainText('on or after');
});

test('oil history switches benchmarks, retains negative prices and exports the selected range', async ({page}) => {
  await page.route('**/data/finance.json',r=>r.fulfill({json:fixture()}));
  await page.goto('/markets/');
  await expect(page.locator('#oil-history-period')).toContainText('Brent · observed 2025-02-01');
  await expect(page.locator('#oil-history-status')).toContainText('more than 10 days old');
  await page.locator('#oil-benchmark').selectOption('wti');
  await page.locator('#oil-range').selectOption('10');
  await expect(page.locator('#oil-history-chart polyline')).toHaveCount(1);
  const pendingDownload=page.waitForEvent('download');
  await page.locator('#oil-csv').click();
  const download=await pendingDownload;
  const text=await readFile(await download.path(),'utf8');
  expect(text).toContain('2020-04-20,wti,-36.98');
  expect(text).toContain('US EIA via datasets/oil-prices');
  await page.locator('#oil-range').selectOption('1');
  await expect(page.locator('#oil-history-rows tr')).toHaveCount(2);
});

test('missing source data leaves purchasing-power and historical oil tools unavailable', async ({page}) => {
  await page.route('**/data/finance.json',r=>r.fulfill({json:{schema:1,annual:{},oil:{}}}));
  await page.goto('/india-data/');
  await expect(page.locator('#inflation-calculate')).toBeDisabled();
  await expect(page.locator('#inflation-equivalent')).toHaveText('—');
  await expect(page.locator('#inflation-result')).toContainText('unavailable');
  await page.goto('/markets/');
  await expect(page.locator('#oil-csv')).toBeDisabled();
  await expect(page.locator('#oil-history-status')).toContainText('unavailable');
  await expect(page.locator('#oil-history-chart polyline')).toHaveCount(0);
});

for (const route of ['/india-data/','/markets/']) {
  test('finance tools stay accessible and fit a 320px screen at '+route, async ({page}) => {
    await page.route('**/data/finance.json',r=>r.fulfill({json:fixture()}));
    await page.setViewportSize({width:320,height:850});
    await page.goto(route);
    await expect(page.locator('details')).toHaveCount(0);
    await expect(page.locator('.finance-method > .bento-card')).toHaveCount(2);
    await expect(page.locator('.finance-results').first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    const result=await new AxeBuilder({page}).include('.finance-section').withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
    expect(result.violations.filter(x=>['serious','critical'].includes(x.impact))).toEqual([]);
  });
}
