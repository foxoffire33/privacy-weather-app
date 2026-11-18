import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { followParis, installApi } from './fixtures';

test('settings screen has no detectable WCAG A/AA violations', async ({ page }) => {
  await installApi(page);
  await page.goto('/#/settings');
  await expect(page.getByText('Language').first()).toBeVisible();
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(report.violations).toEqual([]);
});

test('followed city home has no detectable WCAG A/AA violations', async ({ page }) => {
  await installApi(page);
  await followParis(page);
  const report = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  expect(report.violations).toEqual([]);
});
