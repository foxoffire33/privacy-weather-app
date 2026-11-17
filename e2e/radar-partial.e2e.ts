import { expect, test } from '@playwright/test';

import { followParis, installApi } from './fixtures';

test('the radar tab degrades to a partial state when the land layer is missing', async ({ page }) => {
  await installApi(page, { frames: true });
  await followParis(page);
  await page.getByText('Radar', { exact: true }).first().click();
  await expect(page.getByText('Radar: LibreWXR').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /min ago/ }).first()).toBeVisible();
  await expect(page.getByText(/Could not refresh the radar\.|The weather request could not be completed\./).first()).toBeVisible();
});
