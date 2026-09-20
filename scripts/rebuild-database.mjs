import { existsSync, renameSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function atomicReplace(stagedPath, activePath) {
  const backup = `${activePath}.previous-${process.pid}-${Date.now()}`;
  let movedActive = false;
  try {
    if (existsSync(activePath)) { renameSync(activePath, backup); movedActive = true; }
    renameSync(stagedPath, activePath);
    if (movedActive && existsSync(backup)) rmSync(backup, { force: true });
  } catch (error) {
    if (movedActive && !existsSync(activePath) && existsSync(backup)) renameSync(backup, activePath);
    throw error;
  }
}

export function runNode(script, env) {
  const result = spawnSync(process.execPath, [script], { cwd: process.cwd(), env, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`${script} exited with ${result.status ?? 'an unknown status'}`);
}

export function stageDatabase({ databasePath = process.env.RADAR_DB_PATH ?? resolve('data/runtime/radar.sqlite'), env = process.env } = {}) {
  const active = resolve(databasePath); const staged = `${active}.staging-${process.pid}-${Date.now()}`;
  console.log('STAGE REBUILDING_DATABASE');
  try {
    runNode('scripts/seed.mjs', { ...env, RADAR_DB_PATH: staged });
    console.log('STAGE VERIFYING_DATABASE');
    runNode('scripts/verify-data.mjs', { ...env, RADAR_DB_PATH: staged });
    return { active, staged };
  } catch (error) {
    for (const artifact of [staged, `${staged}-journal`, `${staged}-wal`, `${staged}-shm`]) if (existsSync(artifact)) rmSync(artifact, { force: true });
    throw error;
  }
}

export function activateStagedDatabase({ active, staged }) {
  console.log('STAGE SWAPPING_DATABASE');
  atomicReplace(staged, active);
  console.log('DATABASE_REBUILT');
}

export function discardStagedDatabase({ staged }) {
  for (const artifact of [staged, `${staged}-journal`, `${staged}-wal`, `${staged}-shm`]) if (existsSync(artifact)) rmSync(artifact, { force: true });
}

export function rebuildDatabase(options = {}) {
  const prepared = stageDatabase(options);
  try { activateStagedDatabase(prepared); } finally { discardStagedDatabase(prepared); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) rebuildDatabase();
