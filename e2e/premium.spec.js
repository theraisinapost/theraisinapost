import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('desk remembers focus and density, resets, and exports a calendar', async ({page}) => {
 await page.goto('/desk/');
 await expect(page.locator('.briefing-item').first()).toBeVisible();
 await page.getByLabel('Policy', {exact:true}).uncheck();
 await page.getByLabel('Reading view').selectOption('compact');
 await page.reload();
 await expect(page.getByLabel('Policy',{exact:true})).not.toBeChecked();
 await expect(page.locator('[data-topic="policy"]')).toBeHidden();
 await expect(page.locator('.premium-desk')).toHaveAttribute('data-density','compact');
 const downloadPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:'Download calendar'}).click();
 expect((await downloadPromise).suggestedFilename()).toBe('raisina-release-calendar.ics');
 await page.getByRole('button',{name:'Reset desk'}).click();
 await expect(page.getByLabel('Policy',{exact:true})).toBeChecked();
});
test('desk handles failed feeds',async({page})=>{
 await page.route('**/posts.json',route=>route.abort());
 await page.goto('/desk/');
 await expect(page.getByText('The briefing could not load.',{exact:false})).toBeVisible();
 await expect(page.getByRole('link',{name:'Open the latest editions'})).toBeVisible();
});
for(const path of ['desk/','membership/']) test(`${path} accessibility and narrow layout`,async({page})=>{
 await page.goto('/'+path);
 if(path==='desk/') await expect(page.locator('.briefing-item').first()).toBeVisible();
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.setViewportSize({width:320,height:800});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBeTruthy();
});
