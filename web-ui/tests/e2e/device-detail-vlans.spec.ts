import { test, expect } from '@playwright/test';

test('vlans tab loads', async ({ page }) => {
  await page.goto('/devices/10.0.0.1/vlans');
  await expect(page).toHaveURL(/\/vlans/);
});
