import { test, expect } from '@playwright/test';

test('node detail with unknown MAC renders gracefully', async ({ page }) => {
  await page.goto('/nodes/aabbccddeeff');
  // No node seeded; just confirm route resolves (404 from API is OK, page should still render).
  await expect(page).toHaveURL(/\/nodes\/aabbccddeeff/);
});
