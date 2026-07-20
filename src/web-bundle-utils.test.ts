import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  TAURI_BUNDLE_MARKERS,
  assertCleanWebBundle,
  findTauriMarkers,
  scanWebBundle,
} from '../scripts/web-bundle-utils.mjs';

describe('web bundle Tauri hard-no', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function makeBundleDir(files: Record<string, string>): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'web-bundle-'));
    tempDirs.push(root);
    for (const [relativePath, contents] of Object.entries(files)) {
      const absolutePath = join(root, relativePath);
      await mkdir(join(absolutePath, '..'), { recursive: true });
      await writeFile(absolutePath, contents, 'utf8');
    }
    return root;
  }

  it('lists the agreed markers', () => {
    expect(TAURI_BUNDLE_MARKERS).toEqual(['@tauri-apps', '__TAURI__', '__TAURI_INTERNALS__']);
  });

  it('finds each marker in text', () => {
    expect(findTauriMarkers('import "@tauri-apps/api"')).toEqual(['@tauri-apps']);
    expect(findTauriMarkers('window.__TAURI__ = {}')).toEqual(['__TAURI__']);
    expect(findTauriMarkers('window.__TAURI_INTERNALS__.invoke')).toEqual(['__TAURI_INTERNALS__']);
  });

  it('returns no markers for a clean web chunk', () => {
    expect(findTauriMarkers('fetch("/api/skills").then((r) => r.json())')).toEqual([]);
  });

  it('scans nested dist files and reports path + marker', async () => {
    const root = await makeBundleDir({
      'index.html': '<div id="root"></div>',
      'assets/index.js': 'const x = "@tauri-apps/plugin-fs"',
      'assets/clean.css': 'body { margin: 0 }',
    });

    const hits = await scanWebBundle(root);
    expect(hits).toEqual([{ file: 'assets/index.js', marker: '@tauri-apps' }]);
  });

  it('passes a clean bundle and fails a contaminated one', async () => {
    const clean = await makeBundleDir({
      'assets/app.js': 'export const ok = true',
    });
    await expect(assertCleanWebBundle(clean)).resolves.toBeUndefined();

    const dirty = await makeBundleDir({
      'assets/app.js': 'window.__TAURI_INTERNALS__.invoke("ping")',
    });
    await expect(assertCleanWebBundle(dirty)).rejects.toThrow(/__TAURI_INTERNALS__/);
  });
});
