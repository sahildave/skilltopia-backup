import { createTauriUpdateSource } from './tauri-source';
import type { UpdateSource } from './types';

/**
 * Skilltopia's source: a static `latest.json` on public GitHub Releases.
 *
 * It is config, not code — the whole difference from an entitled feed is that
 * this one sends no request headers, so nothing here can leak a token into a
 * public request. A paid app supplies its own `UpdateSource` instead.
 */
export function createPublicGitHubUpdateSource(): UpdateSource {
  return createTauriUpdateSource();
}
