import { runLocalListSnapshots } from '../api/_lib/list-snapshots-pipeline.ts';
import { createCliLog } from './cli-log.mjs';

const log = createCliLog('list-snapshots');

log('starting', 'info');
const result = await runLocalListSnapshots({ log });

console.log(JSON.stringify(result, null, 2));
