import { runLocalScrape } from '../api/_lib/scrape-pipeline.ts';
import { createCliLog } from './cli-log.mjs';

const log = createCliLog('scrape');

log('starting', 'info');
const result = await runLocalScrape({ log });

console.log(JSON.stringify(result, null, 2));
if (result.failed.length > 0) process.exitCode = 1;
