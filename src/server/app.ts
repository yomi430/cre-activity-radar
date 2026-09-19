import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { seededDatasetId, seededMarkets } from './db.js';

export function createApp() {
  const app = express();
  app.get('/api/health', (_request, response) => {
    const datasetId = seededDatasetId();
    if (!datasetId) return response.status(503).json({ error: { code: 'UNSEEDED', message: 'Run npm.cmd run data:seed first.' } });
    return response.json({ datasetId, data: { status: 'ok', seeded: true, markets: seededMarkets() } });
  });

  const webRoot = resolve('dist/web');
  if (existsSync(webRoot)) {
    app.use(express.static(webRoot));
    app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => response.sendFile(resolve(webRoot, 'index.html')));
  }
  return app;
}
