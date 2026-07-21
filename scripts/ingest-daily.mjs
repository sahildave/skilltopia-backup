import { runLocalListSnapshots } from '../api/_lib/list-snapshots-pipeline.ts';
import { runLocalRotation } from '../api/_lib/rotation-pipeline.ts';
import { createCliLog } from './cli-log.mjs';

const listLog = createCliLog('list-snapshots');
const rotateLog = createCliLog('rotate');

listLog('starting daily ingest (list → rotation)', 'info');
const list = await runLocalListSnapshots({ log: listLog });
listLog(`list done queued=${list.queued}`, 'ok');

rotateLog('starting rotation', 'info');
const rotation = await runLocalRotation({
  log: rotateLog,
  extraQueued: list.queuedIds,
});

console.log(JSON.stringify({ list, rotation }, null, 2));
if (rotation.failed.length > 0) process.exitCode = 1;
