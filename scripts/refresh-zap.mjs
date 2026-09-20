import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { activateZapSnapshot, fetchZapSnapshot, zapLocalSnapshot, zapPublisherMatchesSnapshot, zapPublisherState } from './zap-source.mjs';

function rebuild(manifest) {
  const result = spawnSync(process.execPath, ['scripts/rebuild-database.mjs'], { cwd: process.cwd(), env: { ...process.env, RADAR_ZAP_SNAPSHOT_DIR: manifest.directory }, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout); if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`database rebuild exited with ${result.status ?? 'unknown status'}`);
}
export async function refreshZap({ rawDirectory = resolve('data/raw'), getLocalSnapshot = () => zapLocalSnapshot(rawDirectory), getPublisherState = zapPublisherState, fetchSnapshot = options => fetchZapSnapshot({ rawDirectory, activate: false, ...options }), activateSnapshot = snapshot => { if (snapshot.directory) activateZapSnapshot(snapshot, rawDirectory); }, rebuildDatabase = rebuild, log = console.log } = {}) {
  log('STAGE CHECKING_LOCAL_SNAPSHOT'); const snapshot = getLocalSnapshot();
  log(snapshot ? `LOCAL_ZAP_SNAPSHOT ${snapshot.snapshotId}` : 'LOCAL_ZAP_SNAPSHOT missing_or_checksum_invalid');
  log('STAGE CHECKING_PUBLISHER'); const publisher = await getPublisherState();
  log(`PUBLISHER_ZAP projects=${publisher.projects.rowsUpdatedAt ?? 'unknown'} bbls=${publisher.bbls.rowsUpdatedAt ?? 'unknown'} pluto=${publisher.pluto.rowsUpdatedAt ?? 'unknown'}`);
  if (zapPublisherMatchesSnapshot(publisher, snapshot)) { log('OUTCOME UP_TO_DATE'); return { outcome: 'UP_TO_DATE', publisher, snapshot }; }
  log('STAGE FETCHING_ZAP_SNAPSHOT'); const manifest = await fetchSnapshot({ log });
  if (!manifest?.complete) throw new Error('ZAP extraction did not produce a complete snapshot.');
  log(`STAGE VALIDATED_ZAP_SNAPSHOT snapshot=${manifest.snapshotId}`);
  // The staged database receives this immutable directory through RADAR_ZAP_SNAPSHOT_DIR.
  // The active pointer moves only after seed, verification, and database swap succeed.
  log('STAGE REBUILDING_DATABASE'); rebuildDatabase(manifest); activateSnapshot(manifest);
  log('OUTCOME UPDATED'); return { outcome: 'UPDATED', publisher, manifest };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await refreshZap();
