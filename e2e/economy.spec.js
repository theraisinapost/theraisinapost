import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
test('economic record changes units, range and exports source-backed observations',async({page})=>{
 await page.goto('/desk.html#economic-record');
 await expect(page.locator('#economy-status')).toContainText('16 of 16 series available');
 await expect(page.locator('#economy-series option')).toHaveCount(16);
 await expect(page.locator('#economy-unit')).toHaveText('US$');
 await page.locator('#economy-series').selectOption('unemployment');
 await expect(page.locator('#economy-unit')).toHaveText('% of labour force');
 await expect(page.locator('#economy-context')).toContainText('Modelled ILO');
 await page.locator('#economy-range').selectOption('all');
 expect(await page.locator('#economy-rows tr').count()).toBeGreaterThan(20);
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download CSV',exact:true}).click();
 const download=await pending;const csv=await readFile(await download.path(),'utf8');
 expect(csv).toContain('SL.UEM.TOTL.ZS');expect(csv).toContain('https://data.worldbank.org/indicator/');expect(csv).toContain('retrieved_at');
});
test('economic record preserves missing years and retained-data status',async({page})=>{
 await page.route('**/data/finance.json',route=>route.fulfill({json:{schema:1,annual:{gdp:{code:'NY.GDP.MKTP.CD',label:'GDP at current prices',unit:'US$',status:'retained',retrieved_at:'2025-01-01T00:00:00Z',rows:[{period:'2020',value:100},{period:'2022',value:120},{period:'2023',value:110}]}}}}));
 await page.goto('/desk.html#economic-record');
 await expect(page.locator('#economy-status')).toContainText('Latest refresh failed');
 await expect(page.locator('#economy-rows tr')).toHaveCount(3);
 const path=await page.locator('#economy-chart path').getAttribute('d');expect(path.match(/M/g)).toHaveLength(2);
});
test('economic record has an honest unavailable state',async({page})=>{
 await page.route('**/data/finance.json',route=>route.abort());await page.goto('/desk.html#economic-record');
 await expect(page.locator('#economy-status')).toContainText('Economic snapshot unavailable');
 await expect(page.locator('#economy-download')).toBeDisabled();
});
