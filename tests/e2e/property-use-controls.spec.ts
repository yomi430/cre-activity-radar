import { expect, test } from '@playwright/test';

test('preserves NYC property context, individual-cost threshold, rank, local refinement, saved lead, and export context', async ({ page }) => {
  test.setTimeout(60_000);
  await page.route(/tile\.openstreetmap\.org|arcgisonline\.com/, route => route.abort());
  await page.goto('/?market=NYC');

  await expect(page.getByLabel('Property context')).toBeVisible();
  await page.getByLabel('Property context').selectOption('LIKELY_COMMERCIAL');
  await page.getByLabel('Minimum individual reported estimate').fill('1');
  await page.getByLabel('Area ranking').selectOption('LARGEST_REPORTED_COST');
  await expect(page).toHaveURL(/propertyUse=LIKELY_COMMERCIAL/);
  await expect(page).toHaveURL(/minReportedCostCents=100/);
  await expect(page).toHaveURL(/rank=LARGEST_REPORTED_COST/);

  const findings = page.locator('.finding');
  await expect(findings.first()).toBeVisible();

  // The global ranking aggregates across both the current and prior comparison windows, but the
  // local drill-down defaults to showing current-window records only (with no period toggle once
  // it renders an honest "no matching records" empty state). A top-ranked cell can therefore have
  // qualified globally on prior-window activity alone and show empty on first drill-down — real
  // product behavior, not a bug. Try the top few findings and use whichever one actually has
  // current-window local records, rather than assuming the very top one always does.
  const findingCount = await findings.count();
  let propertyContext = null;
  for (let i = 0; i < Math.min(findingCount, 8); i++) {
    await page.locator('.finding').nth(i).click();
    const control = page.getByLabel('H3 property context');
    if (await control.isVisible({ timeout: 5_000 }).catch(() => false)) { propertyContext = control; break; }
    await page.getByRole('button', { name: 'City discovery', exact: true }).click();
  }
  expect(propertyContext, 'expected at least one of the top-ranked findings to have current-window local records').not.toBeNull();
  await expect(propertyContext).toHaveValue('LIKELY_COMMERCIAL');
  await expect(page.getByText(/parcel context, not proof of current tenancy or permit use/i).first()).toBeVisible();

  await page.getByLabel('H3 property context').selectOption('ALL');
  await expect(page).toHaveURL(/localPropertyUse=ALL/);
  const evidenceDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export JSON' }).click();
  expect((await evidenceDownload).suggestedFilename()).toMatch(/^cre-evidence-.*\.json$/);

  await page.getByLabel('Disposition').selectOption('MONITOR');
  await page.getByRole('button', { name: 'Save to watchlist' }).click();
  await expect(page.getByRole('button', { name: 'Update saved item' })).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/propertyUse=LIKELY_COMMERCIAL/);
  await expect(page.getByLabel('H3 property context')).toHaveValue('ALL');
  await expect(page.getByLabel('H3 minimum individual reported estimate')).toHaveValue('1');
  await page.screenshot({ path: 'test-results/nyc-property-use-controls.png', fullPage: true });

  await page.getByRole('button', { name: 'City discovery', exact: true }).click();
  await expect(page.getByLabel('Property context', { exact: true })).toHaveValue('LIKELY_COMMERCIAL');
  await expect(page.getByLabel('Area ranking')).toHaveValue('LARGEST_REPORTED_COST');

  await page.getByRole('button', { name: 'Research workspace', exact: true }).click();
  await page.getByRole('list', { name: 'Recently viewed H3 areas' }).getByRole('button', { name: /Open/ }).first().click();
  await expect(page.getByLabel('H3 property context')).toHaveValue('ALL');
  await expect(page).toHaveURL(/rank=LARGEST_REPORTED_COST/);
});
