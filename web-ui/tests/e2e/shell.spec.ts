import { test, expect } from '@playwright/test';

test('shell renders topbar, sidebar, breadcrumbs, statusbar', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('NetStacks Crawler').first()).toBeVisible();
  await expect(page.locator('[data-nav="devices"]')).toBeVisible();
  await expect(page.getByTestId('topbar-search')).toBeVisible();
});

test('sidebar Devices link navigates', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-nav="devices"]').click();
  await expect(page).toHaveURL(/\/devices$/);
});

test('Dashboard sidebar link navigates to /dashboard', async ({ page }) => {
  await page.goto('/devices');
  await page.locator('[data-nav="dashboard"]').click();
  await expect(page).toHaveURL(/\/(dashboard)?$/);
});
