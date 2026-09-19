import { fetchSnapshot } from './permit-source.mjs';

const market = process.argv[2];
if (!market) throw new Error('Usage: node scripts/fetch-permits.mjs <chicago|nyc>');
await fetchSnapshot(market);
