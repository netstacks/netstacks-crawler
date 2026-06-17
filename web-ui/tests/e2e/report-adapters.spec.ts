import { test, expect } from '@playwright/test';

test('reports list has zero SP4-deferred items after M1', async ({ page }) => {
  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  const deferred = page.locator('[data-deferred="report-needs-sp4"]');
  await expect(deferred).toHaveCount(0);
});

test('a previously-deferred report (nodevendor) is now clickable', async ({ page }) => {
  await page.goto('/reports');
  await page.waitForLoadState('networkidle');
  const link = page.getByTestId('report-link-nodevendor');
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/reports\/Node\/nodevendor/);
});
