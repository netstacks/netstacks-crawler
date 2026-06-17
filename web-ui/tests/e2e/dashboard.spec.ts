import { test, expect } from '@playwright/test';

test('dashboard renders default 6 panels', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  // Six default panel ids are p1..p6
  for (const id of ['p1','p2','p3','p4','p5','p6']) {
    await expect(page.getByTestId(`panel-${id}`)).toBeVisible({ timeout: 10_000 });
  }
});

test('edit toggle reveals Save / Add panel / Reset buttons', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('dashboard-edit-toggle').click();
  await expect(page.getByTestId('dashboard-save')).toBeVisible();
  await expect(page.getByTestId('dashboard-add-panel')).toBeVisible();
  await expect(page.getByTestId('dashboard-reset')).toBeVisible();
});

test('add-panel dialog opens and lets you pick a type + source', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('dashboard-edit-toggle').click();
  await page.getByTestId('dashboard-add-panel').click();
  await expect(page.getByTestId('add-panel-title')).toBeVisible();
  await page.getByTestId('add-panel-title').fill('My test panel');
  await page.getByTestId('add-panel-cancel').click();
  await expect(page.getByTestId('add-panel-title')).not.toBeVisible();
});

test('Search page renders results (SP6 search-anything)', async ({ page }) => {
  await page.goto('/search?q=10');
  // The route exists now — it must NOT fall through to the SPA not-found state.
  await expect(page.getByText('Not found', { exact: false })).toHaveCount(0);
  // Shows a result count or the searching state for the query.
  await expect(page.getByText(/results? for|Searching/i).first()).toBeVisible({ timeout: 10_000 });
});

test('Add Panel Advanced mode accepts a custom endpoint', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('dashboard-edit-toggle').click();
  await page.getByTestId('dashboard-add-panel').click();
  await page.getByTestId('add-panel-advanced-toggle').click();
  await expect(page.getByTestId('add-panel-advanced-input')).toBeVisible();
  await page.getByTestId('add-panel-advanced-input').fill('/api/v2/devices');
  await page.getByTestId('add-panel-title').fill('My custom devices panel');
  // Sanity check: the create button is enabled (custom path is allowed)
  await expect(page.getByTestId('add-panel-create')).toBeEnabled();
});
