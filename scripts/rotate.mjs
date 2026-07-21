import { runLocalRotation } from '../api/_lib/rotation-pipeline.ts';
import { createCliLog } from './cli-log.mjs';

const log = createCliLog('rotate');

log('starting', 'info');
const result = await runLocalRotation({ log });

console.log(JSON.stringify(result, null, 2));
if (result.failed.length > 0) process.exitCode = 1;
