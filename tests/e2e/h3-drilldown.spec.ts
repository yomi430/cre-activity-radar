import { expect, test, type Page } from '@playwright/test';

async function openFirstH3(page: Page) {
  const first = page.locator('.finding').first();
  await expect(first).toBeVisible();
  await first.click();
  await expect(page.getByLabel('Selected H3 cell')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'H3 subsection breakdown' })).toBeVisible();
}

test.describe('persistent H3 drill-down', () => {
  test.beforeEach(async ({ page }) => {
    await page.route(/tile\.openstreetmap\.org|arcgisonline\.com/, route => route.abort());
    await page.goto('/');
  });

  test('keeps the H3 anchor and global discovery results while local scope changes', async ({ page }) => {
    await openFirstH3(page);
    const selected = page.getByLabel('Selected H3 cell');
    const selectedId = await selected.textContent();
    const queueBefore = (await page.locator('.finding').allInnerTexts()).join('|');
    await page.getByLabel('H3 CRE lens').selectOption('GROUND_UP_SITE');
    await expect(selected).toHaveText(selectedId ?? '');
    expect((await page.locator('.finding').allInnerTexts()).join('|')).toBe(queueBefore);
    await expect(page.getByRole('heading', { name: /lead|activity/i }).first()).toBeVisible();
    await expect(page.getByText('Raw permit evidence')).toBeVisible();
  });

  test('shows an automatic full-H3 breakdown and an honest zero-match drill-down', async ({ page }) => {
    await page.route(/\/api\/cells\/[^/]+\/brief\?.*lens=SIGNAGE/, route => route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'No matching records' }) }));
    await openFirstH3(page);
    const breakdown = page.getByRole('region', { name: 'H3 subsection breakdown' });
    await expect(breakdown).toBeVisible();
    await expect(breakdown.getByRole('heading', { name: 'By CRE lens' })).toBeVisible();
    await expect(breakdown.getByRole('heading', { name: 'Exact source types' })).toBeVisible();
    await page.getByLabel('H3 permit type').selectOption('PERMIT - NEW CONSTRUCTION');
    await page.getByLabel('H3 CRE lens').selectOption('SIGNAGE');
    await expect(page.getByRole('heading', { name: 'No matching records in this H3 for the selected filters' })).toBeVisible();
    await page.getByRole('button', { name: 'Use global filters' }).click();
    await expect(page.getByLabel('H3 permit type')).toHaveValue('ALL');
  });

  test('restores URL-addressed context and keeps recent history separate', async ({ page }) => {
    await openFirstH3(page);
    const selected = await page.getByLabel('Selected H3 cell').textContent();
    await expect(page).toHaveURL(/[?&]h3=/);
    await expect(page.getByRole('list', { name: 'Recently viewed H3 areas' }).getByRole('listitem')).toHaveCount(1);
    await page.reload();
    await expect(page.getByLabel('Selected H3 cell')).toHaveText(selected ?? '');
    await expect(page.getByRole('button', { name: 'Resume last investigation' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear history' }).click();
    await expect(page.getByText('No recently viewed areas.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Saved investigations' })).toBeVisible();
  });

  test('renders the qualified signal and local controls on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFirstH3(page);
    await expect(page.getByText(/Deterministic research qualification/)).toBeVisible();
    await expect(page.getByLabel('H3 CRE lens')).toBeVisible();
    await page.screenshot({ path: 'test-results/h3-drilldown-mobile.png', fullPage: true });
  });
});
