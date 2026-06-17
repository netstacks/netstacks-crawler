import { test, expect } from '@playwright/test';

test('modules tab loads', async ({ page }) => {
  await page.goto('/devices/10.0.0.1/modules');
  await expect(page).toHaveURL(/\/modules/);
});
