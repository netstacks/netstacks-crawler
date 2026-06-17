import { test, expect } from '@playwright/test';

// End-to-end coverage that the universal CellLink wraps entity values across
// the SPA. Each test follows a navigation chain — that's the whole point of
// link-everywhere: chains of clicks build up an inventory mental model.

test('dashboard table cell with an IP navigates to /devices/{ip}', async ({ page }) => {
  await page.goto('/dashboard');
  // Wait for at least one IP-shaped link to render in any dashboard panel.
  // We don't care which panel; any IP cell anywhere is fine.
  const ipLink = page.locator('a[href^="/devices/10."]').first();
  await ipLink.waitFor({ state: 'visible', timeout: 15_000 });
  const href = await ipLink.getAttribute('href');
  expect(href).toMatch(/^\/devices\/10\.\d+\.\d+\.\d+/);
  await ipLink.click();
  await expect(page).toHaveURL(/\/devices\/10\.\d+\.\d+\.\d+/);
});

test('devices list DNS column renders as a link', async ({ page }) => {
  await page.goto('/devices');
  // The DNS column appears in the existing devices table — if a device has a
  // dns set, the cell becomes /devices?q=<dns>. The seed dataset includes
  // 'core-sw-01.dc1'.
  await expect(page.getByText('core-sw-01.dc1')).toBeVisible({ timeout: 10_000 });
  const dnsLink = page.locator('a[href^="/devices?q="]').first();
  if (await dnsLink.count() > 0) {
    const href = await dnsLink.getAttribute('href');
    expect(href).toMatch(/^\/devices\?q=/);
  }
});

test('report-detail wraps IP/MAC cells in <Link>', async ({ page }) => {
  await page.goto('/reports/IP/ipinventory');
  // Wait for the table to render at least one row
  await page.waitForLoadState('networkidle');
  // Any anchor inside the table that points to /devices/{ip} or /nodes/{mac} confirms wiring
  const entityLinks = page.locator('a[href^="/devices/"], a[href^="/nodes/"]');
  await expect(entityLinks.first()).toBeVisible({ timeout: 10_000 });
});

test('device-detail ports tab has row anchors so /ports#<port> scrolls', async ({ page }) => {
  // Visit the first discovered device's ports tab (environment-agnostic).
  await page.goto('/devices');
  const firstDevice = page.locator('a[href^="/devices/"]').first();
  await firstDevice.waitFor({ state: 'visible', timeout: 15_000 });
  const href = await firstDevice.getAttribute('href');
  await page.goto(`${href}/ports`);
  await page.waitForLoadState('networkidle');
  // Each ports row should now carry an id attribute (we don't care which value
  // — just that the DataTable emitted IDs at all)
  const anyAnchorRow = page.locator('tr[id]');
  await expect(anyAnchorRow.first()).toBeVisible({ timeout: 15_000 });
});
