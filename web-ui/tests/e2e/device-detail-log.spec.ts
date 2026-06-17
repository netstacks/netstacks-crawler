import { test, expect } from '@playwright/test';

test('log tab loads', async ({ page }) => {
  await page.goto('/devices/10.0.0.1/log');
  await expect(page).toHaveURL(/\/log/);
});

test('log tab honors ?port= filter param', async ({ page }) => {
  await page.goto('/devices/10.0.0.1/log?port=Gi1/0/1');
  await expect(page).toHaveURL(/\?port=Gi1\/0\/1/);
});
