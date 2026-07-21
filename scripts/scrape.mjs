import { runLocalScrape } from '../api/_lib/scrape-pipeline.ts';

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

function log(message, level = 'info') {
  const stamp = paint(ansi.dim, new Date().toISOString());
  const prefix = paint(ansi.magenta, '[scrape]');
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
}

log('starting', 'info');
const result = await runLocalScrape({ log });

console.log(JSON.stringify(result, null, 2));
if (result.failed.length > 0) process.exitCode = 1;
