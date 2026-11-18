import { expect, test } from '@playwright/test';

import { followParis, installApi, weatherJson } from './fixtures';

test('the radar tab degrades to a partial state when the land layer is missing', async ({ page }) => {
  await installApi(page, { frames: true });
  await page.route('**/api.open-meteo.com/v1/forecast*', async (route) => {
    const url = route.request().url();
    const latitudes = new URL(url).searchParams.get('latitude')?.split(',') ?? [];
    if (latitudes.length === 1) { await route.fallback(); return; }
    const model: unknown = JSON.parse(weatherJson(url));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(Array.from({ length: latitudes.length }, () => model)) });
  });
  await followParis(page);
  await page.getByText('Radar', { exact: true }).first().click();
  await expect(page.getByText('Radar: LibreWXR').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /min ago/ }).first()).toBeVisible();
  await expect(page.getByText(/Could not refresh the radar\.|The weather request could not be completed\./).first()).toBeVisible();
});
