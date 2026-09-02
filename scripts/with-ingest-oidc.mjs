#!/usr/bin/env node
/**
 * Mint a fresh ingest OIDC token, then run the given command with it.
 *
 * Vercel OIDC tokens live 12 hours, so storing one in Infisical guarantees a
 * stale-token 401 on the next run. This mirrors what `.github/workflows/
 * ingest.yml` does in CI: mint per run, keep it in the process environment,
 * never write it down.
 *
 *   infisical run --env=dev -- node scripts/with-ingest-oidc.mjs <cmd> [args]
 *
 * Needs `VERCEL_TOKEN` (the ingest account's Vercel API token) in the
 * environment — Infisical `dev` supplies it.
 */
import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Pinned to match ingest.yml: a CLI release must not change local and CI apart.
const VERCEL_CLI = 'vercel@59.3.0';
const SCOPE = process.env.VERCEL_INGEST_SCOPE ?? 'indhujas-projects';
const PROJECT = process.env.VERCEL_INGEST_PROJECT ?? 'skills-explorer';

/**
 * The CLI pretty-prints JSON across several lines and may print a banner
 * first, so slice from the first brace to the last rather than parsing lines.
 */
export function parseTokenOutput(stdout) {
  const json = stdout.slice(stdout.indexOf('{'), stdout.lastIndexOf('}') + 1);
  const token = JSON.parse(json).token;
  if (!token) throw new Error('vercel project token returned no token');
  return token;
}

async function mintToken(vercelToken) {
  const { stdout } = await execFileAsync(
    'npx',
    [
      '--yes',
      VERCEL_CLI,
      'project',
      'token',
      PROJECT,
      '--scope',
      SCOPE,
      '--token',
      vercelToken,
      '--format=json',
      '--yes',
    ],
    { maxBuffer: 10 * 1024 * 1024 },
  );
  return parseTokenOutput(stdout);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command) {
    console.error('usage: with-ingest-oidc.mjs <command> [args...]');
    process.exit(2);
  }

  const vercelToken = process.env.VERCEL_TOKEN?.trim();
  if (!vercelToken) {
    console.error(
      "VERCEL_TOKEN is not set. It is the ingest account's Vercel API token;\n" +
        'add it to Infisical `dev` and run this through `infisical run --env=dev`.',
    );
    process.exit(1);
  }

  console.error(`[oidc] minting ingest token for ${SCOPE}/${PROJECT}…`);
  const token = await mintToken(vercelToken);
  console.error('[oidc] minted, valid ~12h');

  const child = spawn(command, args, {
    stdio: 'inherit',
    env: { ...process.env, VERCEL_OIDC_TOKEN_SECONDARY: token },
  });
  child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 0)));
}

if (process.argv[1]?.endsWith('with-ingest-oidc.mjs')) {
  main().catch((error) => {
    console.error(`[oidc] ${error.message}`);
    process.exit(1);
  });
}
