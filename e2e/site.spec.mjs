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
