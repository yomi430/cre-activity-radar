import { describe, expect, it } from 'vitest';
import { createApp } from '../src/server/app.js';

async function serverFor(test: (baseUrl: string) => Promise<void>) {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a TCP test server.');
  try {
    await test(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

describe('property-use and reported-cost query validation', () => {
  it('rejects unsupported property-use categories, ranks, and cost thresholds before data access', async () => {
    await serverFor(async baseUrl => {
      const paths = [
        '/api/summary?market=CHICAGO&propertyUse=OFFICE',
        '/api/cells?market=CHICAGO&rank=SUM_REPORTED_COST',
        '/api/cells?market=CHICAGO&rank=ACTIVITY',
        '/api/cells?market=CHICAGO&minReportedCostCents=-1',
        '/api/cells?market=CHICAGO&minReportedCostCents=100.5',
        '/api/cells?market=CHICAGO&propertyUse=UNKNOWN&propertyUse=RESIDENTIAL',
      ];
      for (const path of paths) {
        const response = await fetch(`${baseUrl}${path}`);
        expect(response.status, path).toBe(400);
        await expect(response.json()).resolves.toMatchObject({ error: { code: 'VALIDATION' } });
      }
    });
  });
});
