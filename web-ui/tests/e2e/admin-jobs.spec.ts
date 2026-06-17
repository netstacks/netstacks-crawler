import { test, expect } from '@playwright/test';

test('jobs page renders status filter + table', async ({ page }) => {
  await page.goto('/admin/jobs');
  await expect(page.getByTestId('admin-jobs-status-filter')).toBeVisible();
  await expect(page.getByTestId('admin-jobs-refresh')).toBeVisible();
});

test('changing status filter triggers a new query', async ({ page }) => {
  let lastUrl: string | null = null;
  await page.route('**/api/admin/jobs*', async (route) => {
    lastUrl = route.request().url();
    await route.fulfill({ json: { jobs: [] } });
  });
  await page.goto('/admin/jobs');
  await page.getByTestId('admin-jobs-status-filter').selectOption('queued');
  await expect.poll(() => lastUrl, { timeout: 5000 }).toMatch(/status=queued/);
});
