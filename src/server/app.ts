import express from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { seededDatasetId, seededMarkets } from './db.js';
import { openDatabase } from './db.js';
import { approvalsFor, cellsFor, evidenceFor, investigationBriefFor, recordFor, reportsFor, signalFor, summaryFor } from './repository.js';
import { adminJobActionSchema, lensIdSchema, marketSchema, propertyUseSchema, rankSchema, zapWindowSchema } from '../shared/contracts.js';
import { getResolution, isValidCell } from 'h3-js';
import { AdminJobManager } from './jobs.js';
import { pipelineFor } from './pipeline.js';
import { zapCellsFor, zapSummaryFor } from './zap.js';
import { acrisDocumentFor, acrisSummaryFor } from './acris.js';

function error(response: express.Response, status: number, message: string) { return response.status(status).json({ error: { code: status === 400 ? 'VALIDATION' : 'NOT_FOUND', message } }); }
function market(request: express.Request, response: express.Response) { const parsed = marketSchema.safeParse(request.query.market); if (!parsed.success) { error(response, 400, 'market must be CHICAGO or NYC.'); return null; } return parsed.data; }
function permitType(request: express.Request, response: express.Response) { const value = request.query.permitType; if (value === undefined) return 'ALL'; if (typeof value !== 'string' || !value.trim()) { error(response, 400, 'permitType must be a non-empty exact source value or ALL.'); return null; } return value; }
function lens(request: express.Request, response: express.Response) { const value = request.query.lens ?? 'ALL'; const parsed = lensIdSchema.safeParse(value); if (!parsed.success) { error(response, 400, `lens must be one of: ${lensIdSchema.options.join(', ')}.`); return null; } return parsed.data; }
function permitFilters(request: express.Request, response: express.Response) { const property = propertyUseSchema.safeParse(request.query.propertyUse ?? 'ALL'); if (!property.success) { error(response, 400, `propertyUse must be one of: ${propertyUseSchema.options.join(', ')}.`); return null; } const rank = rankSchema.safeParse(request.query.rank ?? 'RECORDED_CHANGE'); if (!rank.success) { error(response, 400, `rank must be one of: ${rankSchema.options.join(', ')}.`); return null; } const raw = request.query.minReportedCostCents; if (raw === undefined) return { propertyUse:property.data, rank:rank.data, minReportedCostCents:null }; if (typeof raw !== 'string' || !/^\d+$/.test(raw)) { error(response,400,'minReportedCostCents must be a non-negative integer number of cents.'); return null; } const amount=Number(raw); if (!Number.isSafeInteger(amount)) { error(response,400,'minReportedCostCents must be a safe integer number of cents.'); return null; } return { propertyUse:property.data, rank:rank.data, minReportedCostCents:amount }; }
function zapWindow(request: express.Request, response: express.Response) { const parsed = zapWindowSchema.safeParse(request.query.window ?? 'ALL_RECORDS'); if (!parsed.success) { error(response, 400, `window must be one of: ${zapWindowSchema.options.join(', ')}.`); return null; } return parsed.data; }
function page(request: express.Request, response: express.Response) { const offset = Number(request.query.offset ?? 0), limit = Number(request.query.limit ?? 25); if (!Number.isInteger(offset) || !Number.isInteger(limit) || offset < 0 || limit < 1 || limit > 100) { error(response, 400, 'offset must be >= 0 and limit must be 1 through 100.'); return null; } return { offset, limit }; }
function cell(request: express.Request, response: express.Response) { const value = request.params.cell; if (typeof value !== 'string' || !isValidCell(value) || getResolution(value) !== 8) { error(response, 400, 'cell must be a valid H3 resolution 8 cell.'); return null; } return value; }
function withDatabase<T>(response: express.Response, run: (database: ReturnType<typeof openDatabase>, datasetId: string) => T) { const datasetId = seededDatasetId(); if (!datasetId) { error(response, 503, 'Run npm.cmd run data:seed first.'); return; } const database = openDatabase(); try { return run(database, datasetId); } finally { database.close(); } }

