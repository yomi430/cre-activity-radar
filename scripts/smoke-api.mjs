import assert from 'node:assert/strict';

const base = process.env.RADAR_SMOKE_URL ?? 'http://127.0.0.1:3001';
async function request(path, params = {}, expectedStatus = 200) {
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, expectedStatus, `${url.pathname}: expected ${expectedStatus}, received ${response.status}`);
  return response.json();
}

const health = await request('/api/health');
assert.deepEqual([...health.data.markets].sort(), ['CHICAGO', 'NYC']);
const results = [];
for (const market of ['CHICAGO', 'NYC']) {
  const params = { market, permitType: 'ALL' };
  const summary = await request('/api/summary', params);
  const cells = await request('/api/cells', params);
  assert.equal(summary.datasetId, health.datasetId);
  assert.equal(summary.data.market, market);
  assert.equal(summary.data.windows.prior.start, '2024-07-01');
  assert.equal(summary.data.windows.current.start, '2025-07-01');
  assert.equal(summary.data.windows.current.endExclusive, '2026-07-01');
  assert.ok(cells.data.cells.length > 0, `${market}: expected seeded cells`);
  assert.ok(cells.data.cells.every(cell => cell.market === market));
  assert.equal(cells.data.geojson.features.length, cells.data.cells.length);
  for (const field of ['current', 'previous']) {
    assert.equal(
      cells.data.cells.reduce((total, cell) => total + cell.permitCount[field], 0),
      summary.data.mappedPermits[field],
      `${market}: ${field} map counts must reconcile`,
    );
    assert.equal(
      summary.data.acceptedPermits[field],
      summary.data.mappedPermits[field] + summary.data.unmappedPermits[field],
    );
  }

  const chosen = [...cells.data.cells].sort((a, b) => b.permitCount.current - a.permitCount.current)[0];
  const detail = await request(`/api/cells/${chosen.h3Cell}`, params);
  assert.deepEqual(detail.data.permitCount, chosen.permitCount);
  assert.equal(detail.data.monthly.length, 24);
  for (const period of ['current', 'prior']) {
    const expected = chosen.permitCount[period === 'current' ? 'current' : 'previous'];
    const evidence = await request(`/api/cells/${chosen.h3Cell}/evidence`, { ...params, period, limit: 1, offset: 0 });
    assert.equal(evidence.pagination.total, expected, `${market} ${period}: evidence total`);
    assert.equal(evidence.data.length, Math.min(expected, 1));
    for (const row of evidence.data) {
      assert.equal(row.market, market);
      assert.equal(row.h3Cell, chosen.h3Cell);
      assert.ok(row.date >= summary.data.windows[period].start && row.date < summary.data.windows[period].endExclusive);
      const record = await request(`/api/records/${encodeURIComponent(row.id)}`);
      assert.equal(record.data.normalized.id, row.id);
      assert.ok(Object.keys(record.data.raw).length > 0);
      assert.match(record.data.sourceUrl, /^https:\/\//);
    }
  }
  const type = summary.data.permitTypes[0];
  if (type) {
    const filteredParams = { market, permitType: type };
    const filteredSummary = await request('/api/summary', filteredParams);
    const filteredCells = await request('/api/cells', filteredParams);
    assert.ok(filteredSummary.data.acceptedPermits.current <= summary.data.acceptedPermits.current);
    assert.equal(filteredCells.data.cells.reduce((sum, cell) => sum + cell.permitCount.current, 0), filteredSummary.data.mappedPermits.current);
  }
  if (summary.data.sba.status === 'unavailable') {
    assert.equal(summary.data.sba.approvalCount, null);
    assert.equal(summary.data.sba.approvalAmountCents, null);
  }
  await request('/api/cells/not-a-cell', params, 400);
  await request(`/api/cells/${chosen.h3Cell}/evidence`, { ...params, period: 'current', limit: -1 }, 400);
  results.push({ market, mode: summary.data.mode, cells: cells.data.cells.length, permits: summary.data.acceptedPermits, sba: summary.data.sba.status });
}
await request('/api/summary', {}, 400);
await request('/api/summary', { market: 'INVALID' }, 400);
console.log(JSON.stringify({ status: 'passed', datasetId: health.datasetId, markets: results }, null, 2));
