import { test, expect } from '@playwright/test';

test('toggle admin status posts portcontrol with field c_port', async ({ page }) => {
  let posted: Record<string, unknown> | null = null;
  await page.route('**/api/portcontrol', async (route) => {
    posted = await route.request().postDataJSON();
    await route.fulfill({ json: { job_id: 99 } });
  });
  await page.route('**/api/job/99', (r) => r.fulfill({ json: { job: 99, status: 'done' } }));
  await page.goto('/devices/10.0.0.1/ports');
  await page.getByTestId('row-actions-Gi1/0/1').click();
  await page.getByRole('menuitem', { name: /Toggle admin status/i }).click();
  await expect.poll(() => posted, { timeout: 5000 }).toMatchObject({
    device: '10.0.0.1',
    port: 'Gi1/0/1',
    field: 'c_port',
  });
});

test('view port log navigates to log tab with port filter', async ({ page }) => {
  await page.goto('/devices/10.0.0.1/ports');
  await page.getByTestId('row-actions-Gi1/0/1').click();
  await page.getByRole('menuitem', { name: /View port log/i }).click();
  await expect(page).toHaveURL(/\/log\?port=Gi1%2F0%2F1/);
});
