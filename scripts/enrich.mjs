import {
  runLocalEnrichment,
  runEnrichmentSync,
  runEnrichmentForce,
} from '../api/_lib/enrichment-pipeline.ts';
import { createCliLog } from './cli-log.mjs';

const force = process.argv.includes('--force');
const sync = process.argv.includes('--sync');
const mode = force ? 'force' : sync ? 'sync' : 'seed';

const log = createCliLog('enrich');

log(`starting (${mode})`, 'info');
const run =
  mode === 'force' ? runEnrichmentForce : mode === 'sync' ? runEnrichmentSync : runLocalEnrichment;
const result = await run({ log });

console.log(JSON.stringify({ mode, ...result }, null, 2));
if (result.failed.length > 0) process.exitCode = 1;
