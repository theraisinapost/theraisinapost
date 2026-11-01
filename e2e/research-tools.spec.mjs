import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('country comparisons use one year and export its provenance',async({page})=>{
 await page.goto('/country-desk/');
 await expect(page.locator('.country-card')).toHaveCount(6);
 await expect(page.locator('#country-status')).toContainText('6 of 6');
 const year=await page.locator('#country-year').inputValue();
 for(const p of await page.locator('.country-card p').allTextContents())expect(p).toContain(year);
 await page.locator('#country-indicator').selectOption('income');
 await expect(page.locator('#country-caption')).toContainText('GDP per person');
 const download=page.waitForEvent('download');await page.locator('#country-export').click();expect((await download).suggestedFilename()).toBe('raisina-country-comparison.csv');
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
test('document search supports deep links, types, typos and empty results',async({page})=>{
 await page.goto('/document-library/?kind=Company+filing');
 await expect(page.locator('.document-card')).toHaveCount(20);
 await expect(page.locator('#library-more')).toBeVisible();
 await page.locator('#library-kind').selectOption('');
 await page.locator('#library-search').fill('Unilveer');
 await expect(page.locator('.document-card')).toHaveCount(1);
 await expect(page.locator('.document-card')).toContainText('Unilever');
 await page.locator('#library-search').fill('zzzzzzz999999');
 await expect(page.locator('#library-status')).toContainText('No documents');
 await page.locator('#library-search').fill('petroleum');
 await expect(page.locator('.document-card').first()).toBeVisible();
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});
test('research pages recover from unavailable data',async({page})=>{
 await page.route('**/data/countries.json',route=>route.abort());
 await page.goto('/country-desk/');
 await expect(page.locator('#country-status')).toContainText('unavailable');
 await page.route('**/data/document-library.json',route=>route.abort());
 await page.goto('/document-library/');
 await expect(page.locator('#library-status')).toContainText('unavailable');
});
test('document library remains usable without the search library',async({page})=>{
 await page.route('**/vendor/minisearch.min.js',route=>route.abort());
 await page.setViewportSize({width:390,height:844});
 await page.goto('/document-library/?q=Unilever');
 await expect(page.locator('.document-card')).toHaveCount(1);
 await expect(page.locator('.document-card')).toContainText('Unilever');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
});
