import { test, expect } from '@playwright/test';

test('admin actions page lists global jobs', async ({ page }) => {
  await page.goto('/admin/actions');
  await expect(page.getByTestId('admin-action-run-discoverall')).toBeVisible();
  await expect(page.getByTestId('admin-action-run-macwalk')).toBeVisible();
  await expect(page.getByTestId('admin-action-run-arpwalk')).toBeVisible();
  await expect(page.getByTestId('admin-action-run-expire')).toBeVisible();
});

test('clicking Discover all queues a job', async ({ page }) => {
  let lastPost: string | null = null;
  await page.route('**/api/job', async (route) => {
    if (route.request().method() === 'POST') {
      lastPost = route.request().postData();
      await route.fulfill({ json: { job_id: 9999 } });
    } else {
      await route.continue();
    }
  });
  await page.goto('/admin/actions');
  await page.getByTestId('admin-action-run-discoverall').click();
  await expect.poll(() => lastPost, { timeout: 5000 }).toContain('discoverall');
  await expect(page.getByText(/Queued job #9999/)).toBeVisible();
});

test('pingsweep action exposes a target input and includes it in POST', async ({ page }) => {
  let lastPost: string | null = null;
  await page.route('**/api/job', async (route) => {
    if (route.request().method() === 'POST') {
      lastPost = route.request().postData();
      await route.fulfill({ json: { job_id: 9999 } });
    } else await route.continue();
  });
  await page.goto('/admin/actions');
  await page.getByTestId('admin-action-input-pingsweep-device').fill('10.0.0.0/30');
  await page.getByTestId('admin-action-run-pingsweep').click();
  await expect.poll(() => lastPost).toContain('10.0.0.0/30');
  await expect.poll(() => lastPost).toContain('pingsweep');
});
