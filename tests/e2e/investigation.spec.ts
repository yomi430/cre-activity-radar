import { expect, test } from '@playwright/test';

async function chooseFirstArea(page: import('@playwright/test').Page) {
  const area = page.locator('.area').first();
  await expect(area).toBeVisible();
  await area.click();
  await expect(page.getByText('Permit evidence')).toBeVisible();
}

test('investigates a Chicago area, opens source evidence, and repeats in NYC', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'CRE Activity Radar' })).toBeVisible();
  await expect(page.getByText('Source quality')).toBeVisible();

  await chooseFirstArea(page);
  await page.getByRole('button', { name: 'Prior' }).click();
  await expect(page.getByText('Jul 2024–Jun 2025')).toBeVisible();
  await page.getByRole('button', { name: 'Current' }).click();
  await expect(page.getByText('Jul 2025–Jun 2026')).toBeVisible();
  const record = page.locator('.record-link').first();
  await expect(record).toBeVisible();
  await record.click();
  await expect(page.getByRole('dialog', { name: 'Record provenance' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByLabel('Market').selectOption('NYC');
  await expect(page.getByText('NYC H3 area').first()).toBeVisible();
  await chooseFirstArea(page);
  await expect(page.locator('.detail-head')).toContainText('NYC H3 area');
});
