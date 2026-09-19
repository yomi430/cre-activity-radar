import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { localSnapshot, publisherMatchesSnapshot, publisherState, fetchSnapshot } from './permit-source.mjs';

function rebuild() {
  const result = spawnSync(process.execPath, ['scripts/rebuild-database.mjs'], { cwd: process.cwd(), env: process.env, encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`database rebuild exited with ${result.status ?? 'an unknown status'}`);
}

export async function refreshMarket(market, { getPublisherState = publisherState, getLocalSnapshot = localSnapshot, fetch = fetchSnapshot, rebuildDatabase = rebuild, log = console.log } = {}) {
  log('STAGE CHECKING_LOCAL_SNAPSHOT');
  const snapshot = getLocalSnapshot(market);
  if (snapshot) log(`LOCAL_SNAPSHOT checksum=${snapshot.actualChecksum} rows=${snapshot.rows} retrievedAt=${snapshot.retrievedAt}`);
  else log('LOCAL_SNAPSHOT missing_or_checksum_invalid');
  log('STAGE CHECKING_PUBLISHER');
  const publisher = await getPublisherState(market);
  log(`PUBLISHER_WINDOW rows=${publisher.rows} latestEventDate=${publisher.latestEventDate ?? 'unknown'}`);
  log(`PUBLISHER_LATEST_EVENT ${publisher.latestPublishedDate ?? 'unknown'}`);
  if (publisherMatchesSnapshot(publisher, snapshot)) {
    log('OUTCOME UP_TO_DATE');
    log('No snapshot replacement or database rebuild was needed for the configured analysis window. Newer publisher events, if shown above, are outside that fixed window.');
    return { outcome: 'UP_TO_DATE', publisher, snapshot };
  }
  log('STAGE FETCHING_CHANGED_WINDOW');
  const manifest = await fetch(market, { log });
  log(`STAGE VALIDATED_SNAPSHOT checksum=${manifest.sha256} rows=${manifest.rows}`);
  rebuildDatabase();
  log('OUTCOME UPDATED');
  return { outcome: 'UPDATED', publisher, manifest };
}

const market = process.argv[2];
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!market) throw new Error('Usage: node scripts/refresh-market.mjs <chicago|nyc>');
  await refreshMarket(market);
}
