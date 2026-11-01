import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('terminal links company selection to holdings and original filings',async({page})=>{
 await page.goto('/terminal/?company=hul');
 await expect(page.locator('#company-name')).toHaveText('Hindustan Unilever');
 await expect(page.locator('#terminal-documents')).toContainText('Hindustan Unilever');
 await expect(page.locator('#terminal-holdings')).toContainText('47.43%');
 await page.locator('#terminal-company').selectOption('reliance');
 await expect(page.locator('#company-record-date')).toContainText('Aggregate categories');
 await expect(page.locator('#terminal-documents')).toContainText('Reliance Industries');
 await expect(page.locator('#company-original')).toHaveAttribute('href',/rilstaticasset/);
 await page.locator('#terminal-indicator').selectOption('brent');
 await expect(page.locator('#macro-label')).toContainText('Global reference / Brent');
 await expect(page.locator('#terminal-country')).toBeDisabled();
 await expect(page.locator('#macro-table tbody tr')).toHaveCount(5);
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});
test('command search is keyboard accessible and updates the relevant panels',async({page})=>{
 await page.goto('/terminal/');await expect(page.locator('#terminal-company')).toBeEnabled();
 await page.keyboard.press('Control+k');
 await expect(page.locator('#terminal-command-dialog')).toBeVisible();
 await page.locator('#terminal-command-input').fill('Hindustan Unilever');
 await page.locator('#terminal-command-input').press('Enter');
 await expect(page.locator('#terminal-command-dialog')).not.toBeVisible();
 await expect(page.locator('#company-name')).toHaveText('Hindustan Unilever');
 await page.locator('#terminal-command').click();await page.locator('#terminal-command-input').fill('data protection');
 await page.locator('#terminal-command-input').press('Enter');
 await expect(page.locator('#evidence-mode')).toHaveValue('policy');
 await expect(page.locator('#evidence-query')).toHaveValue('data protection');
 await expect(page.locator('#terminal-documents')).toContainText('DPDP');
 await page.locator('#terminal-command').click();await page.keyboard.press('Escape');
 await expect(page.locator('#terminal-command-dialog')).not.toBeVisible();
});
test('watchlists and workspace settings survive reload and remain isolated',async({page})=>{
 await page.goto('/terminal/');await expect(page.locator('#terminal-company')).toBeEnabled();
 await page.locator('#terminal-company').selectOption('hul');await page.locator('#terminal-follow').click();
 await page.locator('#terminal-workspace').selectOption('company');await page.locator('#terminal-company').selectOption('reliance');
 await page.locator('#terminal-indicator').selectOption('inflation');
 await page.reload();await expect(page.locator('#company-name')).toHaveText('Reliance Industries');
 await expect(page.locator('#terminal-indicator')).toHaveValue('inflation');
 await expect(page.locator('#terminal-watchlist')).toContainText('HUL');
 await page.locator('#terminal-workspace').selectOption('overview');
 await expect(page.locator('#company-name')).toHaveText('Hindustan Unilever');
 await expect(page.locator('#terminal-indicator')).toHaveValue('growth');
 await page.locator('#terminal-reset').click();await expect(page.locator('#company-name')).toHaveText('Tata Consultancy Services');
 await expect(page.locator('#terminal-watchlist')).toContainText('HUL');
});
test('panel order can be changed by keyboard controls and retained',async({page})=>{
 await page.goto('/terminal/');await expect(page.locator('#terminal-company')).toBeEnabled();
 await page.locator('#terminal-arrange').click();
 await page.getByRole('button',{name:'Move original evidence earlier',exact:true}).click();
 await expect(page.locator('#terminal-grid > section').first()).toHaveAttribute('gs-id','evidence');
 await page.reload();await expect(page.locator('#terminal-company')).toBeEnabled();
 await expect(page.locator('#terminal-grid > section').first()).toHaveAttribute('gs-id','evidence');
});
test('terminal handles failed data, unavailable libraries and storage on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.route('**/vendor/gridstack-all.js',r=>r.abort());
 await page.route('**/vendor/lightweight-charts.js',r=>r.abort());
 await page.route('**/data/document-library.json',r=>r.abort());
 await page.addInitScript(()=>{Object.defineProperty(Storage.prototype,'setItem',{value(){throw new Error('blocked');}});});
 await page.goto('/terminal/?company=hul');await expect(page.locator('#company-name')).toHaveText('Hindustan Unilever');
 await expect(page.locator('#terminal-status')).toContainText('datasets unavailable');
 await expect(page.locator('#chart-fallback')).toBeVisible();
 await page.locator('#terminal-follow').click();await expect(page.locator('#terminal-save-status')).toContainText('storage unavailable');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});
test('terminal recovers from corrupted stored layout on mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>localStorage.setItem('raisina-terminal-v1',JSON.stringify({active:'overview',workspaces:{overview:{company:'unknown',layout:[{id:'injected',content:'<script>bad</script>'}]}}})));
 await page.goto('/terminal/');await expect(page.locator('#company-name')).toHaveText('Tata Consultancy Services');
 await expect(page.locator('#terminal-grid > section')).toHaveCount(6);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});
