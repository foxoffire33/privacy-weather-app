import { expect, test } from '@playwright/test';

import { installApi } from './fixtures';

const file = (name: string, content: string): { name: string; mimeType: string; buffer: Buffer } => ({ name, mimeType: 'application/json', buffer: Buffer.from(content) });

test('a backup file over the size limit is rejected with an explanation', async ({ page }) => {
  await installApi(page);
  await page.goto('/#/settings');
  await page.setInputFiles('input[type="file"]', file('big.json', 'A'.repeat(5_100_000)));
  await expect(page.getByText('This backup file is too large to import.')).toBeVisible();
});

test('a file that is not valid JSON is rejected with an explanation', async ({ page }) => {
  await installApi(page);
  await page.goto('/#/settings');
  await page.setInputFiles('input[type="file"]', file('bad.json', '{definitely not json'));
  await expect(page.getByText('This file is not valid JSON.')).toBeVisible();
});

test('a valid backup imports its city and history, which survive a reload', async ({ page }) => {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: {},
    cities: [{ id: '999999', name: 'Testville', region: 'Testland', lat: 10, lon: 20, followedAt: '2026-11-01' }],
    history: { '999999': { '2026-11-01': { source: 'filled', snapshots: 3, hi: 15, lo: 5, mm: 0, code: 1 } } },
  };
  await installApi(page);
  await page.goto('/#/settings');
  await page.setInputFiles('input[type="file"]', file('weather-log.json', JSON.stringify(backup)));
  await page.getByRole('button', { name: 'Import selected' }).click();
  await expect(page.getByText(/Imported 1 new/)).toBeVisible();
  await page.waitForTimeout(1000);
  await page.goto('/');
  await expect(page.getByText('Testville').first()).toBeVisible();
});
