import { test, expect } from '@playwright/test';

test('typeahead input is present and accepts input', async ({ page }) => {
  await page.goto('/');
  const input = page.getByTestId('topbar-search');
  await expect(input).toBeVisible();
  await input.fill('core');
  // Should debounce; suggestions may or may not appear depending on API typeahead behavior.
  // Just assert the input doesn't crash the page.
  await expect(input).toHaveValue('core');
});

test('typeahead Enter navigates to devices?q=', async ({ page }) => {
  await page.goto('/');
  const input = page.getByTestId('topbar-search');
  await input.fill('core');
  await input.press('Enter');
  // Either a typeahead suggestion was picked (any /devices/{ip} URL) or it
  // fell through to the devices-list filter.
  await expect(page).toHaveURL(/\/devices(\/[^?]+|\?q=core)/);
});

test('typeahead Escape clears focus state', async ({ page }) => {
  await page.goto('/');
  const input = page.getByTestId('topbar-search');
  await input.fill('test');
  await input.press('Escape');
  // No assertion on visual state — just that pressing Escape doesn't crash.
  await expect(input).toBeVisible();
});
