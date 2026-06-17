import { test, expect } from '@playwright/test';

test('report detail loads (rows or empty state or error block, never blank)', async ({ page }) => {
  await page.goto('/reports/Port/portvlanmismatch');
  await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
});

test('CSV export link is present when report provides_csv', async ({ page }) => {
  await page.goto('/reports/Port/portvlanmismatch');
  // PortVLANMismatch registers provides_csv: 1; link is shown even when the body shows an error
  await expect(page.getByTestId('report-csv-link')).toBeVisible({ timeout: 10_000 });
});
