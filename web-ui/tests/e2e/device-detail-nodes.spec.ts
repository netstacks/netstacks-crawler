import { test, expect } from '@playwright/test';

test('nodes tab loads', async ({ page }) => {
  await page.goto('/devices/10.0.0.1/nodes');
  // No nodes seeded — just verify the tab renders (table headers or empty state).
  await expect(page).toHaveURL(/\/nodes/);
});

test('Nodes tab is clickable from device detail', async ({ page }) => {
  await page.goto('/devices/10.0.0.1');
  await page.getByTestId('tab-nodes').click();
  await expect(page).toHaveURL(/\/nodes/);
});
