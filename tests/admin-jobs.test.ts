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

  it('rejects arbitrary action strings before spawning a command', () => {
    let spawned = false;
    const jobs = new AdminJobManager({ spawnCommand: (() => { spawned = true; throw new Error('must not run'); }) as SpawnCommand, persistencePath: join(mkdtempSync(join(tmpdir(), 'radar-admin-')), 'jobs.json') });
    expect(adminJobActionSchema.safeParse('node -e injected').success).toBe(false);
    expect(() => jobs.start('node -e injected' as never)).toThrow(/unsupported/i);
    expect(spawned).toBe(false);
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
