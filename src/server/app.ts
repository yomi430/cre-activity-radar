import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { seededDatasetId, seededMarkets } from './db.js';
import { openDatabase } from './db.js';
import { approvalsFor, cellsFor, evidenceFor, recordFor, reportsFor, signalFor, summaryFor } from './repository.js';
import { marketSchema } from '../shared/contracts.js';
import { getResolution, isValidCell } from 'h3-js';

function error(response: express.Response, status: number, message: string) { return response.status(status).json({ error: { code: status === 400 ? 'VALIDATION' : 'NOT_FOUND', message } }); }
function market(request: express.Request, response: express.Response) { const parsed = marketSchema.safeParse(request.query.market); if (!parsed.success) { error(response, 400, 'market must be CHICAGO or NYC.'); return null; } return parsed.data; }
function permitType(request: express.Request, response: express.Response) { const value = request.query.permitType; if (typeof value !== 'string' || !value.trim()) { error(response, 400, 'permitType is required; use ALL for all types.'); return null; } return value; }
function page(request: express.Request, response: express.Response) { const offset = Number(request.query.offset ?? 0), limit = Number(request.query.limit ?? 25); if (!Number.isInteger(offset) || !Number.isInteger(limit) || offset < 0 || limit < 1 || limit > 100) { error(response, 400, 'offset must be >= 0 and limit must be 1 through 100.'); return null; } return { offset, limit }; }
function cell(request: express.Request, response: express.Response) { const value = request.params.cell; if (typeof value !== 'string' || !isValidCell(value) || getResolution(value) !== 8) { error(response, 400, 'cell must be a valid H3 resolution 8 cell.'); return null; } return value; }
function withDatabase<T>(response: express.Response, run: (database: ReturnType<typeof openDatabase>, datasetId: string) => T) { const datasetId = seededDatasetId(); if (!datasetId) { error(response, 503, 'Run npm.cmd run data:seed first.'); return; } const database = openDatabase(); try { return run(database, datasetId); } finally { database.close(); } }

export function createApp() {
  const app = express();
  app.get('/api/health', (_request, response) => {
    const datasetId = seededDatasetId();
    if (!datasetId) return response.status(503).json({ error: { code: 'UNSEEDED', message: 'Run npm.cmd run data:seed first.' } });
    return response.json({ datasetId, data: { status: 'ok', seeded: true, markets: seededMarkets() } });
  });
  app.get('/api/summary', (request, response) => { const selected = market(request,response), type = permitType(request,response); if (!selected || !type) return; withDatabase(response, (database,datasetId) => response.json({ datasetId, market:selected, data:summaryFor(database,selected,type) })); });
  app.get('/api/cells', (request, response) => { const selected = market(request,response), type = permitType(request,response); if (!selected || !type) return; withDatabase(response, (database,datasetId) => response.json({ datasetId, market:selected, data:cellsFor(database,selected,type) })); });
  app.get('/api/cells/:cell/evidence', (request, response) => { const selected=market(request,response), type=permitType(request,response), selectedCell=cell(request,response), pagination=page(request,response); const period=request.query.period; if(!selected||!type||!selectedCell||!pagination)return; if(period!=='prior'&&period!=='current')return error(response,400,'period must be prior or current.'); withDatabase(response,(database,datasetId)=>{ if(!signalFor(database,selected,selectedCell,type))return error(response,404,'Cell not found for this market and filter.'); const result=evidenceFor(database,selected,selectedCell,type,period,pagination.limit,pagination.offset); return response.json({datasetId,market:selected,data:result.data,pagination:{...pagination,total:result.total}}); }); });
  app.get('/api/cells/:cell', (request, response) => { const selected=market(request,response),type=permitType(request,response),selectedCell=cell(request,response);if(!selected||!type||!selectedCell)return;withDatabase(response,(database,datasetId)=>{const signal=signalFor(database,selected,selectedCell,type);return signal?response.json({datasetId,market:selected,data:signal}):error(response,404,'Cell not found for this market and filter.');}); });
  app.get('/api/approvals', (request,response) => { const selected=market(request,response),pagination=page(request,response),period=request.query.period;if(!selected||!pagination)return;if(period!=='prior'&&period!=='current')return error(response,400,'period must be prior or current.');withDatabase(response,(database,datasetId)=>{const result=approvalsFor(database,selected,period,pagination.limit,pagination.offset);return response.json({datasetId,market:selected,data:result.data,pagination:{...pagination,total:result.total}});}); });
  app.get('/api/records/:id', (request,response) => withDatabase(response,(database,datasetId)=>{const record=recordFor(database,request.params.id);return record?response.json({datasetId,data:record}):error(response,404,'Record not found.');}));
  app.get('/api/sources', (request,response) => { const selected=market(request,response);if(!selected)return;withDatabase(response,(database,datasetId)=>response.json({datasetId,market:selected,data:reportsFor(database,selected)})); });

  const webRoot = resolve('dist/web');
  if (existsSync(webRoot)) {
    app.use(express.static(webRoot));
    app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => response.sendFile(resolve(webRoot, 'index.html')));
  }
  return app;
}
