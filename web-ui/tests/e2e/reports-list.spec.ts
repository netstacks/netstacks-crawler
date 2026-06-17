import { test, expect } from '@playwright/test';

test('reports list page renders with grouped reports', async ({ page }) => {
  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  // At least one known report should appear
  await expect(page.getByTestId('report-link-portvlanmismatch')).toBeVisible({ timeout: 10_000 });
});

test('clicking a report link navigates to detail', async ({ page }) => {
  await page.goto('/reports');
  await page.getByTestId('report-link-portvlanmismatch').click();
  await expect(page).toHaveURL(/\/reports\/Port\/portvlanmismatch/);
});

test('sidebar Reports nav is active (not deferred)', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('[data-nav="reports"]');
  await expect(nav).toBeVisible();
  // Should NOT have an aria-disabled ancestor (the Deferred wrapper)
  const disabledAncestor = nav.locator('xpath=ancestor::*[@aria-disabled="true"]');
  await expect(disabledAncestor).toHaveCount(0);
});
