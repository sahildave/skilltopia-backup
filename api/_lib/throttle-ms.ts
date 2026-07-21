/** Default pause between skills for scrape / enrich / rotation. */
export const THROTTLE_MS_DEFAULT = 1000;

/** Default pause for one-shot corpus sweep (`scrape:sweep` / GHA sweep). */
export const THROTTLE_MS_SWEEP_DEFAULT = 250;

/**
 * Reads `THROTTLE_MS` from env; invalid/missing → `fallback`.
 * `0` is allowed (no pause).
 */
export function throttleMsFromEnv(
  environment: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
  fallback = THROTTLE_MS_DEFAULT,
): number {
  const raw = environment.THROTTLE_MS?.trim();
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}
