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

test('mobile full-screen navigation opens, closes and works across pages', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  const openButton=page.locator('[data-mobile-menu-open]');
  await expect(openButton).toBeVisible();
  await openButton.click();
  const menu=page.getByRole('dialog',{name:'Site navigation'});
  await expect(menu).toBeVisible();
  await expect(openButton).toHaveAttribute('aria-expanded','true');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(openButton).toHaveAttribute('aria-expanded','false');
  await openButton.click();
  await menu.getByRole('link',{name:'Markets',exact:true}).click();
  await expect(page).toHaveURL(/markets[.]html$/);
  await expect(page.locator('[data-mobile-menu-open]')).toBeVisible();
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
  await expect(page.getByRole('heading', { level: 1, name: /record matters/i })).toBeVisible();
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

test('the Observatory visualizes RSS metadata with clean article links', async ({ page }) => {
  await page.goto('/observatory.html');
  await expect(page.getByRole('heading', { name: 'The Observatory.' })).toBeVisible();
  await expect(page.locator('#obs-pulse rect').first()).toBeVisible();
  const first=page.locator('.obs-story').first();
  await expect(first).toBeVisible();
  await expect(first.locator('h3 a')).toHaveAttribute('href',/^https:\/\/raisinapost[.]substack[.]com\/p\//);
  await expect(page.locator('#obs-count')).not.toHaveText('—');
  await expect(page.locator('#obs-saved-count, #obs-saved-only, #obs-queue-list, #obs-random, .story-save')).toHaveCount(0);
  await page.locator('#obs-search').fill('no-story-should-ever-match-this-query');
  await expect(page.locator('#obs-status')).toContainText('0 stories');
  await page.locator('#obs-search').fill('');
  await expect(page.locator('.obs-story').first()).toBeVisible();
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

test('all seven pages have accessible Inter typography and a quiet grayscale design',async({page})=>{
  for(const route of ['/','/markets.html','/observatory.html','/about.html','/publication-guide.html','/ownership-atlas.html','/policy-timeline.html']){
    await page.goto(route,{waitUntil:'domcontentloaded'});
    await expect(page.locator('link[href="minimal.css"]')).toHaveCount(1);
    const style=await page.evaluate(()=>{
      const body=getComputedStyle(document.body);
      const heading=getComputedStyle(document.querySelector('h1'));
      return {bodyFont:body.fontFamily,headingFont:heading.fontFamily,ink:body.color,background:body.backgroundColor};
    });
    expect(style.bodyFont).toContain('Inter');
    expect(style.headingFont).toContain('Inter');
    expect(style.ink).toBe('rgb(23, 23, 23)');
    expect(style.background).toBe('rgb(255, 255, 255)');
  }
  await page.goto('/markets.html');
  const stats=await page.locator('.commodity-stat').first().evaluate(el=>({
    background:getComputedStyle(el).backgroundColor,
    radius:getComputedStyle(el).borderRadius
  }));
  expect(stats).toEqual({background:'rgb(249, 249, 249)',radius:'8px'});
  const fxBg=await page.locator('.fx-reference-card').first().evaluate(el=>getComputedStyle(el).backgroundColor);
  expect(fxBg).toBe('rgb(249, 249, 249)');
  const macroFont=await page.locator('#macro-gdp-value').evaluate(el=>getComputedStyle(el).fontFamily);
  expect(macroFont).toContain('Inter');
  await page.setViewportSize({width:390,height:844});
  await page.reload({waitUntil:'domcontentloaded'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
  await expect(page.locator('[data-mobile-menu-open]')).toBeVisible();
});

test('research desk publishes source-backed ownership and DPDP timeline', async ({page}) => {
  await page.goto('/ownership-atlas.html');
  await expect(page.getByRole('heading',{name:'Who owns TCS?'})).toBeVisible();
  await expect(page.locator('#owner-list .owner-row')).toHaveCount(5);
  await page.locator('[data-owner="lic"]').click();
  await expect(page.locator('#owner-value')).toHaveText('5.52%');
  await expect(page.locator('#owner-source')).toHaveAttribute('href',/tcs[.]com/);
  await page.goto('/policy-timeline.html');
  await expect(page.getByRole('heading',{name:/DPDP timeline/})).toBeVisible();
  await expect(page.locator('#policy-milestones li')).toHaveCount(6);
  await page.getByRole('button',{name:'Scheduled',exact:true}).click();
  await expect(page.locator('#policy-milestones li:visible')).toHaveCount(2);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
});

test('articles open canonical links without redundant read save or share controls', async ({page}) => {
  await page.goto('/');
  await expect(page.locator('.lead-story h2 a')).toHaveAttribute('href',/^https:\/\/raisinapost[.]substack[.]com\/p\//);
  await expect(page.locator('.lead-story .lead-visual')).toHaveAttribute('href',/^https:\/\/raisinapost[.]substack[.]com\/p\//);
  await expect(page.locator('.article-row').first().locator('h3 a')).toHaveAttribute('href',/^https:\/\/raisinapost[.]substack[.]com\/p\//);
  await expect(page.locator('.article-row').first().locator('.article-media')).toHaveAttribute('href',/^https:\/\/raisinapost[.]substack[.]com\/p\//);
  await expect(page.locator('.share-trigger, .story-save, .article-arrow, .lead-read')).toHaveCount(0);
});

test('commodities price cards show provider figures, dates and sourced units',async({page})=>{
  await page.route('https://xaus.com/api/v1/spot**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({xau:{price:8500,currency:'INR',unit:'gram'},silver_usd_oz:30,spot_usd_oz:3000,gold_silver_ratio:100,fx_rate:85,
      updated_at:'2026-10-31T06:00:00Z',data_state:{status:'fresh',as_of:'2026-10-31T06:00:00Z',age_seconds:0}})
  }));
  await page.route('https://api.frankfurter.dev/v2/rates**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify([{date:'2026-10-30',base:'INR',quote:'USD',rate:1/85},{date:'2026-10-30',base:'INR',quote:'EUR',rate:1/98},{date:'2026-10-30',base:'INR',quote:'GBP',rate:1/110}])
  }));
  await page.route('https://api.worldbank.org/**',r=>r.abort());
  await page.route('https://widgets.tradingview-widget.com/**',r=>r.abort());
  await page.route('https://s3.tradingview.com/**',r=>r.abort());
  await page.goto('/markets.html');
  await expect(page.locator('#spot-gold-value')).toHaveText('₹85,000');
  await expect(page.locator('#spot-silver-value')).toHaveText('₹81,984');
  await expect(page.locator('#spot-ratio-value')).toHaveText('100.00');
  await expect(page.locator('#spot-status')).toContainText('31 Oct 2026');
  await expect(page.locator('#fx-usd-value')).toHaveText('₹85.00');
  await expect(page.locator('#fx-eur-value')).toHaveText('₹98.00');
  await expect(page.locator('#fx-gbp-value')).toHaveText('₹110.00');
  await expect(page.locator('#fx-status')).toContainText('30 Oct 2026');
  await expect(page.locator('#commodity-benchmarks')).toBeVisible();
});

test('commodities never fabricate prices if sources fail or metal data is stale',async({page})=>{
  await page.route('https://xaus.com/api/v1/spot**',route=>route.fulfill({
    status:200,contentType:'application/json',
    body:JSON.stringify({xau:{price:8500,currency:'INR',unit:'gram'},silver_usd_oz:null,gold_silver_ratio:null,fx_rate:null,
      updated_at:'2026-10-01T06:00:00Z',data_state:{status:'stale',as_of:'2026-10-01T06:00:00Z',age_seconds:999999}})
  }));
  await page.route('https://api.frankfurter.dev/**',r=>r.abort());
  await page.route('https://api.worldbank.org/**',r=>r.abort());
  await page.route('https://widgets.tradingview-widget.com/**',r=>r.abort());
  await page.route('https://s3.tradingview.com/**',r=>r.abort());
  await page.goto('/markets.html');
  await expect(page.locator('#spot-status')).toContainText('Stale');
  await expect(page.locator('#spot-silver-value')).toHaveText('—');
  await expect(page.locator('#fx-usd-value')).toHaveText('—');
  await expect(page.locator('#fx-status')).toContainText('unavailable');
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
});

test('economic calendar loads only when a reader requests events',async({page})=>{
  await page.route('https://api.worldbank.org/**',r=>r.abort());
  await page.route('https://widgets.tradingview-widget.com/**',r=>r.abort());
  await page.route('https://s3.tradingview.com/**',r=>r.abort());
  await page.route('https://xaus.com/**',r=>r.abort());
  await page.route('https://api.frankfurter.dev/**',r=>r.abort());
  await page.goto('/markets.html');
  await expect(page.locator('#calendar-widget script')).toHaveCount(0);
  await page.locator('#calendar-load').click();
  await expect(page.locator('#calendar-widget script')).toHaveCount(1);
  await expect(page.locator('#calendar-load')).toHaveAttribute('disabled','');
});


test('policy monitor displays validated official entries and filters locally',async({page})=>{
  await page.route('**/data/regulatory.json', route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({
      checked_at:'2026-10-31T09:30:00Z',sources:{SEBI:'available',PIB:'available'},
      items:[
        {institution:'SEBI',title:'Official market circular',date:'2026-10-30',url:'https://www.sebi.gov.in/legal/circulars/test.html',summary:'Regulatory source'},
        {institution:'PIB',title:'Official release',date:'',url:'https://pib.gov.in/PressReleasePage.aspx?PRID=1',summary:'Press release'},
        {institution:'PIB',title:'Invalid',date:'2026-10-29',url:'javascript:alert(1)',summary:'Rejected'}
      ]
    })
  }));
  await page.goto('/policy-monitor.html');
  await expect(page.locator('.desk-record')).toHaveCount(2);
  await page.locator('#regulatory-source').selectOption('SEBI');
  await expect(page.locator('.desk-record')).toHaveCount(1);
  await expect(page.locator('.desk-record a')).toHaveAttribute('href',/sebi[.]gov[.]in/);
  await page.locator('#regulatory-search').fill('not-existing');
  await expect(page.locator('.desk-record')).toHaveCount(0);
});

test('India data shows sourced annual values and a labelled chart',async({page})=>{
  await page.route('https://api.worldbank.org/v2/country/ind/indicator/**', route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify([{page:1},[
      {date:'2025',value:6.75},{date:'2024',value:6.1},{date:'2023',value:null}
    ]])
  }));
  await page.goto('/india-data.html');
  await expect(page.locator('#india-latest-value')).toHaveText('6.75%');
  await expect(page.locator('#india-latest-year')).toContainText('2025');
  await expect(page.locator('#india-history-chart polyline')).toHaveCount(1);
  await expect(page.locator('#india-data-rows tr')).toHaveCount(2);
});

