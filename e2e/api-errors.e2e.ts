import { expect, test } from '@playwright/test';

import { followParis, geoBody, installApi, weatherJson } from './fixtures';

test('a 429 with Retry-After is honored before the retry succeeds', async ({ page }) => {
  const startedAt: number[] = [];
  let rateLimited = false;
  await installApi(page);
  await page.route('**/api.open-meteo.com/v1/forecast*', async (route) => {
    const url = route.request().url();
    if (url.includes('current=')) {
      startedAt.push(Date.now());
      if (!rateLimited) {
        rateLimited = true;
        await route.fulfill({
          status: 429,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-expose-headers': 'retry-after',
            'content-type': 'application/json',
            'retry-after': '1',
          },
          body: '{}',
        });
        return;
      }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: weatherJson(url) });
  });
  await followParis(page);
  await expect(page.locator('.hero-temp')).toHaveText('13°');
  expect(startedAt.length).toBeGreaterThanOrEqual(2);
  expect(startedAt[1] - startedAt[0]).toBeGreaterThanOrEqual(900);
});

test('a persistent 429 ends in the rate-limit message', async ({ page }) => {
  await installApi(page);
  await page.route('**/api.open-meteo.com/v1/forecast*', async (route) => {
    await route.fulfill({ status: 429, headers: { 'content-type': 'application/json' }, body: '{}' });
  });
  await followParis(page);
  await expect(page.getByText('The weather service is temporarily rate-limited. The app retries automatically.')).toBeVisible();
});

test('a superseded search aborts the in-flight request', async ({ page }) => {
  const failures: string[] = [];
  await installApi(page);
  await page.route('**/geocoding-api.open-meteo.com/**', async (route) => {
    await new Promise((resolve) => { setTimeout(resolve, 1500); });
    await route.fulfill({ status: 200, contentType: 'application/json', body: geoBody() });
  });
  page.on('requestfailed', (req) => {
    if (req.url().includes('geocoding')) { failures.push(req.failure()?.errorText ?? 'unknown'); }
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Choose your first city' }).click();
  const input = page.getByLabel('Search cities');
  await Promise.all([
    page.waitForRequest((req) => req.url().includes('geocoding') && new URL(req.url()).searchParams.get('name') === 'Pa'),
    input.fill('Pa'),
  ]);
  await input.fill('Paris');
  await expect(page.getByText('Paris', { exact: true }).first()).toBeVisible();
  expect(failures.some((f) => f.includes('ERR_ABORTED'))).toBe(true);
});
