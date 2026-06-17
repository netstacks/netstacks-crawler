import { test, expect } from '@playwright/test';

test('ports tab shows all 8 fixture ports', async ({ page }) => {
  await page.goto('/devices/10.0.0.1/ports');
  for (const p of ['Gi1/0/1','Gi1/0/2','Gi1/0/3','Gi1/0/4','Gi1/0/5','Gi1/0/6','Gi1/0/7','Gi1/0/8']) {
    await expect(page.getByText(p, { exact: true })).toBeVisible();
  }
});

test('row actions menu opens', async ({ page }) => {
  await page.goto('/devices/10.0.0.1/ports');
  await page.getByTestId('row-actions-Gi1/0/1').click();
  await expect(page.getByRole('menuitem', { name: /Rename port description/i })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Toggle admin status/i })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Change VLAN/i })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Cycle PoE/i })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /View port log/i })).toBeVisible();
});
