#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DOWNLOADS_START = '<!-- downloads:start -->';
export const DOWNLOADS_END = '<!-- downloads:end -->';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const README_PATH = path.join(ROOT, 'README.md');

/**
 * @param {string} remoteUrl
 * @returns {string | null}
 */
export function parseGithubRepoSlug(remoteUrl) {
  const trimmed = remoteUrl.trim().replace(/\.git$/, '');

  const httpsMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
  if (httpsMatch) {
    return `${httpsMatch[1]}/${httpsMatch[2]}`;
  }

  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+)$/i);
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2]}`;
  }

  return null;
}

/**
 * @param {string[]} assetNames
 */
export function classifyReleaseAssets(assetNames) {
  const installers = assetNames.filter(
    (name) => !name.endsWith('.sig') && name !== 'latest.json',
  );

  return {
    appleSiliconDmg: installers.find(
      (name) => name.endsWith('.dmg') && name.includes('aarch64'),
    ),
    intelMacDmg: installers.find(
      (name) =>
        name.endsWith('.dmg') && (name.includes('x64') || name.includes('x86_64')),
    ),
    windowsInstaller: installers.find(
      (name) => name.endsWith('.msi') || name.endsWith('.exe'),
    ),
    linuxAppImage: installers.find((name) => name.endsWith('.AppImage')),
  };
}

/**
 * @param {ReturnType<typeof classifyReleaseAssets>} assets
 * @param {{ downloadBase: string; releasesLatest: string }} urls
 */
export function buildDownloadsMarkdown(assets, urls) {
  const link = (label, filename) =>
    filename
      ? `- [${label}](${urls.downloadBase}/${filename})`
      : `- [${label}](${urls.releasesLatest})`;

  return [
    DOWNLOADS_START,
    link('Apple Silicon macOS (.dmg)', assets.appleSiliconDmg),
    link('Intel macOS', assets.intelMacDmg),
    link('Windows', assets.windowsInstaller),
    link('Linux (.AppImage)', assets.linuxAppImage),
    DOWNLOADS_END,
  ].join('\n');
}

/**
 * @param {ReturnType<typeof classifyReleaseAssets>} assets
 */
export function buildDownloadsNote(assets) {
  const direct = [];
  const fallback = [];

  if (assets.appleSiliconDmg) {
    direct.push('Apple Silicon');
  } else {
    fallback.push('Apple Silicon');
  }

  if (assets.intelMacDmg) {
    direct.push('Intel macOS');
  } else {
    fallback.push('Intel macOS');
  }

  if (assets.windowsInstaller) {
    direct.push('Windows');
  } else {
    fallback.push('Windows');
  }

  if (assets.linuxAppImage) {
    direct.push('Linux');
  } else {
    fallback.push('Linux');
  }

  if (fallback.length === 0) {
    return 'All platform links point straight to the latest published asset and should start downloading immediately.';
  }

  if (direct.length === 0) {
    return 'Platform links currently fall back to the latest release page until bundle assets are attached there.';
  }

  return `${joinList(direct)} link${direct.length === 1 ? '' : 's'} point straight to the latest published asset and should start downloading immediately. ${joinList(fallback)} currently fall${fallback.length === 1 ? 's' : ''} back to the latest release page until those bundle assets are attached there.`;
}

/**
 * @param {string[]} items
 */
function joinList(items) {
  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

/**
 * @param {string} readme
 * @param {string} downloadsBlock
 * @param {string} note
 */
export function replaceDownloadsSection(readme, downloadsBlock, note) {
  const start = readme.indexOf(DOWNLOADS_START);
  const end = readme.indexOf(DOWNLOADS_END);

  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `README.md is missing ${DOWNLOADS_START} / ${DOWNLOADS_END} markers around the Downloads list.`,
    );
  }

  const afterMarker = end + DOWNLOADS_END.length;
  const afterBlock = readme.slice(afterMarker);
  const noteMatch = afterBlock.match(/^\s*\n\n([^\n]+)\n/);

  if (!noteMatch) {
    throw new Error(
      'README.md downloads markers must be followed by a blank line and a single-line note paragraph.',
    );
  }

  const before = readme.slice(0, start);
  const afterNote = afterBlock.slice(noteMatch[0].length);

  return `${before}${downloadsBlock}\n\n${note}\n${afterNote}`;
}

function runGhJson(args) {
  try {
    return JSON.parse(
      execFileSync('gh', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
  } catch (error) {
    const stderr = error.stderr?.toString().trim();
    throw new Error(
      `Failed to query GitHub releases with gh. Publish the draft release first, then retry.\n${stderr || error.message}`,
    );
  }
}

function getOriginSlug() {
  const remoteUrl = execFileSync('git', ['remote', 'get-url', 'origin'], {
    encoding: 'utf8',
    cwd: ROOT,
  });
  const slug = parseGithubRepoSlug(remoteUrl);
  if (!slug) {
    throw new Error(`Could not parse GitHub repo from origin remote: ${remoteUrl.trim()}`);
  }
  return slug;
}

function syncReadmeDownloads() {
  const slug = getOriginSlug();
  const release = runGhJson([
    'release',
    'view',
    '--repo',
    slug,
    '--json',
    'isDraft,tagName,assets',
  ]);

  if (release.isDraft) {
    throw new Error(
      `Latest release ${release.tagName} is still a draft. Publish it on GitHub, then rerun this script.`,
    );
  }

  const assetNames = (release.assets ?? []).map((asset) => asset.name);
  const assets = classifyReleaseAssets(assetNames);
  const urls = {
    downloadBase: `https://github.com/${slug}/releases/latest/download`,
    releasesLatest: `https://github.com/${slug}/releases/latest`,
  };

  const downloadsBlock = buildDownloadsMarkdown(assets, urls);
  const note = buildDownloadsNote(assets);
  const readme = fs.readFileSync(README_PATH, 'utf8');
  const next = replaceDownloadsSection(readme, downloadsBlock, note);

  if (next === readme) {
    console.log(`README downloads already match published ${release.tagName}.`);
    return;
  }

  fs.writeFileSync(README_PATH, next);
  console.log(`Updated README downloads for published ${release.tagName}.`);
  for (const [label, filename] of [
    ['Apple Silicon', assets.appleSiliconDmg],
    ['Intel macOS', assets.intelMacDmg],
    ['Windows', assets.windowsInstaller],
    ['Linux', assets.linuxAppImage],
  ]) {
    console.log(`  ${label}: ${filename ?? '(release page fallback)'}`);
  }
  console.log('\nCommit the README change when ready.');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    syncReadmeDownloads();
  } catch (error) {
    console.error(`❌ ${error.message}`);
    process.exit(1);
  }
}
