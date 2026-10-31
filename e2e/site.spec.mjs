import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('the home page retains the official sections, masthead and accessible navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Primary navigation' });
  for (const name of ['Home', 'The Power Brief', 'Business', 'Governance', 'Editorial policy', 'About']) {
    await expect(nav.getByRole('link', { name, exact: true })).toHaveCount(1);
  }
  for (const removed of ['Sunday Insights', 'Records Review']) {
    await expect(nav.getByRole('link', { name: removed })).toHaveCount(0);
  }
  await expect(page.getByRole('link', { name: 'The Raisina Post home' }).first()).toBeVisible();
  await expect(page.locator('.article-row').first()).toBeVisible();
  await expect(page.locator('#article-search')).toBeVisible();
});

test('search and section filters work on the generated RSS archive', async ({ page }) => {
  await page.goto('/');
  const rows = page.locator('.article-row');
  const initial = await rows.count();
  expect(initial).toBeGreaterThan(0);

  await page.locator('#article-search').fill('a phrase unlikely to exist 039172');
  await expect(page.locator('.article-row:visible')).toHaveCount(0);
  await expect(page.getByText('No results')).toBeVisible();
  await page.getByRole('button', { name: 'Clear search and filters' }).click();
  await expect(page.locator('.article-row:visible')).toHaveCount(initial);

  await page.getByRole('button', { name: 'The Power Brief', exact: true }).click();
  await expect(page.getByRole('button', { name: 'The Power Brief', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const shown = await page.locator('.article-row:visible').count();
  expect(shown).toBeGreaterThan(0);
  expect(shown).toBeLessThanOrEqual(initial);
});

test('the IST analog clock and New Delhi weather show verified UI states', async ({ page }) => {
  await page.route('https://api.open-meteo.com/**', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ current: { temperature_2m: 27.4, weather_code: 0, is_day: 1 } })
  }));
  await page.goto('/');
  await expect(page.locator('#analog-clock')).toBeVisible();
  await expect(page.locator('.dial-mark')).toHaveCount(60);
  await expect(page.locator('#digital-clock')).toContainText('IST');
  await expect(page.locator('#weather-emoji')).toHaveText('☀️');
  await expect(page.locator('#new-delhi-weather')).toContainText('27°C');
});

test('mobile layout keeps article navigation and input usable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('#article-search')).toBeVisible();
  await expect(page.locator('#analog-clock')).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(392);
  await page.getByRole('link', { name: 'About', exact: true }).first().click();
  await expect(page).toHaveURL(/about\.html$/);
  await expect(page.getByRole('heading', { name: /India.s decisions/i })).toBeVisible();
});

for (const path of ['/', '/about.html', '/publication-guide.html']) {
  test('WCAG A/AA serious and critical accessibility violations: ' + path, async ({ page }) => {
    await page.goto(path);
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const blocking = result.violations
      .filter(violation => ['serious', 'critical'].includes(violation.impact))
      .map(({ id, impact, description, nodes }) => ({
        id, impact, description, selectors: nodes.map(node => node.target)
      }));
    expect(blocking).toEqual([]);
  });
}

test('command palette searches the real RSS index and supports keyboard invocation', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Control+k');
  await expect(page.locator('#story-palette')).toBeVisible();
  await page.locator('#palette-query').fill('India');
  await expect(page.locator('#palette-results a').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#story-palette')).not.toBeVisible();
});

test('the Observatory visualizes real RSS metadata and saves locally without a login', async ({ page }) => {
  await page.goto('/observatory.html');
  await expect(page.getByRole('heading', { name: 'The Observatory.' })).toBeVisible();
  await expect(page.locator('#obs-pulse rect').first()).toBeVisible();
  await expect(page.locator('.obs-story').first()).toBeVisible();
  await expect(page.locator('#obs-count')).not.toHaveText('—');
  const first = page.locator('.obs-story').first();
  await first.locator('[data-save-story]').click();
  await expect(page.locator('#obs-saved-count')).toHaveText('1');
  await expect(page.locator('.obs-queue-item')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('#obs-saved-count')).toHaveText('1');
  await page.locator('#obs-saved-only').click();
  await expect(page.locator('.obs-story')).toHaveCount(1);
  await page.locator('.obs-queue-item [data-queue-remove]').click();
  await expect(page.locator('#obs-saved-count')).toHaveText('0');
  await expect(page.locator('.obs-queue-item')).toHaveCount(0);
});

test('the Observatory remains accessible and has no mobile horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/observatory.html');
  await expect(page.locator('#obs-story-list .obs-story').first()).toBeVisible();
  const width = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(392);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  expect(result.violations.filter(v => ['serious','critical'].includes(v.impact)).map(v=>v.id)).toEqual([]);
});


test('markets page has attributed quotes and correctly-year-labelled World Bank data',async ({page})=>{
  await page.route('https://widgets.tradingview-widget.com/**',r=>r.abort());
  await page.route('https://s3.tradingview.com/**',r=>r.abort());
  await page.route('https://api.worldbank.org/**',r=>{
    const u=r.request().url();
    let value= u.includes('NY.GDP.MKTP.KD.ZG')?6.5:u.includes('FP.CPI.TOTL.ZG')?4.2:20.4;
    const data=[{date:'2024',value,countryiso3code:'IND'},{date:'2023',value:value+1,countryiso3code:'IND'}];
    r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{},data])});
  });
  await page.goto('/markets.html');
  await expect(page.getByRole('heading',{name:/Markets & economy/})).toBeVisible();
  await expect(page.locator('#macro-gdp-value')).toContainText('6.50%');
  await expect(page.locator('#macro-inflation-value')).toContainText('4.20%');
  await expect(page.locator('#macro-gdp-date')).toContainText('Reference year 2024');
  await page.locator('[data-macro="inflation"]').click();
  await expect(page.locator('#macro-source')).toHaveAttribute('href',/FP.CPI.TOTL.ZG/);
  await expect(page.locator('[data-macro="inflation"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.market-intro-meta')).toContainText('QUOTES MAY BE DELAYED');
});
test('markets page reports unavailable annual data without imaginary numbers',async ({page})=>{
  await page.route('https://widgets.tradingview-widget.com/**',r=>r.abort());
  await page.route('https://s3.tradingview.com/**',r=>r.abort());
  await page.route('https://api.worldbank.org/**',r=>r.abort());
  await page.goto('/markets.html');
  await expect(page.locator('#macro-gdp-date')).toHaveText('Data unavailable');
  await expect(page.locator('#macro-gdp-value')).toHaveText('—');
  await expect(page.locator('#macro-status')).toContainText('unavailable');
});

test('minimal editorial typography and fewer rules are applied on all five pages',async ({page})=>{
  for(const path of ['/','/markets.html','/observatory.html','/about.html','/publication-guide.html']){
    await page.goto(path,{waitUntil:'domcontentloaded'});
    await expect(page.locator('link[href="editorial.css"]')).toHaveCount(1);
    const fonts=await page.evaluate(()=>getComputedStyle(document.body).fontFamily);
    expect(fonts).toContain('Inter');
    const line=page.locator('.section-bar, .obs-section-title').first();
    if(await line.count()){
      const border=await line.evaluate(el=>getComputedStyle(el).borderTopStyle);
      expect(border).toBe('none');
    }
  }
  await page.goto('/markets.html',{waitUntil:'domcontentloaded'});
  const panelBorder=await page.locator('.market-panel').first().evaluate(el=>getComputedStyle(el).borderTopStyle);
  expect(panelBorder).toBe('none');
  await page.setViewportSize({width:390,height:844});
  await page.reload({waitUntil:'domcontentloaded'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
});
