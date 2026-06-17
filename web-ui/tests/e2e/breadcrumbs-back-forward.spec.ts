import { test, expect } from '@playwright/test';

test('breadcrumbs reflect path and link to parents', async ({ page }) => {
  await page.goto('/devices/10.0.0.1/ports');
  await expect(page.getByRole('link', { name: 'devices', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'devices', exact: true }).click();
  await expect(page).toHaveURL(/\/devices$/);
});

test('browser back returns to previous route', async ({ page }) => {
  await page.goto('/devices');
  await page.goto('/devices/10.0.0.1');
  await page.goBack();
  await expect(page).toHaveURL(/\/devices$/);
});
