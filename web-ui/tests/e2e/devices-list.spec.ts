import { test, expect } from '@playwright/test';

test('devices list shows fixture device', async ({ page }) => {
  await page.goto('/devices');
  await expect(page.getByRole('cell', { name: 'core-sw-01', exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('10.0.0.1')).toBeVisible();
});

test('filter input filters table', async ({ page }) => {
  await page.goto('/devices');
  await page.getByTestId('devices-filter').fill('core');
  await expect(page.getByRole('cell', { name: 'core-sw-01', exact: true })).toBeVisible();
});

test('row click navigates to device detail', async ({ page }) => {
  await page.goto('/devices');
  await page.getByRole('cell', { name: 'core-sw-01', exact: true }).click();
  await expect(page).toHaveURL(/\/devices\/10\.0\.0\.1/);
});

test('page size selector + pagination controls visible', async ({ page }) => {
  await page.goto('/devices');
  await expect(page.getByTestId('devices-page-size')).toBeVisible();
  await expect(page.getByTestId('page-prev')).toBeVisible();
  await expect(page.getByTestId('page-next')).toBeVisible();
});

test('export CSV link present', async ({ page }) => {
  await page.goto('/devices');
  await expect(page.getByTestId('devices-export-csv')).toBeVisible();
});

test('Add device button opens dialog', async ({ page }) => {
  await page.goto('/devices');
  await page.getByTestId('add-device-trigger').first().click();
  await expect(page.getByTestId('add-device-ip')).toBeVisible();
});
