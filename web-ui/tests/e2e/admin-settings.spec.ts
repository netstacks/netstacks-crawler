import { test, expect } from '@playwright/test';

test('snmp settings page shows defaults and devauth section', async ({ page }) => {
  await page.goto('/admin/snmp');
  await expect(page.getByText('Default SNMP communities')).toBeVisible();
  await expect(page.getByText('Per-device auth overrides')).toBeVisible();
  await expect(page.getByTestId('device-auth-add-toggle')).toBeVisible();
});

test('schedules page lists schedule entries', async ({ page }) => {
  await page.route('**/api/admin/schedule', async (route) => {
    await route.fulfill({
      json: {
        schedule: {
          discoverall: { when: '0 4 * * *', enabled: 1 },
          macwalk:     { when: null,        enabled: 1 },
        },
      },
    });
  });
  await page.goto('/admin/schedules');
  await expect(page.getByTestId('schedule-row-discoverall')).toBeVisible();
  await expect(page.getByTestId('schedule-when-discoverall')).toHaveValue('0 4 * * *');
});