export function createApp(options: { jobs?: AdminJobManager } = {}) {
  const app = express();
  const jobs = options.jobs ?? new AdminJobManager();
  app.use(express.json());
  app.get('/api/health', (_request, response) => {
    const datasetId = seededDatasetId();
    if (!datasetId) return response.status(503).json({ error: { code: 'UNSEEDED', message: 'Run npm.cmd run data:seed first.' } });
    return response.json({ datasetId, data: { status: 'ok', seeded: true, markets: seededMarkets() } });
  });
  app.get('/api/summary', (request, response) => { const selected = market(request,response), type = permitType(request,response), selectedLens = lens(request,response), selectedFilters=permitFilters(request,response); if (!selected || !type || !selectedLens || !selectedFilters) return; withDatabase(response, (database,datasetId) => response.json({ datasetId, market:selected, data:summaryFor(database,selected,type,selectedLens,selectedFilters) })); });
  app.get('/api/cells', (request, response) => { const selected = market(request,response), type = permitType(request,response), selectedLens = lens(request,response), selectedFilters=permitFilters(request,response); if (!selected || !type || !selectedLens || !selectedFilters) return; withDatabase(response, (database,datasetId) => response.json({ datasetId, market:selected, data:cellsFor(database,selected,type,selectedLens,selectedFilters) })); });
  app.get('/api/cells/:cell/evidence', (request, response) => { const selected=market(request,response), type=permitType(request,response), selectedLens=lens(request,response),selectedFilters=permitFilters(request,response), selectedCell=cell(request,response), pagination=page(request,response); const period=request.query.period; if(!selected||!type||!selectedLens||!selectedFilters||!selectedCell||!pagination)return; if(period!=='prior'&&period!=='current')return error(response,400,'period must be prior or current.'); withDatabase(response,(database,datasetId)=>{ if(!signalFor(database,selected,selectedCell,type,selectedLens,selectedFilters))return error(response,404,'Cell not found for this market and filter.'); const result=evidenceFor(database,selected,selectedCell,type,period,pagination.limit,pagination.offset,selectedLens,selectedFilters); return response.json({datasetId,market:selected,data:result.data,pagination:{...pagination,total:result.total}}); }); });
  app.get('/api/cells/:cell/brief', (request, response) => { const selected=market(request,response), type=permitType(request,response), selectedLens=lens(request,response),selectedFilters=permitFilters(request,response), selectedCell=cell(request,response); if(!selected||!type||!selectedLens||!selectedFilters||!selectedCell)return; withDatabase(response,(database,datasetId)=>{ const brief=investigationBriefFor(database,selected,selectedCell,type,selectedLens,selectedFilters); return brief ? response.json({datasetId,market:selected,data:brief}) : error(response,404,'Cell not found for this market and filter.'); }); });
  app.get('/api/cells/:cell', (request, response) => { const selected=market(request,response),type=permitType(request,response),selectedLens=lens(request,response),selectedFilters=permitFilters(request,response),selectedCell=cell(request,response);if(!selected||!type||!selectedLens||!selectedFilters||!selectedCell)return;withDatabase(response,(database,datasetId)=>{const signal=signalFor(database,selected,selectedCell,type,selectedLens,selectedFilters);return signal?response.json({datasetId,market:selected,data:signal}):error(response,404,'Cell not found for this market and filter.');}); });
  app.get('/api/approvals', (request,response) => { const selected=market(request,response),pagination=page(request,response),period=request.query.period;if(!selected||!pagination)return;if(period!=='prior'&&period!=='current')return error(response,400,'period must be prior or current.');withDatabase(response,(database,datasetId)=>{const result=approvalsFor(database,selected,period,pagination.limit,pagination.offset);return response.json({datasetId,market:selected,data:result.data,pagination:{...pagination,total:result.total}});}); });
  app.get('/api/records/:id', (request,response) => withDatabase(response,(database,datasetId)=>{const record=recordFor(database,request.params.id);return record?response.json({datasetId,data:record}):error(response,404,'Record not found.');}));
  app.get('/api/sources', (request,response) => { const selected=market(request,response);if(!selected)return;withDatabase(response,(database,datasetId)=>response.json({datasetId,market:selected,data:reportsFor(database,selected)})); });
  // NYC ZAP is intentionally a separate entitlement layer. These routes never call
  // permit ranking functions and accept no permit type/lens filters.
  app.get('/api/zap/summary', (request, response) => { const window = zapWindow(request, response); if (!window) return; withDatabase(response, (database, datasetId) => response.json({ datasetId, market: 'NYC', data: zapSummaryFor(database, window) })); });
  app.get('/api/zap/cells', (request, response) => { const window = zapWindow(request, response); if (!window) return; withDatabase(response, (database, datasetId) => response.json({ datasetId, market: 'NYC', data: zapCellsFor(database, window) })); });
  // Recorded deeds are evidence only: they do not touch permit scoring or queue ranking.
  const noTransactionQuery = (request: express.Request, response: express.Response) => { if (Object.keys(request.query).length) { error(response, 400, 'NYC recorded-deed routes have a fixed [2024-07-01, 2026-07-01) scope and accept no query parameters.'); return false; } return true; };
  app.get('/api/transactions/nyc/summary', (request, response) => { if (!noTransactionQuery(request,response)) return; return withDatabase(response, (database, datasetId) => response.json({ datasetId, market: 'NYC', data: acrisSummaryFor(database) })); });
  app.get('/api/transactions/nyc/cells', (request, response) => { if (!noTransactionQuery(request,response)) return; return withDatabase(response, (database, datasetId) => response.json({ datasetId, market: 'NYC', data: acrisSummaryFor(database).cells })); });
  app.get('/api/transactions/nyc/documents/:documentId', (request, response) => { if (!noTransactionQuery(request,response)) return; return withDatabase(response, (database, datasetId) => { const data = acrisDocumentFor(database, request.params.documentId); return data ? response.json({ datasetId, market: 'NYC', data }) : error(response, 404, 'Recorded deed not found.'); }); });
  app.get('/api/admin/pipeline', (_request, response) => { const data = pipelineFor(jobs); return response.json({ datasetId: data.datasetId, data }); });
  app.post('/api/admin/jobs', (request, response) => {
    const parsed = adminJobActionSchema.safeParse(request.body?.action);
    if (!parsed.success) return error(response, 400, `action must be one of: ${adminJobActionSchema.options.join(', ')}.`);
    const job = jobs.start(parsed.data);
    if (!job) return response.status(409).json({ error: { code: 'JOB_RUNNING', message: 'A local pipeline job is already running.' } });
    return response.status(202).json({ datasetId: seededDatasetId(), data: job });
  });

  const webRoot = resolve('dist/web');
  if (existsSync(webRoot)) {
    app.use(express.static(webRoot));
    app.get(/^(?!\/api(?:\/|$)).*/, (_request, response) => response.sendFile(resolve(webRoot, 'index.html')));
  }
  return app;
}
