import { test, expect } from '@playwright/test';
import { DEFERRED_INVENTORY } from '../../src/components/common/deferred-inventory';

// Each deferred surface should still render (so users know the feature is
// coming) AND be wrapped in a Deferred component that sets aria-disabled.
// The visible milestone badge was removed in SP4 polish — the tooltip + the
// data-deferred attribute remain.
test('every deferred element renders + is aria-disabled', async ({ page }) => {
  for (const entry of DEFERRED_INVENTORY) {
    const route = entry.route || '/';
    await page.goto(route);
    await page.waitForLoadState('networkidle');

    const el = page.locator(entry.selector).first();
    await expect(el, `${entry.selector} should exist on ${route}`).toBeVisible();

    const wrapper = el.locator('xpath=ancestor-or-self::*[@aria-disabled="true"]').first();
    await expect(wrapper, `${entry.selector} should be wrapped in Deferred (aria-disabled)`).toBeAttached();
  }
});
