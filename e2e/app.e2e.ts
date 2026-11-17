import { expect, test } from '@playwright/test';

import { followParis, installApi } from './fixtures';

test('cold boot walks onboarding into a followed city and the city survives a reload', async ({ page }) => {
  await installApi(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Choose your first city' })).toBeVisible();
  await followParis(page);
  await expect(page.locator('.hero-temp')).toHaveText('13°');
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Choose your first city' })).toHaveCount(0);
  await expect(page.getByText('Paris').first()).toBeVisible();
});
