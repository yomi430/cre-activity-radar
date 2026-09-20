import { expect, test, type Page } from '@playwright/test';

async function selectFirstArea(page: Page) {
  const finding = page.locator('.finding').first();
  await expect(finding).toBeVisible();
  await finding.click();
  await expect(page.getByLabel('Selected H3 cell')).toBeVisible();
}

test.describe('workspace navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/tile\.openstreetmap\.org|arcgisonline\.com/, route => route.abort());
    await page.goto('/');
  });

  test('separates discovery, research, methods, and data operations into named views', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'City discovery', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'City discovery', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Areas worth investigating' })).toBeVisible();
    await page.screenshot({ path: 'test-results/city-discovery.png', fullPage: true });

    await selectFirstArea(page);
    await expect(page.getByRole('button', { name: 'Research workspace', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Research workspace', exact: true }).click();
    await expect(page.getByLabel('Selected H3 cell')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Why it surfaced' })).toBeVisible();
    await page.screenshot({ path: 'test-results/research-workspace.png', fullPage: true });

    await page.getByRole('button', { name: 'Data & methods', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Data & methods' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What each CRE lens means' })).toBeVisible();
    await page.screenshot({ path: 'test-results/data-methods.png', fullPage: true });

    await page.getByRole('button', { name: 'Data operations', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Data operations' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Source status and accounting' })).toBeVisible();
  });

  test('returns from a selected H3 to the whole-city discovery view', async ({ page }) => {
    await selectFirstArea(page);
    const selectedCell = await page.getByLabel('Selected H3 cell').textContent();

    await page.getByRole('button', { name: 'Back to whole city', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Areas worth investigating' })).toBeVisible();
    await expect(page.locator('.finding').first()).toBeVisible();
    await expect(page.getByLabel('Selected H3 cell')).toHaveCount(0);
    await expect(page).not.toHaveURL(/(?:\?|&)h3=/);

    await page.getByRole('button', { name: 'Research workspace', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Recently viewed H3 areas' })).toContainText(selectedCell ?? '');
  });

  test('only offers NYC-only evidence views when New York City is the active market', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'NYC entitlements', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Recorded deeds', exact: true })).toHaveCount(0);
    await page.getByLabel('Market').selectOption('NYC');
    await expect(page.getByRole('button', { name: 'NYC entitlements', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recorded deeds', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'NYC entitlements', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'NYC ZAP entitlement applications' })).toBeVisible();

    await page.getByRole('button', { name: 'Recorded deeds', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'NYC recorded deeds', exact: true })).toBeVisible();
    await expect(page.getByLabel('ACRIS coverage limitation')).toContainText('Staten Island is not covered');
    await expect(page.getByText('Exact raw DEED only')).toBeVisible();
    await expect(page.getByText(/document_amt is debt\/obligation/)).toBeVisible();
    await expect(page.getByText('Parcel centroid', { exact: true }).first()).toBeVisible();

    const exportDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export deed JSON' }).click();
    expect((await exportDownload).suggestedFilename()).toMatch(/nyc-acris-recorded-deeds-.*\.json/);

    await page.getByLabel('ACRIS document ID').fill('2025010100001001');
    await page.getByRole('button', { name: 'Look up document' }).click();
    await expect(page.getByText('Document 2025010100001001')).toBeVisible();
    await expect(page.getByText('Price:', { exact: true })).toBeVisible();
  });
});
