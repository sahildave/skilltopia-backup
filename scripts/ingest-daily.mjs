import { runLocalListSnapshots } from '../api/_lib/list-snapshots-pipeline.ts';
import { runLocalRotation } from '../api/_lib/rotation-pipeline.ts';

const ansi = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

function paint(color, text) {
  if (!process.stderr.isTTY) return text;
  return `${color}${text}${ansi.reset}`;
}

function makeLog(label) {
  return function log(message, level = 'info') {
    const stamp = paint(ansi.dim, new Date().toISOString());
    const prefix = paint(ansi.magenta, `[${label}]`);
    const color =
      level === 'ok'
        ? ansi.green
        : level === 'warn'
          ? ansi.yellow
          : level === 'error'
            ? ansi.red
            : level === 'step'
              ? ansi.dim
              : ansi.cyan;
    console.error(`${prefix} ${stamp} ${paint(color, message)}`);
  };
}

const listLog = makeLog('list-snapshots');
const rotateLog = makeLog('rotate');

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
