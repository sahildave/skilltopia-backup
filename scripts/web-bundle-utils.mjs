import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'

/** Markers that must never appear in the TARGET=web production bundle. */
export const TAURI_BUNDLE_MARKERS = Object.freeze([
  '@tauri-apps',
  '__TAURI__',
  '__TAURI_INTERNALS__',
])

const SCANNABLE_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.css',
  '.html',
  '.htm',
  '.map',
  '.json',
  '.svg',
  '.txt',
])

/**
 * @param {string} content
 * @returns {string[]}
 */
export function findTauriMarkers(content) {
  return TAURI_BUNDLE_MARKERS.filter(marker => content.includes(marker))
}

/**
 * @param {string} rootDir
 * @returns {Promise<string[]>}
 */
async function listFilesRecursive(rootDir) {
  /** @type {string[]} */
  const files = []

  /**
   * @param {string} dir
   */
  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const absolutePath = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(absolutePath)
        continue
      }
      if (!entry.isFile()) continue
      const ext = entry.name.slice(entry.name.lastIndexOf('.'))
      if (!SCANNABLE_EXTENSIONS.has(ext)) continue
      files.push(absolutePath)
    }
  }

  await walk(rootDir)
  return files
}

/**
 * @param {string} rootDir
 * @returns {Promise<Array<{ file: string, marker: string }>>}
 */
export async function scanWebBundle(rootDir) {
  const rootStat = await stat(rootDir).catch(() => null)
  if (!rootStat?.isDirectory()) {
    throw new Error(
      `Web bundle directory not found: ${rootDir}. Run \`npm run build:web\` first.`
    )
  }

  const files = await listFilesRecursive(rootDir)
  /** @type {Array<{ file: string, marker: string }>} */
  const hits = []

  for (const absolutePath of files) {
    const content = await readFile(absolutePath, 'utf8')
    for (const marker of findTauriMarkers(content)) {
      hits.push({
        file: relative(rootDir, absolutePath).split('\\').join('/'),
        marker,
      })
    }
  }

  return hits
}

/**
 * @param {string} rootDir
 */
export async function assertCleanWebBundle(rootDir) {
  const hits = await scanWebBundle(rootDir)
  if (hits.length === 0) return

  const details = hits
    .map(({ file, marker }) => `  ${file}: ${marker}`)
    .join('\n')
  throw new Error(
    `Tauri markers found in web bundle (${rootDir}). Shared UI must import only @platform / @catalog — never @tauri-apps/*.\n${details}`
  )
}
