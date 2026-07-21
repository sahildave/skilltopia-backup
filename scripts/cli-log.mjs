import ora from 'ora';

const ansi = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  brightGreen: '\x1b[92m',
};

const SKILL_GROUP_RE = /^\[(\d+)\/(\d+)\]\s+([^:]+)/;
const DONE_RE = /^done\b/i;

function paint(color, text) {
  if (!process.stderr.isTTY) return text;
  return `${color}${text}${ansi.reset}`;
}

function skillGroup(message) {
  const match = SKILL_GROUP_RE.exec(message);
  if (!match) return null;
  return `[${match[1]}/${match[2]}] ${match[3].trim()}`;
}

function parseDoneStats(message) {
  return Object.fromEntries([...message.matchAll(/(\w+)=(\d+)/g)].map(([, key, value]) => [key, value]));
}

function formatDoneMessage(message, level) {
  if (!DONE_RE.test(message)) return null;
  const stats = parseDoneStats(message);
  const bits = [];
  if (stats.attempted != null) bits.push(`${stats.attempted} attempted`);
  if (stats.scraped != null) bits.push(`${stats.scraped} scraped`);
  if (stats.enriched != null) bits.push(`${stats.enriched} enriched`);
  if (stats.seen != null) bits.push(`${stats.seen} seen`);
  if (stats.queued != null) bits.push(`${stats.queued} queued`);
  if (stats.snapshots != null) bits.push(`${stats.snapshots} snapshots`);
  if (stats.skipped != null && Number(stats.skipped) > 0) bits.push(`${stats.skipped} skipped`);
  if (stats.failed != null) bits.push(`${stats.failed} failed`);

  const summary = bits.length > 0 ? bits.join(' · ') : message.replace(DONE_RE, '').trim();
  if (level === 'ok') return summary;
  return summary;
}

function writeSeparator(label, group) {
  const rule = '─'.repeat(Math.min(48, Math.max(24, group.length + 4)));
  console.error('');
  console.error(
    `${paint(ansi.magenta, `[${label}]`)} ${paint(ansi.dim, rule)}\n${paint(ansi.magenta, `[${label}]`)} ${paint(ansi.cyan, group)}`,
  );
}

function writeDoneBanner(label, summary, level) {
  const ok = level === 'ok';
  const color = ok ? ansi.brightGreen : ansi.yellow;
  const title = ok ? 'Done' : 'Done (with issues)';
  const rule = '═'.repeat(Math.min(52, Math.max(28, summary.length + 8)));
  console.error('');
  console.error(`${paint(ansi.magenta, `[${label}]`)} ${paint(color, rule)}`);
  console.error(
    `${paint(ansi.magenta, `[${label}]`)} ${paint(ansi.bold + color, `  ★  ${title}`)}  ${paint(color, summary)}`,
  );
  console.error(`${paint(ansi.magenta, `[${label}]`)} ${paint(color, rule)}`);
  console.error('');
}

function plainLog(label, message, level = 'info') {
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
}

/**
 * Ingest CLI logger: ora spinner on TTY, plain timestamped lines otherwise.
 * Signature matches pipeline `log(message, level?)` callbacks.
 */
export function createCliLog(label) {
  let lastSkillGroup = null;

  function maybeSeparate(message) {
    const group = skillGroup(message);
    if (!group || group === lastSkillGroup) return;
    writeSeparator(label, group);
    lastSkillGroup = group;
  }

  function emitDone(message, level) {
    const summary = formatDoneMessage(message, level);
    if (summary == null) return false;
    writeDoneBanner(label, summary, level);
    return true;
  }

  if (!process.stderr.isTTY) {
    return (message, level = 'info') => {
      if (emitDone(message, level)) return;
      maybeSeparate(message);
      plainLog(label, message, level);
    };
  }

  const spinner = ora({
    stream: process.stderr,
    prefixText: paint(ansi.magenta, `[${label}]`),
  });

  function stopSpinnerQuietly() {
    if (spinner.isSpinning) spinner.stop();
  }

  return function log(message, level = 'info') {
    if (DONE_RE.test(message)) {
      stopSpinnerQuietly();
      emitDone(message, level);
      return;
    }

    const group = skillGroup(message);
    if (group && group !== lastSkillGroup) {
      stopSpinnerQuietly();
      writeSeparator(label, group);
      lastSkillGroup = group;
    }

    if (level === 'ok') {
      spinner.succeed(message);
      return;
    }
    if (level === 'warn') {
      spinner.warn(message);
      return;
    }
    if (level === 'error') {
      spinner.fail(message);
      return;
    }
    if (spinner.isSpinning) {
      spinner.text = message;
      return;
    }
    spinner.start(message);
  };
}
