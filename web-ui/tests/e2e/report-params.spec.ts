import { test, expect } from '@playwright/test';

test('nodevendor renders param panel with vendor input', async ({ page }) => {
  await page.goto('/reports/Node/nodevendor');
  await expect(page.getByTestId('report-param-vendor')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('report-params-apply')).toBeVisible();
});

test('applying a param triggers a refetch (request includes vendor)', async ({ page }) => {
  let lastUrl: string | null = null;
  await page.route('**/api/report/Node/nodevendor*', async (route) => {
    lastUrl = route.request().url();
    await route.fulfill({ json: { rows: [] } });
  });
  await page.goto('/reports/Node/nodevendor');
  await page.getByTestId('report-param-vendor').fill('cisco');
  await page.getByTestId('report-params-apply').click();
  await expect.poll(() => lastUrl, { timeout: 5000 }).toMatch(/vendor=cisco/);
});

test('ipinventory and portlog also expose their param inputs', async ({ page }) => {
  await page.goto('/reports/IP/ipinventory');
  await expect(page.getByTestId('report-param-subnet')).toBeVisible({ timeout: 10_000 });
  await page.goto('/reports/Port/portlog');
  await expect(page.getByTestId('report-param-limit')).toBeVisible({ timeout: 10_000 });
});
