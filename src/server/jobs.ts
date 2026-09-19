import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import type { AdminJob, AdminJobAction } from '../shared/contracts.js';

const logPath = resolve('data/runtime/admin-jobs.json');
const outputLimit = 32_000;
const commands: Record<AdminJobAction, { executable: string; args: string[] }> = {
  REFRESH_CHICAGO: { executable: process.execPath, args: ['scripts/refresh-market.mjs', 'chicago'] },
  REFRESH_NYC: { executable: process.execPath, args: ['scripts/refresh-market.mjs', 'nyc'] },
  REFRESH_SBA: { executable: process.execPath, args: ['scripts/fetch-sba.mjs'] },
  REBUILD_DATABASE: { executable: process.execPath, args: ['scripts/rebuild-database.mjs'] },
  VERIFY_DATASET: { executable: process.execPath, args: ['scripts/verify-data.mjs'] },
};

export type SpawnCommand = (command: string, args: string[], options: { cwd: string; shell: false; stdio: ['ignore', 'pipe', 'pipe'] }) => ChildProcess;
function boundedAppend(existing: string, chunk: string) { return `${existing}${chunk}`.slice(-outputLimit); }
function isJob(value: unknown): value is AdminJob {
  return typeof value === 'object' && value !== null && typeof (value as AdminJob).id === 'string' && typeof (value as AdminJob).action === 'string';
}

/** Local process runner with an explicit command allowlist. It never accepts a command or path from HTTP input. */
export class AdminJobManager {
  private current: AdminJob | null = null;
  private last: AdminJob | null = null;
  private readonly spawnCommand: SpawnCommand;
  private readonly workingDirectory: string;
  private readonly persistencePath: string;

  constructor(options: { spawnCommand?: SpawnCommand; workingDirectory?: string; persistencePath?: string } = {}) {
    this.spawnCommand = options.spawnCommand ?? ((command, args, spawnOptions) => spawn(command, args, spawnOptions));
    this.workingDirectory = options.workingDirectory ?? process.cwd();
    this.persistencePath = options.persistencePath ?? logPath;
    this.loadLast();
  }
  status() { return { currentJob: this.current, lastJob: this.last }; }
  start(action: AdminJobAction): AdminJob | null {
    if (!Object.hasOwn(commands, action)) throw new RangeError('Unsupported local pipeline action.');
    if (this.current) return null;
    const command = commands[action];
    const job: AdminJob = { id: randomUUID(), action, status: 'RUNNING', stage: 'QUEUED', outcome: null, startedAt: new Date().toISOString(), finishedAt: null, exitCode: null, stdout: '', stderr: '', outputTruncated: false, note: null };
    this.current = job;
    this.persist(job);
    let child: ChildProcess;
    try {
      child = this.spawnCommand(command.executable, command.args, { cwd: this.workingDirectory, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (error) {
      this.finish(job, 'FAILED', null, `Could not start allowlisted job: ${error instanceof Error ? error.message : String(error)}`);
      return job;
    }
    child.stdout?.on('data', chunk => { const text = String(chunk); const next = boundedAppend(job.stdout, text); job.outputTruncated ||= next.length < job.stdout.length + text.length; job.stdout = next; this.applyStage(job, next); this.persist(job); });
    child.stderr?.on('data', chunk => { const next = boundedAppend(job.stderr, String(chunk)); job.outputTruncated ||= next.length < job.stderr.length + String(chunk).length; job.stderr = next; this.persist(job); });
    child.once('error', error => this.finish(job, 'FAILED', null, error.message));
    child.once('close', code => this.finish(job, code === 0 ? 'SUCCEEDED' : 'FAILED', code, null));
    return job;
  }
  private finish(job: AdminJob, status: AdminJob['status'], exitCode: number | null, note: string | null) {
    if (job.finishedAt) return;
    job.status = status; job.stage = status === 'SUCCEEDED' ? 'COMPLETE' : status === 'FAILED' ? 'FAILED' : job.stage; job.exitCode = exitCode; job.finishedAt = new Date().toISOString(); job.note = note;
    this.last = job;
    if (this.current?.id === job.id) this.current = null;
    this.persist(job);
  }
  private applyStage(job: AdminJob, output: string) {
    for (const line of output.split(/\r?\n/)) {
      const stage = /^STAGE ([A-Z_]+)/.exec(line); if (stage) job.stage = stage[1];
      const outcome = /^OUTCOME (UP_TO_DATE|UPDATED)/.exec(line); if (outcome) job.outcome = outcome[1] as AdminJob['outcome'];
    }
  }
  private loadLast() {
    try {
      const parsed = JSON.parse(readFileSync(this.persistencePath, 'utf8')) as unknown;
      if (!isJob(parsed)) return;
      this.last = parsed.status === 'RUNNING' ? { ...parsed, status: 'INTERRUPTED', finishedAt: new Date().toISOString(), note: 'The local server restarted while this job was running; process state is not durable.' } : parsed;
      if (this.last.status === 'INTERRUPTED') this.persist(this.last);
    } catch { /* No previous local job log is a normal first-run state. */ }
  }
  private persist(job: AdminJob) {
    mkdirSync(dirname(this.persistencePath), { recursive: true });
    const staging = `${this.persistencePath}.staging`;
    writeFileSync(staging, JSON.stringify(job, null, 2));
    renameSync(staging, this.persistencePath);
  }
}
