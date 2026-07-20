export const TAURI_BUNDLE_MARKERS: readonly string[]

export function findTauriMarkers(content: string): string[]

export function scanWebBundle(
  rootDir: string
): Promise<Array<{ file: string; marker: string }>>

export function assertCleanWebBundle(rootDir: string): Promise<void>
