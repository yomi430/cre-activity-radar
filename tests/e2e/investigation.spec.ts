import { expect, test } from '@playwright/test';

async function chooseFirstArea(page: import('@playwright/test').Page) {
  const area = page.locator('.finding').first();
  await expect(area).toBeVisible();
  await area.click();
  await expect(page.getByText('Permit evidence')).toBeVisible();
}

test('investigates a Chicago area, opens source evidence, and repeats in NYC', async ({ page }) => {
  await page.route(/tile\.openstreetmap\.org|arcgisonline\.com/, route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'CRE Activity Radar' })).toBeVisible();
  await expect(page.getByText('Source quality')).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Areas worth investigating' })).toBeVisible();
  await chooseFirstArea(page);
  await expect(page.getByRole('heading', { name: 'Why it surfaced' })).toBeVisible();
  await page.getByRole('button', { name: 'Prior', exact: true }).click();
  await expect(page.getByText('Jul 2024–Jun 2025', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Current', exact: true }).click();
  await expect(page.getByText('Jul 2025–Jun 2026', { exact: true })).toBeVisible();
  const record = page.locator('.record-link').first();
  await expect(record).toBeVisible();
  await record.click();
  await expect(page.getByRole('dialog', { name: 'Record provenance' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await page.screenshot({ path: 'test-results/chicago-desktop.png', fullPage: true });

  await page.getByLabel('Market').selectOption('NYC');
  await expect(page.locator('.finding').first()).toBeVisible();
  await chooseFirstArea(page);
  await expect(page.locator('.brief-title h2')).toBeVisible();
  await page.screenshot({ path: 'test-results/nyc-desktop.png', fullPage: true });
});

test('keeps the investigation workflow usable at a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route(/tile\.openstreetmap\.org|arcgisonline\.com/, route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'CRE Activity Radar' })).toBeVisible();
  await expect(page.locator('.finding').first()).toBeVisible();
  await page.locator('.finding').first().click();
  await expect(page.getByText('Permit evidence')).toBeVisible();
  await page.screenshot({ path: 'test-results/chicago-mobile.png', fullPage: true });
});

test('opens data operations and reports the seeded pipeline', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Data operations', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Data operations' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Source status and accounting' })).toBeVisible();
  await expect(page.getByText('CHICAGO', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('NYC', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verify dataset' })).toBeEnabled();
  await page.screenshot({ path: 'test-results/data-operations.png', fullPage: true });
});
