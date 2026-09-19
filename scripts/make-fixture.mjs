import { copyFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

mkdirSync(resolve('data/demo'), { recursive: true });
for (const name of ['chicago', 'nyc', 'sba504']) copyFileSync(resolve(`data/fixtures/${name}.jsonl`), resolve(`data/demo/${name}.jsonl`));
console.log('Wrote deterministic synthetic two-market demo files (seed: cre-radar-t01).');

