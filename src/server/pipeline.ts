import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PipelineStatus, PipelineSourceStatus, SourceReport } from '../shared/contracts.js';
import { openDatabase, seededDatasetId } from './db.js';
import { AdminJobManager } from './jobs.js';
import { reportsFor } from './repository.js';

const sidecars: Partial<Record<SourceReport['source'], string>> = {
  CHICAGO_PERMIT: resolve('data/raw/chicago-permits-2024-07-01_2026-07-01.jsonl.manifest.json'),
  NYC_DOB_NOW: resolve('data/raw/nyc-permits-2024-07-01_2026-07-01.jsonl.manifest.json'),
};
function sidecarFor(source: SourceReport['source']): { sha256: string | null; publisherLatestPublishedDate: string | null } {
  const path = sidecars[source];
  if (!path || !existsSync(path)) return { sha256: null, publisherLatestPublishedDate: null };
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { sha256?: unknown; publisherLatestPublishedDate?: unknown };
    return { sha256: typeof parsed.sha256 === 'string' ? parsed.sha256 : null, publisherLatestPublishedDate: typeof parsed.publisherLatestPublishedDate === 'string' ? parsed.publisherLatestPublishedDate : null };
  } catch { return { sha256: null, publisherLatestPublishedDate: null }; }
}

export function pipelineFor(jobs: AdminJobManager): PipelineStatus {
  const datasetId = seededDatasetId();
  let manifest: PipelineStatus['manifest'] = null;
  let sources: PipelineSourceStatus[] = [];
  if (datasetId) {
    const database = openDatabase();
    try {
      const dataset = database.prepare('SELECT imported_at, manifest_json FROM datasets WHERE dataset_id = ?').get(datasetId) as { imported_at: string; manifest_json: string } | undefined;
      const rawManifest = dataset ? JSON.parse(dataset.manifest_json) as { mode?: unknown; coverageStart?: unknown; coverageEndExclusive?: unknown } : null;
      manifest = { mode: typeof rawManifest?.mode === 'string' ? rawManifest.mode : 'unknown', coverageStart: typeof rawManifest?.coverageStart === 'string' ? rawManifest.coverageStart : null, coverageEndExclusive: typeof rawManifest?.coverageEndExclusive === 'string' ? rawManifest.coverageEndExclusive : null, importedAt: dataset?.imported_at ?? null };
      for (const market of ['CHICAGO', 'NYC'] as const) {
        sources.push(...reportsFor(database, market).map(report => {
          const sidecar = sidecarFor(report.source);
          return ({
          source: report.source, market: report.market, status: report.status, completeness: report.completeness,
          retrievedAt: report.retrievedAt, publisherAsOf: sidecar.publisherLatestPublishedDate ?? report.publisherAsOf,
          coverageStart: manifest?.coverageStart ?? null, coverageEndExclusive: manifest?.coverageEndExclusive ?? null,
          acceptedRows: report.acceptedRows, resolvedRows: report.resolvedRows, unresolvedRows: report.unresolvedRows,
          missingCostRows: report.missingCostRows, checksum: sidecar.sha256,
        }); }));
      }
    } finally { database.close(); }
  }
  const status = jobs.status();
  return { datasetId, manifest, sources, ...status, serverRestartLimitation: 'Job output is persisted for local UI reloads. A server restart cannot resume a running child process; it is reported as INTERRUPTED.' };
}
