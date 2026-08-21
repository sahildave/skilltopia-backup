export function isPermissionError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('forbidden') ||
    lower.includes('not allowed') ||
    lower.includes('denied') ||
    lower.includes('scope') ||
    lower.includes('permission')
  );
}

/**
 * Matches the code Rust returns when no Node runtime could be resolved. Checked
 * before `isPermissionError`, which would otherwise swallow it.
 */
export function isNodeRuntimeMissing(message: string): boolean {
  return message.includes('node_runtime_not_found');
}

export function isInstallCancelled(error: unknown): boolean {
  return error instanceof Error && error.name === 'InstallCancelledError';
}
