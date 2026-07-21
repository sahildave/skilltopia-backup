import { runLocalScrape, skillIdsFromEnv } from '../api/_lib/scrape-pipeline.ts';
import { createCliLog } from './cli-log.mjs';

const log = createCliLog('scrape');
const skillIds = skillIdsFromEnv();
const abort = new AbortController();
let forceExit = false;

function requestStop(signalName) {
  if (forceExit) {
    process.exit(130);
  }
  forceExit = true;
  log(`${signalName} — stopping after current skill (Ctrl+C again to force quit)`, 'warn');
  abort.abort();
}

process.on('SIGINT', () => requestStop('SIGINT'));
process.on('SIGTERM', () => requestStop('SIGTERM'));

log(
  skillIds
    ? `starting (${skillIds.length} explicit SKILL_IDS)`
    : 'starting (leaderboard; set SKILL_IDS=a,b to limit)',
  'info',
);

const result = await runLocalScrape({
  log,
  skillIds,
  signal: abort.signal,
});

console.log(JSON.stringify(result, null, 2));
if (result.aborted) process.exitCode = 130;
else if (result.failed.length > 0) process.exitCode = 1;