test('release calendar clearly labels scheduled dates rather than confirmed releases',async({page})=>{
  await page.goto('/release-calendar.html');
  await page.locator('#release-range').selectOption('all');
  await expect(page.locator('.desk-record')).not.toHaveCount(0);
  await expect(page.locator('.desk-record').first()).toContainText(/Scheduled date|Planned date passed/);
  await expect(page.locator('.desk-record').first().locator('a')).toHaveAttribute('href',/mospi[.]gov[.]in/);
});

test('document comparison stays local and escapes pasted HTML',async({page})=>{
  await page.goto('/document-diff.html');
  await page.locator('#diff-before').fill('Common line\\nOld requirement');
  await page.locator('#diff-after').fill('Common line\\n<img src=x onerror=alert(1)>');
  await page.locator('#diff-run').click();
  await expect(page.locator('.desk-diff-line.added')).toHaveCount(1);
  await expect(page.locator('.desk-diff-line.removed')).toHaveCount(1);
  await expect(page.locator('#diff-output img')).toHaveCount(0);
  await expect(page.locator('#diff-status')).toContainText('added lines');
  await page.locator('#diff-clear').click();
  await expect(page.locator('#diff-before')).toHaveValue('');
});


test('About page is a navigable editorial profile on desktop and mobile', async ({page}) => {
  await page.goto('/about.html');
  await expect(page.getByRole('heading', {level:1})).toContainText('The record matters');
  await expect(page.locator('.about-coverage article')).toHaveCount(3);
  await expect(page.locator('.about-principle')).toHaveCount(4);
  await expect(page.locator('.about-research-links a')).toHaveCount(4);
  await expect(page.getByRole('link', {name:'Subscribe on Substack'})).toHaveAttribute('href', 'https://raisinapost.substack.com/subscribe');
  await expect(page.locator('link[href="about.css"]')).toHaveCount(1);
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.about-hero h1')).toBeVisible();
  await expect(page.locator('.about-endnote')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
});


test('editorial policy mirrors published standards with direct source and mobile navigation', async ({page}) => {
  await page.goto('/editorial-policy.html');
  await expect(page.getByRole('heading', {level:1})).toContainText('Standards,');
  await expect(page.locator('.ed-chapter')).toHaveCount(8);
  await expect(page.locator('.ed-index a')).toHaveCount(8);
  await expect(page.getByRole('link', {name:'Read the canonical policy'}))
    .toHaveAttribute('href','https://raisinapost.substack.com/p/editorial-policy');
  await page.locator('.ed-index a[href="#conflicts"]').click();
  await expect(page.locator('#conflicts')).toBeVisible();
  await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.ed-hero h1')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
});

test('corrections desk provides real editorial address without fake forms', async ({page}) => {
  await page.goto('/corrections.html');
  await expect(page.getByRole('heading', {level:1})).toContainText('Keep the record');
  await expect(page.getByRole('link',{name:'raisinapost@substack.com'})).toHaveAttribute('href','mailto:raisinapost@substack.com');
  await expect(page.locator('form')).toHaveCount(0);
  await expect(page.locator('.ed-contact-list li')).toHaveCount(4);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(392);
});
