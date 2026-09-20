import { EventEmitter } from 'node:events';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChildProcess } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { adminJobActionSchema } from '../src/shared/contracts.js';
import { AdminJobManager, type SpawnCommand } from '../src/server/jobs.js';
import { createApp } from '../src/server/app.js';

class FakeChild extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

describe('local admin jobs', () => {
  it('uses fixed Node scripts, permits one running job, and persists its result', () => {
    const calls: Array<{ command: string; args: string[]; shell: boolean }> = [];
    const child = new FakeChild();
    const root = mkdtempSync(join(tmpdir(), 'radar-admin-'));
    const spawnCommand: SpawnCommand = (command, args, options) => {
      calls.push({ command, args, shell: options.shell });
      return child as unknown as ChildProcess;
    };
    const jobs = new AdminJobManager({ spawnCommand, workingDirectory: root, persistencePath: join(root, 'jobs.json') });
    const job = jobs.start('REFRESH_CHICAGO');
    expect(calls).toEqual([{ command: process.execPath, args: ['scripts/refresh-market.mjs', 'chicago'], shell: false }]);
    expect(jobs.start('VERIFY_DATASET')).toBeNull();
    child.stdout.emit('data', 'STAGE CHECKING_PUBLISHER\nOUTCOME UP_TO_DATE\n');
    child.emit('close', 0);
    expect(jobs.status()).toMatchObject({ currentJob: null, lastJob: { id: job?.id, status: 'SUCCEEDED', stage: 'COMPLETE', outcome: 'UP_TO_DATE', exitCode: 0 } });
    expect(JSON.parse(readFileSync(join(root, 'jobs.json'), 'utf8'))).toMatchObject({ status: 'SUCCEEDED' });
  });

  it('persists fixture job stages, outcomes, stderr, and bounded logs without running a network refresh', () => {
    const child = new FakeChild(); const root = mkdtempSync(join(tmpdir(), 'radar-admin-')); const persistencePath = join(root, 'jobs.json');
    const jobs = new AdminJobManager({ spawnCommand: (() => child as unknown as ChildProcess) as SpawnCommand, persistencePath });
    const job = jobs.start('REFRESH_NYC');
    child.stdout.emit('data', 'STAGE CHECKING_PUBLISHER\n');
    child.stdout.emit('data', `OUTCOME UP_TO_DATE\n${'x'.repeat(33_000)}`);
    child.stderr.emit('data', 'fixture publisher warning\n');
    expect(jobs.status().currentJob).toMatchObject({ id: job?.id, status: 'RUNNING', stage: 'CHECKING_PUBLISHER', outcome: 'UP_TO_DATE', outputTruncated: true, stderr: 'fixture publisher warning\n' });
    child.emit('close', 0);
    const persisted = JSON.parse(readFileSync(persistencePath, 'utf8'));
    expect(persisted).toMatchObject({ id: job?.id, status: 'SUCCEEDED', stage: 'COMPLETE', outcome: 'UP_TO_DATE', outputTruncated: true, stderr: 'fixture publisher warning\n' });
    expect(persisted.stdout.length).toBe(32_000);
  });

  it('rejects arbitrary action strings before spawning a command', () => {
    let spawned = false;
    const jobs = new AdminJobManager({ spawnCommand: (() => { spawned = true; throw new Error('must not run'); }) as SpawnCommand, persistencePath: join(mkdtempSync(join(tmpdir(), 'radar-admin-')), 'jobs.json') });
    expect(adminJobActionSchema.safeParse('node -e injected').success).toBe(false);
    expect(() => jobs.start('node -e injected' as never)).toThrow(/unsupported/i);
    expect(spawned).toBe(false);
  });

  it('allowlists the ZAP refresh script and persists its distinct refresh stages', () => {
    const calls: Array<{ command: string; args: string[]; shell: boolean }> = [];
    const child = new FakeChild(); const root = mkdtempSync(join(tmpdir(), 'radar-admin-zap-'));
    const jobs = new AdminJobManager({
      spawnCommand: ((command, args, options) => { calls.push({ command, args, shell: options.shell }); return child as unknown as ChildProcess; }) as SpawnCommand,
      persistencePath: join(root, 'jobs.json'),
    });
    expect(adminJobActionSchema.safeParse('REFRESH_ZAP').success).toBe(true);
    const job = jobs.start('REFRESH_ZAP');
    expect(calls).toEqual([{ command: process.execPath, args: ['scripts/refresh-zap.mjs'], shell: false }]);
    child.stdout.emit('data', 'STAGE CHECKING_PUBLISHER\nSTAGE FETCHING_ZAP_SNAPSHOT\nSTAGE VALIDATED_ZAP_SNAPSHOT\nOUTCOME UPDATED\n');
    child.emit('close', 0);
    expect(jobs.status().lastJob).toMatchObject({ id: job?.id, action: 'REFRESH_ZAP', status: 'SUCCEEDED', stage: 'COMPLETE', outcome: 'UPDATED' });
  });

  it('returns validation and one-at-a-time conflict responses from the local API', async () => {
    const child = new FakeChild();
    const root = mkdtempSync(join(tmpdir(), 'radar-admin-'));
    const jobs = new AdminJobManager({ spawnCommand: (() => child as unknown as ChildProcess) as SpawnCommand, persistencePath: join(root, 'jobs.json') });
    const server = createApp({ jobs }).listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected local TCP test server.');
    const url = `http://127.0.0.1:${address.port}/api/admin/jobs`;
    try {
      expect((await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'node -e injected' }) })).status).toBe(400);
      expect((await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'VERIFY_DATASET' }) })).status).toBe(202);
      expect((await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'VERIFY_DATASET' }) })).status).toBe(409);
    } finally {
      child.emit('close', 0);
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
