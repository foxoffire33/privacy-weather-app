import { expect, test } from '@playwright/test';

import { installApi } from './fixtures';

test('a browser without IndexedDB shows the not-saved banner and keeps working', async ({ page, context }) => {
  await context.addInitScript(() => { Object.defineProperty(globalThis, 'indexedDB', { value: null, configurable: true }); });
  await installApi(page);
  await page.goto('/');
  await expect(page.getByText('Not saved: local storage is failing.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose your first city' })).toBeVisible();
});
